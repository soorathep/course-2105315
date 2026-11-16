"""Check that the Lab 05 browser engine gives the same numbers as pandas.

Needs Node.js and pandas:  python3 _teaching-src/2105315/labs/tests/relations_vs_pandas.py

Part A, for two demos and six student IDs: daily means (18 valid hours), Pearson r of daily temperature and
NOx, r after subtracting a 29-day centered rolling mean, the Step 5 numbers computed from the downloaded
file, and the list of allowed windows. Part B: the calibration fit (numpy.polyfit), daily mean residuals,
the calibration mean and standard deviation, a two-sided CUSUM written out in plain Python, and the 3-sigma rule.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
import pandas as pd

HERE = pathlib.Path(__file__).resolve().parent


def cusum(daily, mu, sigma, k, h, cal=14):
    su = sd = 0.0; lz_u = lz_d = cal - 1
    for j in range(cal, len(daily)):
        v = daily[j]
        if np.isnan(v): continue
        su = max(0.0, su + (v - mu) - k * sigma); sd = max(0.0, sd - (v - mu) - k * sigma)
        if su == 0: lz_u = j
        if sd == 0: lz_d = j
        if su > h * sigma or sd > h * sigma:
            side = 'up' if su > h * sigma else 'down'
            return j, side, (lz_u if side == 'up' else lz_d) + 1
    return None, None, None


def main():
    raw = json.loads((HERE.parent / 'assets/data/airquality.json').read_text())
    idx = pd.date_range(raw['start'], periods=raw['hours'], freq='h')
    df = pd.DataFrame({c: [float(x.replace(',', '.')) if x.strip() else np.nan for x in raw['text'][c]] for c in raw['columns']}, index=idx).replace(-200, np.nan)
    full = df[df.index >= df.index[df.index.hour == 0][0]]
    g = full.resample('D'); D = g.mean().where(g.count() >= 18)
    D = D.iloc[:len(full) // 24]
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['node', str(HERE / 'relations_cases.mjs'), tmp], check=True)
        res = json.loads((pathlib.Path(tmp) / 'cases.json').read_text())
        failed = 0
        # allowed Part A windows
        allowed = []
        for s in range(len(D) - 112 + 1):
            w = D.iloc[s:s + 112]
            x = w[['T', 'NOx(GT)']].dropna()
            if len(x) >= 70 and abs(x['T'].corr(x['NOx(GT)'])) >= 0.4: allowed.append(str(w.index[0].date()))
        ok_allowed = allowed == res['startsA']
        print(('ok   ' if ok_allowed else 'FAIL ') + f"{len(allowed)} Part A windows; {res['nB']} Part B windows")
        failed += not ok_allowed
        for case in res['cases']:
            fails = []
            w = D.loc[case['startA']:].iloc[:112]
            tr = w.rolling(29, center=True, min_periods=15).mean(); dt = w - tr
            if abs(w['T'].corr(w['NOx(GT)']) - case['raw']['r']) > 1e-9: fails.append('raw r')
            if abs(dt['T'].corr(dt['NOx(GT)']) - case['det']['r']) > 1e-9: fails.append('detrended r')
            f = pd.read_csv(pathlib.Path(tmp) / f"v{case['k']}.csv", index_col='date')
            ft = f.rolling(29, center=True, min_periods=15).mean(); fd = f - ft
            nb = {n['id']: n['value'] for n in case['notebook']}
            if f.dropna().shape[0] != nb['days']: fails.append('days')
            if abs(f['T_degC'].corr(f['NOx_ppb']) - nb['r-raw']) > 1e-9: fails.append('nb raw r')
            if abs(fd['T_degC'].corr(fd['NOx_ppb']) - nb['r-det']) > 1e-9: fails.append('nb detrended r')
            # Part B
            h0 = full.index.get_loc(pd.Timestamp(case['startB'])); hb = full.iloc[h0:h0 + 112 * 24]
            c = hb.iloc[:14 * 24][['PT08.S1(CO)', 'C6H6(GT)']].dropna()
            slope, intercept = np.polyfit(c['PT08.S1(CO)'], c['C6H6(GT)'], 1)
            r = hb['C6H6(GT)'] - (intercept + slope * hb['PT08.S1(CO)'])
            gb = r.groupby(np.arange(len(r)) // 24); daily = gb.mean().where(gb.count() >= 18).values
            eng = np.array([np.nan if v is None else v for v in case['bDaily']])
            if abs(slope - case['fit']['slope']) > 1e-9: fails.append('fit')
            if not np.allclose(daily, eng, equal_nan=True): fails.append('daily residuals')
            mu, sigma = np.nanmean(daily[:14]), pd.Series(daily[:14]).std()
            if abs(mu - case['mu']) > 1e-9 or abs(sigma - case['sigma']) > 1e-9: fails.append('mu sigma')
            for (k, h), eng_c in [((0.5, 5), case['cusum']), ((1, 4), case['cusum2'])]:
                a, side, onset = cusum(daily, mu, sigma, k, h)
                if (a, side, onset) != (eng_c['alarm'], eng_c['side'], eng_c['onset']): fails.append(f'cusum k={k} h={h}')
            thr = next((j for j in range(14, 112) if not np.isnan(daily[j]) and abs(daily[j] - mu) > 3 * sigma), None)
            if thr != case['thr']: fails.append('3-sigma rule')
            failed += bool(fails)
            print(('ok   ' if not fails else 'FAIL ') + f"{case['label']}: A {case['startA']} r {case['raw']['r']:+.2f} -> {case['det']['r']:+.2f}; "
                  f"B {case['startB']} CUSUM alarm day {case['cusum']['alarm']} ({case['cusum']['side']}), onset {case['cusum']['onset']}, 3-sigma day {case['thr']}"
                  + ('' if not fails else f': {fails}'))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
