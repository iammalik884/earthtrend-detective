"""Validate js/stats.js against scipy and pymannkendall on many random series.
Run: python3 tests/validate.py
"""
import json, subprocess, os, sys
import numpy as np
from scipy import stats
import pymannkendall as mk

HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(42)

cases = []
for k in range(60):
    n = int(rng.integers(12, 60))
    x = np.arange(1981, 1981 + n, dtype=float)
    trend = rng.normal(0, 0.05)
    phi = rng.uniform(-0.3, 0.7)
    e = np.zeros(n)
    for i in range(1, n):
        e[i] = phi * e[i - 1] + rng.normal(0, 1)
    y = 10 + trend * (x - x[0]) + e
    if k % 5 == 0:  # introduce ties
        y = np.round(y, 0)
    cases.append({"x": x.tolist(), "y": y.tolist()})

# seasonal cases (monthly)
scases = []
for k in range(20):
    years = int(rng.integers(10, 40))
    m = np.array([[10 + 5 * np.sin(2 * np.pi * mo / 12) + 0.03 * yr + rng.normal(0, 1) for mo in range(12)] for yr in range(years)])
    if k % 4 == 0:
        m = np.round(m, 0)
    scases.append(m.tolist())

js = r"""
const S=require(process.argv[1]);
const data=JSON.parse(require('fs').readFileSync(0,'utf8'));
const out={cases:data.cases.map(c=>{const o=S.ols(c.x,c.y);const t=S.theilSen(c.x,c.y);const m=S.mannKendall(c.y);const yw=S.mannKendallYueWang(c.y);const pt=S.pettitt(c.y);
 return {slope:o.slope,p:o.p,ciL:o.ciLow,ciH:o.ciHigh,r2:o.r2,ts:t.slope,tsL:t.ciLow,tsH:t.ciHigh,mkS:m.s,mkZ:m.z,mkP:m.p,tau:m.tau,ywP:yw.p,ywZ:yw.z,ptK:pt.K,ptI:pt.index,ptP:pt.p}}),
 seasonal:data.scases.map(m=>{const seasons=[];for(let mo=0;mo<12;mo++)seasons.push(m.map(r=>r[mo]));const r=S.seasonalMannKendall(seasons);return {s:r.s,z:r.z,p:r.p,slope:r.slope}}),
 bh:S.benjaminiHochberg(data.pv)};
console.log(JSON.stringify(out));
"""
pv = rng.uniform(0, 0.2, 25).tolist()
res = subprocess.run(["node", "-e", js, os.path.join(HERE, "..", "js", "stats.js")], input=json.dumps({"cases": cases, "scases": scases, "pv": pv}), capture_output=True, text=True)
if res.returncode:
    print(res.stderr); sys.exit(1)
out = json.loads(res.stdout)

def pettitt_ref(x):
    n = len(x)
    U = [sum(np.sign(x[j] - x[i]) for i in range(t + 1) for j in range(t + 1, n)) for t in range(n - 1)]
    K = max(abs(u) for u in U)
    loc = int(np.argmax(np.abs(U)))
    p = min(1, 2 * np.exp(-6 * K**2 / (n**3 + n**2)))
    return K, loc, p

maxerr = {}
def chk(name, a, b, tol):
    err = abs(a - b) / max(1.0, abs(b))
    maxerr[name] = max(maxerr.get(name, 0), err)
    if err > tol:
        print(f"FAIL {name}: js={a} ref={b}")
        return False
    return True

ok = True
for c, o in zip(cases, out["cases"]):
    x, y = np.array(c["x"]), np.array(c["y"])
    lr = stats.linregress(x, y)
    tcrit = stats.t.ppf(0.975, len(x) - 2)
    ok &= chk("ols_slope", o["slope"], lr.slope, 1e-9)
    ok &= chk("ols_p", o["p"], lr.pvalue, 1e-7)
    ok &= chk("ols_ciL", o["ciL"], lr.slope - tcrit * lr.stderr, 1e-7)
    ok &= chk("ols_ciH", o["ciH"], lr.slope + tcrit * lr.stderr, 1e-7)
    ok &= chk("r2", o["r2"], lr.rvalue**2, 1e-9)
    ts = stats.theilslopes(y, x, alpha=0.95)
    ok &= chk("ts_slope", o["ts"], ts.slope, 1e-9)
    ok &= chk("ts_low", o["tsL"], ts.low_slope, 1e-9)
    ok &= chk("ts_high", o["tsH"], ts.high_slope, 1e-9)
    r = mk.original_test(y)
    ok &= chk("mk_s", o["mkS"], r.s, 1e-12)
    ok &= chk("mk_z", o["mkZ"], r.z, 1e-9)
    ok &= chk("mk_p", o["mkP"], r.p, 1e-8)
    ok &= chk("mk_tau", o["tau"], r.Tau, 1e-9)
    yw = mk.yue_wang_modification_test(y)
    # our version never makes the test more liberal than the original MK (variance factor floored at 1)
    ref_p = max(yw.p, r.p); ref_z = yw.z if yw.p >= r.p else r.z
    ok &= chk("yw_z", o["ywZ"], ref_z, 1e-6)
    ok &= chk("yw_p", o["ywP"], ref_p, 1e-6)
    K, loc, p = pettitt_ref(y)
    ok &= chk("pettitt_K", o["ptK"], K, 1e-12)
    ok &= chk("pettitt_loc", o["ptI"], loc, 1e-12)
    ok &= chk("pettitt_p", o["ptP"], p, 1e-9)

for m, o in zip(scases, out["seasonal"]):
    flat = np.array(m).flatten()
    r = mk.seasonal_test(flat, period=12)
    ok &= chk("smk_s", o["s"], r.s, 1e-12)
    ok &= chk("smk_z", o["z"], r.z, 1e-9)
    ok &= chk("smk_p", o["p"], r.p, 1e-8)
    ok &= chk("smk_slope", o["slope"], r.slope, 1e-9)

from scipy.stats import false_discovery_control
ref_q = false_discovery_control(pv, method="bh")
for a, b in zip(out["bh"], ref_q):
    ok &= chk("bh_q", a, b, 1e-12)

print("max relative errors:")
for k, v in maxerr.items():
    print(f"  {k:12s} {v:.2e}")
print("ALL TESTS PASSED" if ok else "SOME TESTS FAILED")
sys.exit(0 if ok else 1)
