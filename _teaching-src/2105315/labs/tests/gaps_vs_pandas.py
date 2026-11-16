"""Check that the Lab 02 browser engine gives the same numbers as pandas.

Needs Node.js and pandas:  python3 _teaching-src/2105315/labs/tests/gaps_vs_pandas.py

For two demo windows and six student IDs it checks: the window has no missing benzene hour; the downloaded
file has the stated gaps; the Step 5 numbers; and, for every gap pattern and fill method, the two-week mean and the
typical daily peak (mean of daily maxima) computed with pandas (dropna, fillna(mean), interpolate(), ffill(), fillna(hourly mean)).
It also checks the 'fill only gaps up to L hours' rule used in Step 8b.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
import pandas as pd

HERE = pathlib.Path(__file__).resolve().parent


def answers(s):
    return {'mean': s.mean(), 'dailyMax': s.groupby(s.index.date).max().mean(), 'unfilled': int(s.isna().sum())}


def methods(obs):
    hour = obs.index.hour
    return {
        'drop': obs,
        'mean': obs.fillna(obs.mean()),
        'linear': obs.interpolate(),
        'ffill': obs.ffill(),
        'hour': obs.fillna(obs.groupby(hour).transform('mean')),
    }


def short_gaps(obs, L):
    # the exact lines shown in the Step 4 explanation
    gap = obs.isna().groupby(obs.notna().cumsum()).transform('sum')
    return obs.fillna(obs.interpolate(limit_area='inside').where(gap <= L))


def close(a, b):
    return (np.isnan(a) and b is None) or (b is not None and abs(a - b) < 1e-9)


def main():
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['node', str(HERE / 'gaps_cases.mjs'), tmp], check=True)
        cases = json.loads((pathlib.Path(tmp) / 'cases.json').read_text())
        failed = 0
        for case in cases:
            fails = []
            truth = pd.read_csv(pathlib.Path(tmp) / f"v{case['k']}-truth.csv", parse_dates=['datetime'], index_col='datetime')['C6H6_ugm3']
            file = pd.read_csv(pathlib.Path(tmp) / f"v{case['k']}.csv", parse_dates=['datetime'], index_col='datetime')['C6H6_ugm3']
            if len(truth) != 336 or truth.isna().any() or (truth.index.to_series().diff().dropna() != pd.Timedelta('1h')).any():
                fails.append('window not complete and hourly')
            nb = {n['id']: n['value'] for n in case['notebook']}
            if int(file.isna().sum()) != nb['missing']: fails.append('missing count')
            if abs(file.mean() - nb['mean-drop']) > 1e-9: fails.append('mean after dropna')
            if abs(file.interpolate().mean() - nb['mean-linear']) > 1e-9: fails.append('mean after interpolate')
            for pid, p in case['patterns'].items():
                obs = truth.copy(); obs.iloc[p['gaps']] = np.nan
                t = answers(truth)
                for k in ['mean', 'dailyMax']:
                    if not close(t[k], p['truth'][k]): fails.append(f'{pid} truth {k}')
                for m, s in methods(obs).items():
                    row = next(r for r in p['rows'] if r['id'] == m)
                    a = answers(s)
                    for k in ['mean', 'dailyMax', 'unfilled']:
                        if not close(a[k], row[k]): fails.append(f'{pid} {m} {k}: pandas {a[k]} engine {row[k]}')
            for L, eng in case['short'].items():
                a = answers(short_gaps(file, int(L)))
                for k in ['mean', 'dailyMax', 'unfilled']:
                    if not close(a[k], eng[k]): fails.append(f'short gaps {L} {k}')
            failed += bool(fails)
            print(('ok   ' if not fails else 'FAIL ') + case['label'] + f" (start {case['start']}, {len(case['patterns']['combined']['gaps'])} gaps)" + ('' if not fails else f': {fails[:6]}'))
        print(f"{cases[0]['nStarts']} complete 14-day windows available for student data sets")
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
