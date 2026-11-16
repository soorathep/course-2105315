"""Lab 07: check decision-engine.js against pandas, working only from the two raw files the page writes.

Usage: python3 _teaching-src/2105315/labs/tests/decision_vs_pandas.py   (needs Node.js and pandas)
"""
import json, pathlib, subprocess, tempfile
import numpy as np, pandas as pd

HERE = pathlib.Path(__file__).resolve().parent
LIMIT, CAL_H = 15, 7 * 24
ok = True

def check(name, a, b, tol=1e-9):
    global ok
    if (a is None or b is None) and a != b or (a is not None and b is not None and abs(a - b) > tol * max(1.0, abs(b))):
        ok = False; print(f'  MISMATCH {name}: engine {a} pandas {b}')

def evaluate(df, margin=0):
    cal, test = df.iloc[:CAL_H].dropna(subset=['s', 'b']), df.iloc[CAL_H:].dropna(subset=['s', 'truth'])
    slope, icept = np.polyfit(cal['s'], cal['b'], 1)
    pred = icept + slope * test['s']; t = test['truth'] > LIMIT; f = pred > LIMIT - margin
    return dict(n=len(cal), slope=slope, tn=len(test), above=int(t.sum()), hits=int((t & f).sum()), fa=int((f & ~t).sum()),
                rmse=float(np.sqrt(((pred - test['truth']) ** 2).mean())))

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['node', str(HERE / 'decision_cases.mjs'), tmp], check=True)
    out = json.loads((pathlib.Path(tmp) / 'cases.json').read_text())
    for c in out['cases']:
        s = pd.read_csv(pathlib.Path(tmp) / f"s{c['j']}.csv", parse_dates=['datetime_local'])
        a = pd.read_csv(pathlib.Path(tmp) / f"a{c['j']}.csv", parse_dates=['datetime_utc'])
        check('duplicates', c['audit']['duplicates'], int(s.duplicated().sum()), 0)
        s = s.drop_duplicates().replace(-200, np.nan).set_index('datetime_local')['PT08_S1_CO']
        a = a.replace(-200, np.nan)
        truth = a.assign(t=a['datetime_utc'] + pd.Timedelta(hours=2)).set_index('t')['C6H6_ugm3'].reindex(s.index)
        nb = {n['id']: n['value'] for n in c['notebook']}
        check('rows', nb['rows'], len(s), 0)
        scan = {}
        for h in range(-2, 5):
            b = a.assign(t=a['datetime_utc'] + pd.Timedelta(hours=h)).set_index('t')['C6H6_ugm3'].reindex(s.index)
            scan[h] = s.corr(b)
            e = next(x for x in c['scan'] if x['shift'] == h); check(f'scan {h}', e['r'], scan[h])
            if h in (0, 2):
                res = evaluate(pd.DataFrame({'s': s, 'b': b, 'truth': truth}))
                eng = c['aligned' if h == 2 else 'naive']
                check(f'slope {h}', eng['cal']['slope'], res['slope']); check(f'cal n {h}', eng['cal']['n'], res['n'], 0)
                for key, k2 in [('above', 'above'), ('hits', 'hits'), ('falseAlarms', 'fa'), ('n', 'tn')]: check(f'{key} {h}', eng['test'][key], res[k2], 0)
                check(f'rmse {h}', eng['test']['rmse'], res['rmse'])
                if h == 2:
                    m3 = evaluate(pd.DataFrame({'s': s, 'b': b, 'truth': truth}), 3)
                    check('margin3 hits', c['margin3']['test']['hits'], m3['hits'], 0); check('margin3 fa', c['margin3']['test']['falseAlarms'], m3['fa'], 0)
        best = max(scan, key=scan.get); check('best shift', nb['shift'], best, 0); check('notebook slope', nb['slope'], c['aligned']['cal']['slope'])
        al, nv = c['aligned']['test'], c['naive']['test']
        print(f"ok   {c['label']}: from {c['start']}, best shift +{best} h (r {scan[best]:.2f}, plain merge {scan[0]:.2f}); "
              f"aligned flags {al['hits']}/{al['above']} ({al['hits']/al['above']:.0%}), plain merge {nv['hits']}/{nv['above']} ({nv['hits']/nv['above']:.0%})")
    print(f"student windows: {out['nCandidates']}")
print('all ok' if ok else 'MISMATCHES FOUND'); raise SystemExit(0 if ok else 1)
