"""Check that the Lab 03 browser engine gives the same numbers as pandas.

Needs Node.js and pandas:  python3 _teaching-src/2105315/labs/tests/spikes_vs_pandas.py

For two demo windows and six student IDs it checks: the downloaded file differs from the source record only
at the eight faults; the z-score, Hampel (k = 3 and 5) and second-sensor flags; the Step 5 numbers; and the
trailing and centered rolling means with the daily peak used in Step 7.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
import pandas as pd

HERE = pathlib.Path(__file__).resolve().parent


def mad(w):
    return np.median(np.abs(w - np.median(w)))


def main():
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['node', str(HERE / 'spikes_cases.mjs'), tmp], check=True)
        cases = json.loads((pathlib.Path(tmp) / 'cases.json').read_text())
        failed = 0
        for case in cases:
            fails = []
            df = pd.read_csv(pathlib.Path(tmp) / f"v{case['k']}.csv", parse_dates=['datetime'], index_col='datetime')
            x, s = df['C6H6_ugm3'], df['PT08_S1_CO']
            truth = pd.Series(case['truth'], index=x.index)
            diff = set(np.where(~np.isclose(x.values, truth.values))[0])
            if diff != {f['i'] for f in case['faults']}: fails.append('file differs from source outside the faults')
            if len(df) != 336 or df.isna().any().any(): fails.append('window not complete')
            # rule 1: z-score
            z = (x - x.mean()).abs() > 3 * x.std()
            # rule 2: Hampel, 7-hour centred window
            med = x.rolling(7, center=True).median()
            m = x.rolling(7, center=True).apply(mad, raw=True)
            score = (x - med).abs() / (1.4826 * m)
            h3, h5 = score > 3, score > 5
            # rule 3: residual from a straight-line fit to the second sensor
            slope, intercept = np.polyfit(s, x, 1)
            r = x - (intercept + slope * s)
            sens = (r - r.median()).abs() > 4 * 1.4826 * (r - r.median()).abs().median()
            for name, pd_flag, eng in [('z', z, case['flags']['z']), ('hampel', h3, case['flags']['hampel']),
                                       ('hampel k=5', h5, case['hampel5']), ('sensor', sens, case['flags']['sensor'])]:
                if list(pd_flag.values) != eng: fails.append(f'{name} flags')
            if abs(slope - case['fit']['slope']) > 1e-9: fails.append('fit slope')
            nb = {n['id']: n['value'] for n in case['notebook']}
            if int(z.sum()) != nb['zcount']: fails.append('z count')
            if abs(x.mean() - nb['mean-all']) > 1e-9: fails.append('mean all')
            if abs(x[~z].mean() - nb['mean-kept']) > 1e-9: fails.append('mean kept (AI code)')
            day = truth.index.date
            for sm in case['smooth']:
                ps = truth.rolling(sm['w'], center=sm['centre']).mean()
                eng = np.array([np.nan if v is None else v for v in sm['values']])
                if not np.allclose(ps.values, eng, equal_nan=True): fails.append(f"rolling {sm['w']} centre={sm['centre']}")
                peak = ps.groupby(day).max().mean()
                if abs(peak - sm['dailyPeak']) > 1e-9: fails.append(f"daily peak {sm['w']} {sm['centre']}")
            sc = case['score']
            failed += bool(fails)
            print(('ok   ' if not fails else 'FAIL ') + f"{case['label']} (start {case['start']}): caught z {sc['z']['caught']}/8 false {sc['z']['falseAlarms']}, "
                  f"Hampel {sc['hampel']['caught']}/8 false {sc['hampel']['falseAlarms']}, sensor {sc['sensor']['caught']}/8 false {sc['sensor']['falseAlarms']}"
                  + ('' if not fails else f': {fails[:6]}'))
        print(f"{cases[0]['nStarts']} complete 14-day windows available for student data sets")
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
