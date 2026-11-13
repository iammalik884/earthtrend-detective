/* Runs the trend analysis pipeline and writes the plain-language verdict. */
(function (root) {
  'use strict';
  const S = root.ETStats, D = root.ETData;

  function fmt(v, d = 2) {
    if (v === null || v === undefined || !isFinite(v)) return '–';
    const a = Math.abs(v);
    if (a !== 0 && (a < 0.001 || a >= 1e5)) return v.toExponential(2);
    if (a < 0.1) d = Math.max(d, 3);
    return v.toFixed(d);
  }
  function fmtP(p) {
    if (p === null || p === undefined || !isFinite(p)) return '–';
    if (p < 0.0001) return '< 0.0001';
    return p.toFixed(4);
  }
  // "p < 0.0001" or "p = 0.0123"
  function pText(p) { const f = fmtP(p); return f.startsWith('<') ? `p ${f}` : `p = ${f}`; }
  function strength(p) {
    if (p < 0.01) return { key: 'strong', label: 'Highly significant', short: '99% confidence' };
    if (p < 0.05) return { key: 'sig', label: 'Significant', short: '95% confidence' };
    if (p < 0.10) return { key: 'weak', label: 'Weak evidence', short: '90% confidence' };
    return { key: 'none', label: 'Not significant', short: 'could be natural variability' };
  }

  // series: {dates, values} monthly; period: annual|DJF|...|m7|monthly
  function analyze(series, period, opts = {}) {
    const alpha = opts.alpha || 0.05;
    const r = { period, alpha };
    if (period === 'monthly') {
      const an = D.anomalies(series);
      r.x = an.x; r.y = an.y; r.dates = an.dates; r.clim = an.clim; r.mode = 'monthly';
      r.ols = S.ols(an.x, an.y, alpha);
      r.sen = S.theilSen(an.x, an.y, alpha);
      r.smk = S.seasonalMannKendall(D.seasonsMatrix(series), alpha);
      const annual = D.aggregate(series, 'annual');
      r.pettitt = S.pettitt(annual.y); r.pettittYears = annual.x;
      // primary decision: seasonal Mann-Kendall (robust to seasonality); slope from seasonal Sen
      r.primaryP = r.smk ? r.smk.p : (r.ols ? r.ols.pAdj : 1);
      r.primaryTest = 'Seasonal Mann-Kendall';
      r.slopePerYear = r.smk ? r.smk.slope : (r.sen ? r.sen.slope : NaN);
      r.slopeCI = r.sen ? [r.sen.ciLow, r.sen.ciHigh] : null;
      r.nYears = annual.x.length ? (annual.x[annual.x.length - 1] - annual.x[0] + 1) : 0;
      r.span = [Math.floor(an.x[0]), Math.floor(an.x[an.x.length - 1])];
      r.climSeries = series;
    } else {
      const ag = D.aggregate(series, period);
      r.x = ag.x; r.y = ag.y; r.mode = 'yearly';
      if (ag.x.length < 8) { r.error = 'Not enough complete years of data for this choice (need at least 8).'; return r; }
      r.ols = S.ols(ag.x, ag.y, alpha);
      r.sen = S.theilSen(ag.x, ag.y, alpha);
      r.mk = S.mannKendall(ag.y, alpha);
      r.mkm = S.mannKendallYueWang(ag.y, alpha);
      r.pettitt = S.pettitt(ag.y); r.pettittYears = ag.x;
      // primary decision: modified Mann-Kendall (no normality assumption, corrected for autocorrelation)
      r.primaryP = r.mkm ? r.mkm.p : r.mk.p;
      r.primaryTest = 'Modified Mann-Kendall (Yue–Wang)';
      r.slopePerYear = r.sen.slope;
      r.slopeCI = [r.sen.ciLow, r.sen.ciHigh];
      r.nYears = ag.x.length;
      r.span = [ag.x[0], ag.x[ag.x.length - 1]];
      r.yearsNeeded = S.yearsToSignificance(r.ols.slope, r.ols.residSd, alpha);
    }
    if (!r.ols) { r.error = 'Not enough data.'; return r; }
    r.strength = strength(r.primaryP);
    r.direction = r.slopePerYear > 0 ? 'increasing' : r.slopePerYear < 0 ? 'decreasing' : 'flat';
    r.totalChange = r.slopePerYear * (r.span[1] - r.span[0]);
    const base = r.mode === 'monthly' ? null : S.mean(r.y);
    r.baseMean = base;
    r.pctChange = base && Math.abs(base) > 1e-9 ? 100 * r.totalChange / Math.abs(base) : null;
    // agreement between parametric and non-parametric evidence
    const olsP = r.ols.pAdj;
    r.agree = (olsP < alpha) === (r.primaryP < alpha) && Math.sign(r.ols.slope) === Math.sign(r.slopePerYear);
    return r;
  }

  function verdictText(r, v, placeName, periodLabel) {
    if (r.error) return { headline: r.error, body: '' };
    const dec = r.slopePerYear * 10;
    const u = v.units;
    const dirWord = r.direction === 'increasing' ? 'rising' : r.direction === 'decreasing' ? 'falling' : 'flat';
    const ci = r.slopeCI ? `${fmt(r.slopeCI[0] * 10)} to ${fmt(r.slopeCI[1] * 10)} ${u} per decade` : '';
    let headline, body = [];
    if (r.strength.key === 'strong' || r.strength.key === 'sig') {
      headline = `${v.name} in ${placeName} is ${dirWord} — and the trend is statistically significant (${r.strength.short}).`;
    } else if (r.strength.key === 'weak') {
      headline = `${v.name} in ${placeName} may be ${dirWord}, but the evidence is only weak (${pText(r.primaryP)}).`;
    } else {
      headline = `No statistically significant trend in ${v.name.toLowerCase()} in ${placeName} (${pText(r.primaryP)}).`;
    }
    body.push(`<b>How much?</b> About <b>${fmt(dec)} ${u} per decade</b>${ci ? ` (95% confidence interval: ${ci})` : ''}, i.e. roughly <b>${fmt(r.totalChange)} ${u}</b> over ${r.span[0]}–${r.span[1]}${r.pctChange !== null ? ` (${r.pctChange > 0 ? '+' : ''}${fmt(r.pctChange, 1)}% of the average)` : ''}.`);
    body.push(`<b>Is it real?</b> The ${r.primaryTest} test gives ${pText(r.primaryP)}. ${r.primaryP < r.alpha ? `There is less than a ${(r.primaryP < 0.01 ? 1 : 5)}% chance of seeing a trend this strong if nothing were really changing.` : 'A trend this size could easily appear by chance from year-to-year ups and downs.'}`);
    if (r.slopeCI && r.slopeCI[0] < 0 && r.slopeCI[1] > 0) body.push('The confidence interval includes zero, so even the direction of change is uncertain.');
    body.push(r.agree ? '<b>Cross-check:</b> the regression t-test (adjusted for autocorrelation) agrees with the Mann-Kendall result.' :
      `<b>Cross-check:</b> the regression t-test (adjusted for autocorrelation, ${pText(r.ols.pAdj)}) does <i>not</i> fully agree — treat this result with caution.`);
    if (r.pettitt && r.pettitt.p < 0.05) {
      const yr = r.pettittYears[r.pettitt.index];
      body.push(`<b>Change point:</b> the Pettitt test detects a shift around <b>${yr}</b> (${pText(r.pettitt.p)}): average ${fmt(r.pettitt.meanBefore)} ${u} before vs ${fmt(r.pettitt.meanAfter)} ${u} after. The change may be a step rather than a steady trend.`);
    }
    if (r.mode === 'yearly' && r.strength.key !== 'strong' && r.strength.key !== 'sig' && r.yearsNeeded && isFinite(r.yearsNeeded) && r.yearsNeeded > r.nYears) {
      body.push(`<b>Detective tip:</b> if the current rate and year-to-year noise continue, about <b>${r.yearsNeeded} years</b> of data would be needed for this trend to become significant (we have ${r.nYears}).`);
    }
    return { headline, body: body.join('<br>') };
  }

  root.ETAnalysis = { analyze, verdictText, fmt, fmtP, pText, strength };
})(typeof window !== 'undefined' ? window : globalThis);
