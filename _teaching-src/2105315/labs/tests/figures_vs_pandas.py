"""Check that the Lab 04 browser engine gives the same numbers as pandas and numpy.

Needs Node.js and pandas:  python3 _teaching-src/2105315/labs/tests/figures_vs_pandas.py

For two demo pairs and six student IDs it checks the monthly mean, median, quartiles, 10th and 90th
percentiles, share of hours above the level, the histogram, the report's baseline and the lie factor, and
the Step 5 numbers; then the daily means of the whole year and four trend lines (numpy.polyfit).
"""
import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
import pandas as pd

HERE = pathlib.Path(__file__).resolve().parent
LEVEL = 10


def main():
    raw = json.loads((HERE.parent / 'assets/data/airquality.json').read_text())
    v = pd.Series([float(x.replace(',', '.')) if x.strip() else np.nan for x in raw['text']['C6H6(GT)']],
                  index=pd.date_range(raw['start'], periods=raw['hours'], freq='h')).replace(-200, np.nan)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['node', str(HERE / 'figures_cases.mjs'), tmp], check=True)
        res = json.loads((pathlib.Path(tmp) / 'cases.json').read_text())
        failed = 0
        for case in res['cases']:
            fails = []
            df = pd.read_csv(pathlib.Path(tmp) / f"v{case['k']}.csv", parse_dates=['datetime'], index_col='datetime')['C6H6_ugm3']
            for key, eng in [(case['low'], case['sa']), (case['high'], case['sb'])]:
                m = df[df.index.strftime('%Y-%m') == key]
                if len(m) != m.index.days_in_month[0] * 24: fails.append(f'{key} not a whole month')
                if not np.allclose(m.values, v[key].values, equal_nan=True): fails.append(f'{key} differs from source')
                ref = {'n': m.count(), 'mean': m.mean(), 'median': m.median(), 'q1': m.quantile(.25), 'q3': m.quantile(.75),
                       'p10': m.quantile(.1), 'p90': m.quantile(.9), 'max': m.max(), 'above': (m > LEVEL).sum() / m.count()}
                for k2, x in ref.items():
                    if abs(x - eng[k2]) > 1e-9: fails.append(f'{key} {k2}')
            a, b = case['sa']['mean'], case['sb']['mean']
            base = np.floor(0.9 * min(a, b))
            if base != case['base']: fails.append('baseline')
            if abs(((b - base) / (a - base) - 1) / (b / a - 1) - case['lie']) > 1e-9: fails.append('lie factor')
            h = case['hist']; edges = np.arange(0, np.ceil(h['top'] / h['w']) * h['w'] + 1e-9, h['w'])
            for key, eng in [(case['low'], h['a']), (case['high'], h['b'])]:
                m = df[df.index.strftime('%Y-%m') == key].dropna()
                cnt, _ = np.histogram(m.values, bins=edges)
                if not np.allclose(cnt / len(m), eng): fails.append(f'histogram {key}')
            hb = df[df.index.strftime('%Y-%m') == case['high']].dropna()
            if abs((hb < a).mean() - case['below']) > 1e-9: fails.append('share below')
            nb = {n['id']: n['value'] for n in case['notebook']}
            hi = df[df.index.strftime('%Y-%m') == case['high']]
            if abs(df[df.index.strftime('%Y-%m') == case['low']].mean() - nb['mean-low']) > 1e-9: fails.append('nb mean low')
            if abs(100 * (hi > LEVEL).sum() / hi.count() - nb['above-high']) > 1e-9: fails.append('nb above')
            failed += bool(fails)
            print(('ok   ' if not fails else 'FAIL ') + f"{case['label']}: {case['low']} {a:.2f} vs {case['high']} {b:.2f}, "
                  f"ratio {b / a:.2f}, report axis from {case['base']:.0f}, lie factor {case['lie']:.1f}, below {100*case['below']:.0f}%" + ('' if not fails else f': {fails}'))
        year = v['2004-04':'2005-03']
        g = year.groupby(year.index.date)
        dm = g.mean().where(g.count() >= 18)
        eng = np.array([np.nan if d['mean'] is None else d['mean'] for d in res['days']])
        ok_days = len(dm) == len(eng) and np.allclose(dm.values, eng, equal_nan=True)
        x = np.arange(len(dm))
        ok_trend = True
        for t in res['trends']:
            sel = (dm.index >= pd.Timestamp(t['f'] + '-01').date()) & (dm.index < (pd.Timestamp(t['t'] + '-01') + pd.offsets.MonthBegin(1)).date()) & dm.notna().values
            slope = np.polyfit(x[sel], dm.values[sel], 1)[0]
            ok_trend &= abs(slope - t['slope']) < 1e-9
            print(f"     trend {t['f']} to {t['t']}: {30 * slope:+.2f} µg/m³ per 30 days")
        print(('ok   ' if ok_days else 'FAIL ') + 'daily means of the year;', ('ok' if ok_trend else 'FAIL'), 'trends;', res['nPairs'], 'month pairs')
        failed += (not ok_days) + (not ok_trend)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
