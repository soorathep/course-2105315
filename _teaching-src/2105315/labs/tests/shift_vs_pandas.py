"""Lab 06: check shift-engine.js against pandas and scipy.

Usage: python3 _teaching-src/2105315/labs/tests/shift_vs_pandas.py   (needs Node.js, pandas, scipy)
"""
import json, pathlib, subprocess, tempfile
import numpy as np, pandas as pd
from scipy import stats

HERE = pathlib.Path(__file__).resolve().parent
data = json.loads((HERE.parent / 'assets/data/airquality.json').read_text())
s = pd.Series([float(x.replace(',', '.')) if x.strip() else np.nan for x in data['text']['C6H6(GT)']],
              index=pd.date_range(data['start'], periods=data['hours'], freq='h'))
s = s.where(s != -200)
cnt = s.resample('D').count(); n_hours = s.resample('D').size()
dm = s.resample('D').mean().where(cnt >= 18)
dm = dm[n_hours == 24]                     # whole calendar days only, as in the page
days = dm.index
ok = True

def check(name, a, b, tol):
    global ok
    good = abs(a - b) <= tol * max(1.0, abs(b)) if tol < 1e-6 else abs(a - b) <= tol
    if not good: ok = False; print(f'  MISMATCH {name}: engine {a} pandas {b}')

def compare(k, w):
    m = round(0.85 * w)
    b, a = dm.iloc[k - w:k], dm.iloc[k:k + w]
    if b.notna().sum() < m or a.notna().sum() < m: return None
    hb = s[days[k - w]:days[k] - pd.Timedelta(hours=1)].dropna()
    ha = s[days[k]:days[k] + pd.Timedelta(days=w) - pd.Timedelta(hours=1)].dropna()
    th, td = stats.ttest_ind(ha, hb, equal_var=False), stats.ttest_ind(a.dropna(), b.dropna(), equal_var=False)
    return dict(day=str(days[k].date()), diff=a.mean() - b.mean(), ph=th.pvalue, pd=td.pvalue, nh=len(ha) + len(hb), ci=td.confidence_interval(0.95))

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['node', str(HERE / 'shift_cases.mjs'), tmp], check=True)
    out = json.loads((pathlib.Path(tmp) / 'cases.json').read_text())
    for w, P in out['placebo'].items():
        w = int(w); ref = [c for k in range(w, len(days) - w + 1) if (c := compare(k, w))]
        if [r['day'] for r in ref] != [d[0] for d in P['days']]: ok = False; print(f'  MISMATCH placebo dates w={w}')
        for r, d in zip(ref, P['days']):
            check(f'diff {d[0]}', d[1], r['diff'], 1e-9); check(f'p hourly {d[0]}', d[2], r['ph'], 1e-9 if r['ph'] > 1e-12 else 1e-14); check(f'p daily {d[0]}', d[3], r['pd'], 1e-9)
        rh = np.mean([r['ph'] < 0.05 for r in ref]); rd = np.mean([r['pd'] < 0.05 for r in ref])
        check(f'rates w={w}', P['rates']['hourly'], rh, 1e-12); check(f'rates w={w}', P['rates']['daily'], rd, 1e-12)
        print(f'ok   placebo w={w}: {len(ref)} dates, hourly test {rh:.0%}, daily test {rd:.0%} significant')
    for c in out['cases']:
        f = pd.read_csv(pathlib.Path(tmp) / f"v{c['j']}.csv", parse_dates=['datetime'])
        f = f.set_index('datetime'); d = f['C6H6_ugm3'].resample('D').agg(['mean', 'count'])
        d['mean'] = d['mean'].where(d['count'] >= 18); per = f['period'].resample('D').first()
        diff = d['mean'][per == 'after'].mean() - d['mean'][per == 'before'].mean()
        p = stats.ttest_ind(d['mean'][per == 'after'].dropna(), d['mean'][per == 'before'].dropna(), equal_var=False)
        nb = {n['id']: n['value'] for n in c['notebook']}
        check('hours', nb['hours'], int(f['C6H6_ugm3'].notna().sum()), 0); check('diff', nb['diff'], diff, 1e-9); check('p', nb['p-daily'], p.pvalue, 1e-9)
        ci = p.confidence_interval(0.95); check('ci lo', c['daily']['ci'][0], ci.low, 1e-6); check('ci hi', c['daily']['ci'][1], ci.high, 1e-6)
        print(f"ok   {c['label']}: change {c['day']}, diff {diff:+.2f}, hourly p {c['hourly']['p']:.1e}, daily p {p.pvalue:.3f}, "
              f"larger at {c['rank']['larger']} of {c['rank']['n']} dates")
    print(f"student dates: {out['nCandidates']}")
print('all ok' if ok else 'MISMATCHES FOUND'); raise SystemExit(0 if ok else 1)
