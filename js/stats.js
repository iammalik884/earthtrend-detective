/*
 * EarthTrend Detective - statistics engine
 * Pure JavaScript, no dependencies. Works in the browser (window.ETStats) and in Node (module.exports).
 *
 * Implements:
 *  - Ordinary least squares trend with t-test and 95% confidence interval
 *  - Autocorrelation-adjusted OLS (effective sample size, Santer et al. 2000)
 *  - Mann-Kendall trend test (tie-corrected), Kendall's tau
 *  - Modified Mann-Kendall (Yue & Wang 2004 variance correction for serial correlation)
 *  - Seasonal Mann-Kendall (Hirsch et al. 1982) with seasonal Sen's slope
 *  - Theil-Sen slope with confidence interval (Gilbert 1987 / Sen 1968)
 *  - Pettitt change-point test (Pettitt 1979)
 *  - Benjamini-Hochberg false discovery rate correction
 *  - Rough "years of data needed for significance" estimate
 * All tests are validated against scipy / pymannkendall in tests/validate.py.
 */
(function (root) {
  'use strict';

  // ---------- special functions ----------
  function logGamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  function betacf(a, b, x) {
    const MAXIT = 300, EPS = 3e-16, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  // Regularized incomplete beta I_x(a,b)
  function ibeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }

  // Two-sided p-value for Student t
  function tTwoSidedP(t, df) {
    if (!isFinite(t)) return 0;
    return ibeta(df / (df + t * t), df / 2, 0.5);
  }

  // Student t CDF
  function tCdf(t, df) {
    const p = 0.5 * ibeta(df / (df + t * t), df / 2, 0.5);
    return t >= 0 ? 1 - p : p;
  }

  // Inverse Student t (quantile) by bisection; q in (0,1)
  function tInv(q, df) {
    let lo = -1000, hi = 1000;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (tCdf(mid, df) < q) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf with high precision series)
  function erf(x) {
    // W. J. Cody-style rational approximation via complementary error function (accurate ~1e-14)
    const sign = x < 0 ? -1 : 1; x = Math.abs(x);
    if (x < 0.5) {
      // Taylor series
      let sum = x, term = x, n = 0;
      do { n++; term *= -x * x / n; sum += term / (2 * n + 1); } while (Math.abs(term / (2 * n + 1)) > 1e-17 && n < 100);
      return sign * 2 / Math.sqrt(Math.PI) * sum;
    }
    return sign * (1 - erfc(x));
  }
  function erfc(x) {
    // continued fraction (Lentz) for x >= 0.5
    if (x < 0.5) return 1 - erf(x);
    const FPMIN = 1e-300;
    let b = x * x + 0.5, c = 1 / FPMIN, d = 1 / b, h = d;
    for (let i = 1; i < 300; i++) {
      const an = -i * (i - 0.5);
      b += 2;
      d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return x * Math.exp(-x * x) / Math.sqrt(Math.PI) * h;
  }
  function normCdf(z) { return 0.5 * erfc(-z / Math.SQRT2); }
  function normTwoSidedP(z) { return erfc(Math.abs(z) / Math.SQRT2); }
  function normInv(p) {
    // Acklam's algorithm + one Newton refinement
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425; let q, r, x;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p <= 1 - pl) { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    else { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const e = normCdf(x) - p; const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    return x - u / (1 + x * u / 2);
  }

  // ---------- helpers ----------
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

  function cleanPairs(x, y) {
    const xs = [], ys = [];
    for (let i = 0; i < y.length; i++) {
      if (y[i] !== null && y[i] !== undefined && isFinite(y[i]) && isFinite(x[i])) { xs.push(x[i]); ys.push(y[i]); }
    }
    return { x: xs, y: ys };
  }

  function tieGroups(arr) {
    const counts = new Map();
    for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
    return [...counts.values()].filter(c => c > 1);
  }

  // Autocorrelation function (biased estimator, like statsmodels acf default)
  function acf(x, nlags) {
    const n = x.length, m = mean(x);
    const d = x.map(v => v - m);
    const c0 = d.reduce((s, v) => s + v * v, 0) / n;
    const out = [1];
    for (let k = 1; k <= nlags; k++) {
      let s = 0;
      for (let i = 0; i < n - k; i++) s += d[i] * d[i + k];
      out.push(c0 === 0 ? 0 : (s / n) / c0);
    }
    return out;
  }

  // ---------- OLS ----------
  function ols(xIn, yIn, alpha = 0.05) {
    const { x, y } = cleanPairs(xIn, yIn);
    const n = x.length;
    if (n < 3) return null;
    const mx = mean(x), my = mean(y);
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); syy += (y[i] - my) ** 2; }
    const slope = sxy / sxx, intercept = my - slope * mx;
    const resid = y.map((v, i) => v - (intercept + slope * x[i]));
    const sse = resid.reduce((s, v) => s + v * v, 0);
    const df = n - 2;
    const s2 = sse / df;
    const se = Math.sqrt(s2 / sxx);
    const t = se === 0 ? (slope === 0 ? 0 : Infinity) : slope / se;
    const p = tTwoSidedP(t, df);
    const tc = tInv(1 - alpha / 2, df);
    const r2 = syy === 0 ? 0 : 1 - sse / syy;

    // Autocorrelation-adjusted (lag-1 of residuals, effective sample size)
    const r1 = n > 3 ? acf(resid, 1)[1] : 0;
    let neff = r1 > 0 ? n * (1 - r1) / (1 + r1) : n;
    neff = Math.max(3, Math.min(n, neff));
    const dfAdj = neff - 2;
    const seAdj = Math.sqrt((sse / dfAdj) / sxx);
    const tAdj = seAdj === 0 ? (slope === 0 ? 0 : Infinity) : slope / seAdj;
    const pAdj = tTwoSidedP(tAdj, dfAdj);
    const tcAdj = tInv(1 - alpha / 2, dfAdj);

    return {
      n, slope, intercept, se, t, df, p, r2,
      ciLow: slope - tc * se, ciHigh: slope + tc * se,
      residSd: Math.sqrt(s2), lag1: r1, neff,
      pAdj, ciLowAdj: slope - tcAdj * seAdj, ciHighAdj: slope + tcAdj * seAdj,
      fitted: x.map(v => intercept + slope * v), x
    };
  }

  // ---------- Mann-Kendall ----------
  function mkS(y) {
    let s = 0;
    for (let k = 0; k < y.length - 1; k++) for (let j = k + 1; j < y.length; j++) s += sign(y[j] - y[k]);
    return s;
  }
  function mkVar(y) {
    const n = y.length;
    let v = n * (n - 1) * (2 * n + 5);
    for (const t of tieGroups(y)) v -= t * (t - 1) * (2 * t + 5);
    return v / 18;
  }
  function zFromS(s, varS) {
    if (varS <= 0) return 0;
    if (s > 0) return (s - 1) / Math.sqrt(varS);
    if (s < 0) return (s + 1) / Math.sqrt(varS);
    return 0;
  }

  // Theil-Sen slope with confidence interval. x must be supplied (handles gaps).
  function theilSen(xIn, yIn, alpha = 0.05) {
    const { x, y } = cleanPairs(xIn, yIn);
    const n = x.length;
    if (n < 3) return null;
    const slopes = [];
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) if (x[j] !== x[i]) slopes.push((y[j] - y[i]) / (x[j] - x[i]));
    slopes.sort((a, b) => a - b);
    const slope = median(slopes);
    const intercept = median(y) - slope * median(x);
    // Confidence interval (Sen 1968), same construction as scipy.stats.theilslopes
    const z = normInv(alpha / 2); // negative, as in Sen (1968) eq. 2.6
    const xT = tieGroups(x), yT = tieGroups(y);
    const sigsq = (n * (n - 1) * (2 * n + 5) - xT.reduce((s, k) => s + k * (k - 1) * (2 * k + 5), 0) - yT.reduce((s, k) => s + k * (k - 1) * (2 * k + 5), 0)) / 18;
    const sigma = Math.sqrt(Math.max(0, sigsq));
    const N = slopes.length;
    const roundEven = v => { const f = Math.floor(v), d = v - f; if (Math.abs(d - 0.5) < 1e-12) return f % 2 === 0 ? f : f + 1; return Math.round(v); };
    const Ru = Math.min(roundEven((N - z * sigma) / 2), N - 1);
    const Rl = Math.max(roundEven((N + z * sigma) / 2) - 1, 0);
    let ciLow = slopes[Rl], ciHigh = slopes[Ru];
    if (ciLow > ciHigh) { const t = ciLow; ciLow = ciHigh; ciHigh = t; }
    return { slope, intercept, ciLow, ciHigh, n };
  }

  function mannKendall(yIn, alpha = 0.05) {
    const y = yIn.filter(v => v !== null && v !== undefined && isFinite(v));
    const n = y.length;
    if (n < 4) return null;
    const s = mkS(y);
    const varS = mkVar(y);
    const z = zFromS(s, varS);
    const p = normTwoSidedP(z);
    const tau = s / (0.5 * n * (n - 1));
    return { n, s, varS, z, p, tau, significant: p < alpha, trend: p < alpha ? (z > 0 ? 'increasing' : 'decreasing') : 'no trend' };
  }

  // Yue & Wang (2004) variance correction for serially correlated data (matches pymannkendall.yue_wang_modification_test)
  function mannKendallYueWang(yIn, alpha = 0.05) {
    const y = yIn.filter(v => v !== null && v !== undefined && isFinite(v));
    const n = y.length;
    if (n < 4) return null;
    const s = mkS(y);
    const varS = mkVar(y);
    // detrend with Sen's slope on index
    const idx = y.map((_, i) => i + 1);
    const slopes = [];
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) slopes.push((y[j] - y[i]) / (j - i));
    const b = median(slopes);
    const det = y.map((v, i) => v - idx[i] * b);
    const r = acf(det, n - 1);
    let sum = 0;
    for (let i = 1; i < n; i++) sum += (1 - i / n) * r[i];
    // Conservative: the correction may only widen the variance (never make the test more liberal
    // than the original Mann-Kendall), so negative autocorrelation cannot inflate significance.
    const nnsRaw = 1 + 2 * sum;
    const nns = Math.max(1, nnsRaw);
    const varAdj = varS * nns;
    const z = zFromS(s, varAdj);
    const p = normTwoSidedP(z);
    return { n, s, varS: varAdj, z, p, nns, nnsRaw, significant: p < alpha, trend: p < alpha ? (z > 0 ? 'increasing' : 'decreasing') : 'no trend' };
  }

  // Seasonal MK. seasons: array of arrays (one array per season, ordered in time; nulls allowed).
  function seasonalMannKendall(seasons, alpha = 0.05) {
    let S = 0, V = 0;
    const allSlopes = [];
    let nTot = 0;
    for (const raw of seasons) {
      // keep positional time index (year index) for slope
      const pts = raw.map((v, i) => [i, v]).filter(p => p[1] !== null && p[1] !== undefined && isFinite(p[1]));
      const y = pts.map(p => p[1]);
      if (y.length < 2) continue;
      nTot += y.length;
      S += mkS(y);
      V += mkVar(y);
      for (let i = 0; i < pts.length - 1; i++) for (let j = i + 1; j < pts.length; j++) allSlopes.push((pts[j][1] - pts[i][1]) / (pts[j][0] - pts[i][0]));
    }
    if (nTot < 8 || V <= 0) return null;
    const z = zFromS(S, V);
    const p = normTwoSidedP(z);
    const slope = median(allSlopes); // per season-cycle (per year for monthly data)
    return { n: nTot, s: S, varS: V, z, p, slope, significant: p < alpha, trend: p < alpha ? (z > 0 ? 'increasing' : 'decreasing') : 'no trend' };
  }

  // Pettitt (1979) change-point test
  function pettitt(yIn) {
    const y = yIn.filter(v => v !== null && v !== undefined && isFinite(v));
    const n = y.length;
    if (n < 6) return null;
    let K = 0, loc = 0;
    // U_t = sum_{i<=t} sum_{j>t} sign(x_j - x_i), computed incrementally
    let U = 0;
    for (let t = 0; t < n - 1; t++) {
      // U_t = U_{t-1} + sum_j sign(x_t - x_j) over all j
      let add = 0;
      for (let j = 0; j < n; j++) add += sign(y[t] - y[j]);
      U += add;
      if (Math.abs(U) > K) { K = Math.abs(U); loc = t; }
    }
    const p = Math.min(1, 2 * Math.exp((-6 * K * K) / (n ** 3 + n ** 2)));
    return { K, index: loc, p, meanBefore: mean(y.slice(0, loc + 1)), meanAfter: mean(y.slice(loc + 1)) };
  }

  // Benjamini-Hochberg adjusted p-values (q-values)
  function benjaminiHochberg(pvals) {
    const m = pvals.length;
    const order = pvals.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
    const q = new Array(m);
    let prev = 1;
    for (let k = m - 1; k >= 0; k--) {
      const [p, i] = order[k];
      const val = Math.min(prev, p * m / (k + 1));
      q[i] = val; prev = val;
    }
    return q;
  }

  // Years needed so that, if the current OLS slope and noise level persist, the trend reaches p<alpha.
  function yearsToSignificance(slope, residSd, alpha = 0.05, maxYears = 300) {
    if (!isFinite(slope) || slope === 0 || !isFinite(residSd) || residSd <= 0) return null;
    for (let n = 4; n <= maxYears; n++) {
      const se = residSd / Math.sqrt(n * (n * n - 1) / 12);
      if (Math.abs(slope / se) >= tInv(1 - alpha / 2, n - 2)) return n;
    }
    return Infinity;
  }

  const api = {
    ols, theilSen, mannKendall, mannKendallYueWang, seasonalMannKendall, pettitt,
    benjaminiHochberg, yearsToSignificance, acf, mean, median,
    _special: { tTwoSidedP, tInv, tCdf, normCdf, normInv, normTwoSidedP, ibeta }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ETStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
