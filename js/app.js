/* EarthTrend Detective — user interface */
(function () {
  'use strict';
  const { VARIABLES, THEMES, ARCHETYPES, PERIODS, byId } = window.ETVars;
  const D = window.ETData, A = window.ETAnalysis, S = window.ETStats, C = window.ETContent;
  const $ = id => document.getElementById(id);
  const fmt = A.fmt, fmtP = A.fmtP, pText = A.pText;

  const END = D.lastCompleteYear();
  const state = { lat: 32.08, lon: 72.67, place: 'Sargodha, Pakistan', theme: 'heat', varId: 'T2M', period: 'annual', startYear: D.FIRST_YEAR, endYear: END, last: null };

  const PLOT_LAYOUT = {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: '#cfd8ec', size: 12 },
    margin: { l: 60, r: 20, t: 10, b: 45 }, legend: { orientation: 'h', y: -0.18 },
    xaxis: { gridcolor: '#26324f', zerolinecolor: '#26324f' }, yaxis: { gridcolor: '#26324f', zerolinecolor: '#26324f' }
  };
  const PLOT_CFG = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };

  // ---------- tabs ----------
  function showTab(name) {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
    if (name === 'map') setTimeout(() => tmap.invalidateSize(), 50);
    if (name === 'investigate') setTimeout(() => map.invalidateSize(), 50);
    if (name === 'scanner') $('scanLoc').textContent = `${state.place} (${state.lat.toFixed(2)}, ${state.lon.toFixed(2)})`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  document.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); showTab(a.dataset.goto); }));

  // ---------- location ----------
  // Basemap with automatic fallback (Esri dark gray -> OpenStreetMap) if tiles fail to load
  function addBasemap(m) {
    const layer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxZoom: 16 }).addTo(m);
    let errors = 0, switched = false;
    layer.on('tileerror', () => {
      if (switched || ++errors < 4) return;
      switched = true; m.removeLayer(layer);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(m);
    });
  }
  const map = L.map('map', { worldCopyJump: true }).setView([state.lat, state.lon], 4);
  addBasemap(map);
  const marker = L.marker([state.lat, state.lon]).addTo(map);

  function setLocation(lat, lon, place, zoom) {
    state.lat = Math.max(-90, Math.min(90, +lat));
    state.lon = ((+lon + 540) % 360) - 180;
    state.place = place || `${state.lat.toFixed(2)}°, ${state.lon.toFixed(2)}°`;
    $('lat').value = state.lat.toFixed(2); $('lon').value = state.lon.toFixed(2);
    marker.setLatLng([state.lat, state.lon]);
    map.setView([state.lat, state.lon], zoom || Math.max(map.getZoom(), 4), { animate: false });
    const match = C.PLACES.findIndex(p => p.name === place);
    $('preset').value = match >= 0 ? String(match) : '';
  }
  map.on('click', e => setLocation(e.latlng.lat, e.latlng.lng, null));
  $('preset').innerHTML = '<option value="">— choose a place —</option>' + C.PLACES.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
  $('preset').addEventListener('change', e => {
    const p = C.PLACES[+e.target.value]; if (!p) return;
    setLocation(p.lat, p.lon, p.name, 6);
    $('archetype').value = p.type; onArchetype();
  });
  ['lat', 'lon'].forEach(id => $(id).addEventListener('change', () => {
    const la = parseFloat($('lat').value), lo = parseFloat($('lon').value);
    if (isFinite(la) && isFinite(lo)) setLocation(la, lo, null);
  }));

  $('archetype').innerHTML += ARCHETYPES.map(a => `<option value="${a.id}">${a.label}</option>`).join('');
  function onArchetype() {
    const a = ARCHETYPES.find(x => x.id === $('archetype').value);
    if (!a) { $('archetypeHint').innerHTML = ''; return; }
    $('archetypeHint').innerHTML = `💡 ${a.hint}<br>Suggested: ${a.vars.map(v => `<a href="#" data-var="${v}">${byId[v].name}</a>`).join(' · ')}`;
    $('archetypeHint').querySelectorAll('a').forEach(el => el.addEventListener('click', e => { e.preventDefault(); selectVariable(el.dataset.var); }));
  }
  $('archetype').addEventListener('change', onArchetype);

  // ---------- themes & variables ----------
  $('themes').innerHTML = THEMES.map(t => `<button class="chip" data-theme="${t.id}" title="${t.question}">${t.icon} ${t.label}</button>`).join('');
  $('themes').querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    state.theme = c.dataset.theme;
    const first = VARIABLES.find(v => v.theme === state.theme);
    renderVarSelect(); selectVariable(first.id);
  }));
  function renderVarSelect() {
    $('themes').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.theme === state.theme));
    const groups = THEMES.map(t => `<optgroup label="${t.icon} ${t.label}">${VARIABLES.filter(v => v.theme === t.id).map(v => `<option value="${v.id}">${v.name}</option>`).join('')}</optgroup>`);
    $('variable').innerHTML = groups.join('');
  }
  function selectVariable(id) {
    const v = byId[id]; if (!v) return;
    state.varId = id; state.theme = v.theme;
    renderVarSelect();
    $('variable').value = id;
    $('varcard').innerHTML = `<b>${v.name}</b> <span class="muted">(${v.units})</span><br>${v.simple}<br><i>Why it matters:</i> ${v.why}<div class="src">Source: ${v.source}</div>`;
    if (v.provider === 'modis' && state.startYear < 2001) { state.startYear = 2001; $('startYear').value = 2001; }
    else if (v.provider !== 'modis' && +$('startYear').value === 2001) { state.startYear = D.FIRST_YEAR; $('startYear').value = D.FIRST_YEAR; }
  }
  $('variable').addEventListener('change', e => selectVariable(e.target.value));

  const periodOptions = PERIODS.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
  $('period').innerHTML = periodOptions;
  $('scanPeriod').innerHTML = PERIODS.filter(p => p.id !== 'monthly').map(p => `<option value="${p.id}">${p.label}</option>`).join('');
  $('mapPeriod').innerHTML = PERIODS.filter(p => p.id !== 'monthly').map(p => `<option value="${p.id}">${p.label}</option>`).join('');
  $('mapVar').innerHTML = THEMES.map(t => `<optgroup label="${t.icon} ${t.label}">${VARIABLES.filter(v => v.theme === t.id && v.provider === 'power').map(v => `<option value="${v.id}">${v.name}</option>`).join('')}</optgroup>`).join('');
  $('startYear').value = state.startYear; $('endYear').value = state.endYear;
  $('startYear').min = $('endYear').min = D.FIRST_YEAR; $('startYear').max = $('endYear').max = END;

  // ---------- helpers ----------
  function setProgress(id, frac) {
    const el = $(id); if (frac === null) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.firstElementChild.style.width = Math.round(frac * 100) + '%';
  }
  function setStatus(id, msg, isErr) { $(id).innerHTML = msg; $(id).classList.toggle('error', !!isErr); }
  const periodLabel = id => (PERIODS.find(p => p.id === id) || {}).label || id;

  async function getSeries(varId, lat, lon, progressId) {
    const v = byId[varId];
    if (v.provider === 'modis') {
      const r = await D.modisNDVI(lat, lon, f => setProgress(progressId, f));
      return { series: r.series.NDVI, meta: r.meta };
    }
    const r = await D.powerPoint(lat, lon, [varId]);
    if (!r.series[varId]) throw new Error('Variable not returned by NASA POWER.');
    return { series: r.series[varId], meta: r.meta };
  }

  // ---------- investigate ----------
  async function investigate() {
    state.period = $('period').value;
    state.startYear = Math.max(D.FIRST_YEAR, Math.min(END, parseInt($('startYear').value) || D.FIRST_YEAR));
    state.endYear = Math.max(state.startYear, Math.min(END, parseInt($('endYear').value) || END));
    if (state.endYear - state.startYear < 9) { setStatus('status', 'Please choose at least 10 years — trends need a long record.', true); return; }
    const v = byId[state.varId];
    $('runBtn').disabled = true;
    setStatus('status', v.provider === 'modis' ? '🛰️ Downloading MODIS greenness from NASA (about 600 satellite composites)…' : '🛰️ Downloading data from NASA POWER…');
    setProgress('prog', 0.15);
    try {
      const { series: full, meta } = await getSeries(state.varId, state.lat, state.lon, 'prog');
      const series = D.clipYears(full, state.startYear, state.endYear);
      setProgress('prog', 0.9);
      const r = A.analyze(series, state.period, { ratioScale: v.units !== '°C' });
      state.last = { r, v, series, meta, place: state.place, period: state.period, lat: state.lat, lon: state.lon };
      renderResults();
      updateHash();
      setStatus('status', `✅ Done — ${series.values.filter(x => x !== null).length} monthly values analysed.`);
    } catch (e) {
      console.error(e);
      setStatus('status', `⚠️ Could not get data: ${e.message}. NASA servers can be busy — please try again in a moment.`, true);
    } finally {
      $('runBtn').disabled = false; setTimeout(() => setProgress('prog', null), 600);
    }
  }
  $('runBtn').addEventListener('click', investigate);

  function renderResults() {
    const { r, v, series, meta, place, period } = state.last;
    $('welcome').hidden = true; $('out').hidden = false; $('tourBox').hidden = true;
    const t = A.verdictText(r, v, place, periodLabel(period));
    const vEl = $('verdict');
    vEl.className = 'card verdict ' + (r.strength ? r.strength.key : 'none');
    if (r.error) { vEl.innerHTML = `<h3>${t.headline}</h3>`; Plotly.purge('chartMain'); return; }
    const dec = r.slopePerYear * 10;
    vEl.innerHTML = `<span class="badge ${r.strength.key}">${r.strength.label} · ${pText(r.primaryP)}</span>
      <h3>${t.headline}</h3>
      <div class="kpis">
        <div class="kpi"><div class="v ${dec > 0 ? 'up' : 'down'}">${dec > 0 ? '+' : ''}${fmt(dec)}</div><div class="l">${v.units} per decade (Theil–Sen)</div></div>
        <div class="kpi"><div class="v">${r.slopeCI ? fmt(r.slopeCI[0] * 10) + ' … ' + fmt(r.slopeCI[1] * 10) : '–'}</div><div class="l">95% confidence interval / decade</div></div>
        <div class="kpi"><div class="v">${r.totalChange > 0 ? '+' : ''}${fmt(r.totalChange)}</div><div class="l">${v.units} total change ${r.span[0]}–${r.span[1]}</div></div>
        <div class="kpi"><div class="v">${r.nYears}</div><div class="l">years analysed · ${periodLabel(period).toLowerCase()}</div></div>
      </div>
      <div class="body">${t.body}</div>`;

    // main chart
    $('chartTitle').textContent = `${v.name} — ${place} — ${periodLabel(period)}`;
    const traces = [];
    const yTitle = r.mode === 'monthly' ? `Anomaly (${v.units})` : `${v.name} (${v.units})`;
    traces.push({ x: r.x, y: r.y, type: 'scatter', mode: r.mode === 'monthly' ? 'lines' : 'lines+markers', name: r.mode === 'monthly' ? 'Monthly anomaly' : 'Observed (NASA)', line: { color: '#4cc9f0', width: r.mode === 'monthly' ? 1 : 2 }, marker: { size: 6 } });
    if (r.mode === 'monthly') {
      const roll = r.y.map((_, i) => i < 11 ? null : S.mean(r.y.slice(i - 11, i + 1)));
      traces.push({ x: r.x, y: roll, type: 'scatter', mode: 'lines', name: '12-month running mean', line: { color: '#ffd166', width: 2.5 } });
    }
    const x0 = r.x[0], x1 = r.x[r.x.length - 1];
    const senInt = r.mode === 'monthly' ? (S.median(r.y) - r.slopePerYear * S.median(r.x)) : r.sen.intercept;
    traces.push({ x: [x0, x1], y: [senInt + r.slopePerYear * x0, senInt + r.slopePerYear * x1], type: 'scatter', mode: 'lines', name: `Theil–Sen trend (${dec > 0 ? '+' : ''}${fmt(dec)} ${v.units}/decade)`, line: { color: '#f72585', width: 3 } });
    if (r.slopeCI) {
      // Band between the lowest and highest plausible slopes, pivoting on the series' median point
      const xm = S.median(r.x), ym = senInt + r.slopePerYear * xm;
      const lineAt = (s, x) => ym + s * (x - xm);
      const up0 = Math.max(lineAt(r.slopeCI[0], x0), lineAt(r.slopeCI[1], x0)), lo0 = Math.min(lineAt(r.slopeCI[0], x0), lineAt(r.slopeCI[1], x0));
      const up1 = Math.max(lineAt(r.slopeCI[0], x1), lineAt(r.slopeCI[1], x1)), lo1 = Math.min(lineAt(r.slopeCI[0], x1), lineAt(r.slopeCI[1], x1));
      traces.push({ x: [x0, xm, x1, x1, xm, x0, x0], y: [up0, ym, up1, lo1, ym, lo0, up0],
        type: 'scatter', mode: 'lines', fill: 'toself', fillcolor: 'rgba(247,37,133,0.12)', line: { width: 0 }, name: '95% CI of trend slope', hoverinfo: 'skip' });
    }
    traces.push({ x: [x0, x1], y: [r.ols.intercept + r.ols.slope * x0, r.ols.intercept + r.ols.slope * x1], type: 'scatter', mode: 'lines', name: 'Least-squares line', line: { color: '#cfd8ec', width: 1.5, dash: 'dash' } });
    const shapes = [];
    if (r.pettitt && r.pettitt.p < 0.05) {
      const cy = r.pettittYears[r.pettitt.index] + 0.5;
      shapes.push({ type: 'line', x0: cy, x1: cy, yref: 'paper', y0: 0, y1: 1, line: { color: '#ffb703', width: 2, dash: 'dot' } });
      if (r.mode === 'yearly') {
        traces.push({ x: [x0, cy], y: [r.pettitt.meanBefore, r.pettitt.meanBefore], mode: 'lines', name: `Change point ≈ ${Math.floor(cy)} (Pettitt)`, line: { color: '#ffb703', width: 2 } });
        traces.push({ x: [cy, x1], y: [r.pettitt.meanAfter, r.pettitt.meanAfter], mode: 'lines', showlegend: false, line: { color: '#ffb703', width: 2 } });
      }
    }
    Plotly.newPlot('chartMain', traces, { ...PLOT_LAYOUT, shapes, yaxis: { ...PLOT_LAYOUT.yaxis, title: yTitle }, xaxis: { ...PLOT_LAYOUT.xaxis, title: 'Year' } }, PLOT_CFG);

    // seasonal comparison chart: first third vs last third
    const yrs = [...new Set(series.dates.map(d => +d.slice(0, 4)))];
    const k = Math.max(5, Math.floor(yrs.length / 3));
    const early = yrs.slice(0, k), late = yrs.slice(-k);
    const climFor = set => { const s = new Array(12).fill(0), c = new Array(12).fill(0); series.dates.forEach((d, i) => { const y = +d.slice(0, 4), m = +d.slice(5, 7) - 1, val = series.values[i]; if (set.includes(y) && val !== null) { s[m] += val; c[m]++; } }); return s.map((x, i) => c[i] ? x / c[i] : null); };
    const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const ce = climFor(early), cl = climFor(late);
    Plotly.newPlot('chartSeason', [
      { x: mn, y: ce, name: `${early[0]}–${early[early.length - 1]}`, type: 'scatter', mode: 'lines+markers', line: { color: '#7cc6ff' } },
      { x: mn, y: cl, name: `${late[0]}–${late[late.length - 1]}`, type: 'scatter', mode: 'lines+markers', line: { color: '#ff8fa3' } },
      { x: mn, y: cl.map((v2, i) => v2 !== null && ce[i] !== null ? v2 - ce[i] : null), name: 'Difference (late − early)', type: 'bar', yaxis: 'y2', marker: { color: 'rgba(255,209,102,0.45)' } }
    ], { ...PLOT_LAYOUT, yaxis: { ...PLOT_LAYOUT.yaxis, title: v.units }, yaxis2: { overlaying: 'y', side: 'right', title: 'difference', showgrid: false, zeroline: true, zerolinecolor: '#666' }, margin: { ...PLOT_LAYOUT.margin, r: 60 } }, PLOT_CFG);

    // stats table
    const rows = [];
    rows.push(['Theil–Sen slope', `${fmt(r.slopePerYear * 10)} ${v.units}/decade`, r.slopeCI ? `95% CI ${fmt(r.slopeCI[0] * 10)} to ${fmt(r.slopeCI[1] * 10)}` : '', 'Median of all pairwise slopes; robust to outliers.']);
    if (r.mode === 'yearly') {
      rows.push(['Mann–Kendall (original)', `S = ${r.mk.s}, Z = ${fmt(r.mk.z)}, τ = ${fmt(r.mk.tau)}`, `${pText(r.mk.p)}`, 'Rank-based test; no normality assumption.']);
      rows.push(['Modified Mann–Kendall (Yue–Wang) ★', `Z = ${fmt(r.mkm.z)}, variance factor = ${fmt(r.mkm.nns)}`, `${pText(r.mkm.p)}`, 'Main test. Corrects for autocorrelation.']);
    } else {
      rows.push(['Seasonal Mann–Kendall ★', `S = ${r.smk.s}, Z = ${fmt(r.smk.z)}`, `${pText(r.smk.p)}`, 'Main test. Compares each calendar month across years.']);
    }
    rows.push(['Linear regression (OLS) t-test', `${fmt(r.ols.slope * 10)} ${v.units}/decade, t = ${fmt(r.ols.t)}, R² = ${fmt(r.ols.r2)}`, `${pText(r.ols.p)} · 95% CI ${fmt(r.ols.ciLow * 10)} to ${fmt(r.ols.ciHigh * 10)}`, 'Classic test; assumes independent, normally distributed residuals.']);
    rows.push(['OLS adjusted for autocorrelation', `lag-1 r = ${fmt(r.ols.lag1)}, effective n = ${fmt(r.ols.neff, 1)} of ${r.ols.n}`, `${pText(r.ols.pAdj)} · 95% CI ${fmt(r.ols.ciLowAdj * 10)} to ${fmt(r.ols.ciHighAdj * 10)}`, 'Santer et al. (2000) effective sample size.']);
    if (r.pettitt) rows.push(['Pettitt change point', `K = ${r.pettitt.K}, most likely after ${r.pettittYears[r.pettitt.index]}`, `${pText(r.pettitt.p)}`, 'Tests for a sudden step change.']);
    if (r.mode === 'yearly' && r.yearsNeeded && r.primaryP >= r.alpha && r.yearsNeeded > r.nYears) rows.push(['Years needed for significance', isFinite(r.yearsNeeded) ? `≈ ${r.yearsNeeded} years` : '> 300 years', `have ${r.nYears}`, 'If current rate and noise persist (OLS-based estimate).']);
    $('statsTable').innerHTML = '<tr><th>Test</th><th>Result</th><th>Significance</th><th>What it means</th></tr>' + rows.map(rw => `<tr>${rw.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    $('dataNote').innerHTML = `Data: ${v.source}. Location ${state.last.lat.toFixed(2)}°, ${state.last.lon.toFixed(2)}°${meta && meta.elevation ? `, grid elevation ${Math.round(meta.elevation)} m` : ''}. ★ = test used for the verdict. Significance level α = 0.05.`;
  }

  function toCSV() {
    const { r, v, series, place, period, lat, lon } = state.last;
    const lines = [];
    lines.push(`# EarthTrend Detective export`);
    lines.push(`# Place,${place.replace(/,/g, ' ')},lat,${lat},lon,${lon}`);
    lines.push(`# Variable,${v.id},${v.name},units,${v.units}`);
    lines.push(`# Source,${v.source.replace(/,/g, ';')}`);
    lines.push(`# Period,${periodLabel(period)}`);
    if (!r.error) {
      lines.push(`# Theil-Sen slope per decade,${r.slopePerYear * 10},CI95,${r.slopeCI ? r.slopeCI[0] * 10 : ''},${r.slopeCI ? r.slopeCI[1] * 10 : ''}`);
      lines.push(`# Main test,${r.primaryTest},p,${r.primaryP}`);
      lines.push(`# OLS slope per decade,${r.ols.slope * 10},p,${r.ols.p},p_autocorr_adjusted,${r.ols.pAdj}`);
      if (r.pettitt) lines.push(`# Pettitt change point after,${r.pettittYears[r.pettitt.index]},p,${r.pettitt.p}`);
    }
    lines.push('');
    lines.push('month,value');
    series.dates.forEach((d, i) => lines.push(`${d},${series.values[i] === null ? '' : series.values[i]}`));
    if (!r.error) {
      lines.push(''); lines.push(r.mode === 'monthly' ? 'time,anomaly' : 'year,value_analysed');
      r.x.forEach((x, i) => lines.push(`${x},${r.y[i]}`));
    }
    return lines.join('\n');
  }
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $('dlCsv').addEventListener('click', () => { if (state.last) download(`earthtrend_${state.last.v.id}_${state.last.lat.toFixed(2)}_${state.last.lon.toFixed(2)}_${state.last.period}.csv`, toCSV()); });
  $('dlPng').addEventListener('click', () => Plotly.downloadImage('chartMain', { format: 'png', width: 1400, height: 700, filename: 'earthtrend_chart' }));
  $('copyLink').addEventListener('click', async () => {
    updateHash();
    try { await navigator.clipboard.writeText(location.href); $('copyLink').textContent = '✅ Link copied'; } catch (e) { prompt('Copy this link:', location.href); }
    setTimeout(() => { $('copyLink').textContent = '🔗 Copy link to this investigation'; }, 2000);
  });
  $('toMap').addEventListener('click', () => {
    const v = byId[state.varId];
    if (v.provider !== 'power') { alert('The Trend Map uses NASA POWER variables. Please choose another variable for mapping.'); return; }
    $('mapVar').value = state.varId; $('mapPeriod').value = state.period === 'monthly' ? 'annual' : state.period;
    showTab('map'); runMap();
  });

  // ---------- permalink ----------
  function updateHash() {
    const p = new URLSearchParams({ lat: state.lat.toFixed(3), lon: state.lon.toFixed(3), v: state.varId, p: state.period, y0: state.startYear, y1: state.endYear, place: state.place });
    history.replaceState(null, '', '#' + p.toString());
  }
  function readHash() {
    if (!location.hash || location.hash.length < 3) return false;
    const p = new URLSearchParams(location.hash.slice(1));
    if (!p.get('lat') || !p.get('lon')) return false;
    setLocation(parseFloat(p.get('lat')), parseFloat(p.get('lon')), p.get('place'), 6);
    const known = C.PLACES.find(pl => pl.name === p.get('place'));
    $('archetype').value = known ? known.type : ''; onArchetype();
    if (p.get('v') && byId[p.get('v')]) selectVariable(p.get('v'));
    if (p.get('p')) $('period').value = p.get('p');
    if (p.get('y0')) $('startYear').value = p.get('y0');
    if (p.get('y1')) $('endYear').value = p.get('y1');
    return true;
  }

  // ---------- variable scanner ----------
  function sparkline(values) {
    const v = values.filter(x => x !== null && isFinite(x));
    if (v.length < 2) return '';
    const mn = Math.min(...v), mx = Math.max(...v), w = 110, h = 28;
    const pts = values.map((y, i) => y === null ? null : `${(i / (values.length - 1)) * w},${h - 2 - ((y - mn) / ((mx - mn) || 1)) * (h - 4)}`).filter(Boolean).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="#4cc9f0" stroke-width="1.5" points="${pts}"/></svg>`;
  }
  async function runScan() {
    const period = $('scanPeriod').value;
    $('scanBtn').disabled = true; setProgress('scanProg', 0.1);
    setStatus('scanStatus', '🛰️ Downloading 19 variables from NASA POWER…');
    try {
      const pvars = VARIABLES.filter(v => v.provider === 'power').map(v => v.id);
      const r = await D.powerPoint(state.lat, state.lon, pvars);
      const results = [];
      for (const id of pvars) if (r.series[id]) results.push({ v: byId[id], series: D.clipYears(r.series[id], D.FIRST_YEAR, END) });
      if ($('scanNdvi').checked) {
        setStatus('scanStatus', '🛰️ Downloading MODIS greenness…');
        const n = await D.modisNDVI(state.lat, state.lon, f => setProgress('scanProg', 0.3 + 0.6 * f));
        results.push({ v: byId.NDVI, series: D.clipYears(n.series.NDVI, 2001, END) });
      }
      for (const it of results) it.r = A.analyze(it.series, period, { ratioScale: it.v.units !== '°C' });
      const ok = results.filter(it => !it.r.error);
      const q = S.benjaminiHochberg(ok.map(it => it.r.primaryP));
      ok.forEach((it, i) => { it.q = q[i]; });
      ok.sort((a, b) => a.q - b.q);
      $('scanOut').hidden = false;
      $('scanTitle').textContent = `${state.place} — ${periodLabel(period)} — ${ok.filter(i => i.q < 0.05).length} of ${ok.length} variables show a significant trend (FDR q < 0.05)`;
      $('scanTable').innerHTML = '<tr><th>Variable</th><th>Series</th><th>Trend / decade</th><th>Change over record</th><th>p</th><th>q (FDR)</th><th>Verdict</th></tr>' +
        ok.map(it => {
          const dec = it.r.slopePerYear * 10; const st = A.strength(it.q);
          return `<tr class="clickable" data-var="${it.v.id}" data-period="${period}">
            <td><b>${it.v.name}</b><br><span class="muted">${it.v.units} · ${it.r.span[0]}–${it.r.span[1]}</span></td>
            <td>${sparkline(it.r.y)}</td>
            <td class="${dec > 0 ? 'up' : 'down'}">${dec > 0 ? '+' : ''}${fmt(dec)}</td>
            <td>${it.r.pctChange !== null ? (it.r.pctChange > 0 ? '+' : '') + fmt(it.r.pctChange, 1) + '%' : fmt(it.r.totalChange)}</td>
            <td>${fmtP(it.r.primaryP)}</td><td>${fmtP(it.q)}</td>
            <td><span class="pill ${st.key}">${st.key === 'none' ? 'no clear trend' : (dec > 0 ? '▲ ' : '▼ ') + st.label.toLowerCase()}</span></td></tr>`;
        }).join('');
      $('scanTable').querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => {
        selectVariable(tr.dataset.var); $('period').value = tr.dataset.period;
        $('startYear').value = byId[tr.dataset.var].provider === 'modis' ? 2001 : D.FIRST_YEAR; $('endYear').value = END;
        showTab('investigate'); investigate();
      }));
      setStatus('scanStatus', '✅ Scan complete.');
    } catch (e) {
      console.error(e); setStatus('scanStatus', `⚠️ ${e.message}. Please try again.`, true);
    } finally { $('scanBtn').disabled = false; setTimeout(() => setProgress('scanProg', null), 600); }
  }
  $('scanBtn').addEventListener('click', runScan);

  // ---------- trend map ----------
  const tmap = L.map('trendmap', { worldCopyJump: true }).setView([state.lat, state.lon], 5);
  addBasemap(tmap);
  let gridLayer = L.layerGroup().addTo(tmap);
  const WET = new Set(['PRECTOTCORR', 'RH2M', 'QV2M', 'T2MDEW', 'GWETTOP', 'GWETROOT', 'GWETPROF', 'EVPTRNS', 'CLOUD_AMT']);
  function divColor(t, wet) {
    // t in [-1,1]; red/blue for most variables, brown/green for water variables
    const neg = wet ? [166, 97, 26] : [33, 102, 172], pos = wet ? [1, 133, 113] : [178, 24, 43], mid = [247, 247, 247];
    const a = Math.min(1, Math.abs(t)); const end = t >= 0 ? pos : neg;
    const c = mid.map((m, i) => Math.round(m + (end[i] - m) * a));
    return `rgb(${c.join(',')})`;
  }
  async function runMap() {
    const id = $('mapVar').value, period = $('mapPeriod').value, size = +$('mapSize').value, v = byId[id];
    const half = size / 2;
    const latMin = Math.max(-89.5, +(state.lat - half).toFixed(2)), latMax = Math.min(89.5, +(state.lat + half).toFixed(2));
    const lonMin = Math.max(-179.5, +(state.lon - half).toFixed(2)), lonMax = Math.min(179.5, +(state.lon + half).toFixed(2));
    $('mapBtn').disabled = true; setProgress('mapProg', 0.2);
    setStatus('mapStatus', `🛰️ Downloading ${v.name} for the whole region from NASA POWER…`);
    try {
      const reg = await D.powerRegional(id, latMin, latMax, lonMin, lonMax);
      setProgress('mapProg', 0.7); setStatus('mapStatus', `🧮 Running trend tests on ${reg.cells.length} grid cells…`);
      await new Promise(r => setTimeout(r, 20));
      const cells = reg.cells.map(c => ({ ...c, r: A.analyze(D.clipYears(c, D.FIRST_YEAR, END), period, { ratioScale: v.units !== '°C' }) })).filter(c => !c.r.error);
      const q = S.benjaminiHochberg(cells.map(c => c.r.primaryP)); cells.forEach((c, i) => c.q = q[i]);
      const decs = cells.map(c => c.r.slopePerYear * 10);
      const sorted = decs.map(Math.abs).sort((a, b) => a - b);
      const scale = sorted[Math.floor(0.95 * (sorted.length - 1))] || 1;
      const lats = [...new Set(cells.map(c => c.lat))].sort((a, b) => a - b), lons = [...new Set(cells.map(c => c.lon))].sort((a, b) => a - b);
      const dLat = lats.length > 1 ? lats[1] - lats[0] : 0.5, dLon = lons.length > 1 ? lons[1] - lons[0] : 0.625;
      gridLayer.clearLayers();
      const wet = WET.has(id);
      cells.forEach((c, i) => {
        const dec = decs[i], sig = c.r.primaryP < 0.05, fdr = c.q < 0.05;
        const rect = L.rectangle([[c.lat - dLat / 2, c.lon - dLon / 2], [c.lat + dLat / 2, c.lon + dLon / 2]], {
          color: fdr ? '#000' : 'transparent', weight: fdr ? 1 : 0, fillColor: divColor(dec / scale, wet), fillOpacity: sig ? 0.85 : 0.3
        });
        rect.bindPopup(`<b>${v.name}</b><br>${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°<br>Trend: <b>${dec > 0 ? '+' : ''}${fmt(dec)} ${v.units}/decade</b><br>${pText(c.r.primaryP)} · q (FDR) ${pText(c.q).slice(2)}<br>${A.strength(c.r.primaryP).label}<br><a href="#" class="cellgo" data-lat="${c.lat}" data-lon="${c.lon}">Investigate this cell →</a>`);
        rect.addTo(gridLayer);
      });
      L.rectangle([[latMin, lonMin], [latMax, lonMax]], { color: '#4cc9f0', weight: 1, fill: false, dashArray: '4' }).addTo(gridLayer);
      L.circleMarker([state.lat, state.lon], { radius: 5, color: '#fff', fillColor: '#f72585', fillOpacity: 1 }).addTo(gridLayer);
      tmap.invalidateSize(); tmap.fitBounds([[latMin, lonMin], [latMax, lonMax]]);
      const inc = cells.filter((c, i) => decs[i] > 0 && c.r.primaryP < 0.05).length, decN = cells.filter((c, i) => decs[i] < 0 && c.r.primaryP < 0.05).length;
      const incF = cells.filter((c, i) => decs[i] > 0 && c.q < 0.05).length, decF = cells.filter((c, i) => decs[i] < 0 && c.q < 0.05).length;
      const n = cells.length;
      $('mapSummary').innerHTML = `<div class="varcard"><b>${v.name} · ${periodLabel(period)} · ${reg.endYear - D.FIRST_YEAR + 1} years</b><br>
        ▲ Significant increase: <b>${inc}</b> of ${n} cells (${fmt(100 * inc / n, 0)}%)<br>
        ▼ Significant decrease: <b>${decN}</b> of ${n} cells (${fmt(100 * decN / n, 0)}%)<br>
        After false-discovery-rate correction: ▲ ${incF} · ▼ ${decF} (outlined cells)<br>
        Trend range: ${fmt(Math.min(...decs))} to ${fmt(Math.max(...decs))} ${v.units}/decade
        ${incF > 0 && decF > 0 ? '<br><br>↕️ <b>Opposite trends found!</b> Even after false-discovery-rate correction, the same variable is significantly rising in some cells and falling in others within this region.'
          : (inc > 0 && decN > 0 ? '<br><br>↕️ <b>Possible opposite trends:</b> some cells rise and others fall at p &lt; 0.05, but the opposite-sign cells do not survive false-discovery-rate correction, so treat them with caution.' : '')}</div>`;
      $('mapLegend').innerHTML = `<span>▼ ${fmt(-scale)}</span><div class="bar" style="background:linear-gradient(90deg, ${divColor(-1, wet)}, ${divColor(0, wet)}, ${divColor(1, wet)})"></div><span>▲ ${fmt(scale)} ${v.units}/decade</span>
        <span>· Bright = significant (p&lt;0.05) · Faded = not significant · Black outline = significant after FDR</span>`;
      setStatus('mapStatus', '✅ Click any cell for details.');
    } catch (e) {
      console.error(e); setStatus('mapStatus', `⚠️ ${e.message}. Please try again.`, true);
    } finally { $('mapBtn').disabled = false; setTimeout(() => setProgress('mapProg', null), 600); }
  }
  $('mapBtn').addEventListener('click', runMap);
  tmap.on('popupopen', e => {
    const a = e.popup.getElement().querySelector('.cellgo');
    if (a) a.addEventListener('click', ev => {
      ev.preventDefault();
      setLocation(+a.dataset.lat, +a.dataset.lon, null, 7);
      selectVariable($('mapVar').value); $('period').value = $('mapPeriod').value;
      showTab('investigate'); investigate();
    });
  });

  // ---------- case files ----------
  $('cases').innerHTML = C.CASES.map((c, i) => `<div class="card case" data-i="${i}" tabindex="0" role="button">
      <div class="emoji">${c.emoji}</div><h3>${c.title}</h3><div class="q">${c.q}</div>
      <p class="muted">${c.story}</p><span class="muted">📍 ${c.place} · ${byId[c.variable].name} · ${periodLabel(c.period)}</span></div>`).join('');
  $('cases').querySelectorAll('.case').forEach(el => {
    const go = () => {
      const c = C.CASES[+el.dataset.i];
      setLocation(c.lat, c.lon, c.place, 6);
      $('archetype').value = c.type; onArchetype();
      selectVariable(c.variable);
      $('period').value = c.period;
      $('startYear').value = byId[c.variable].provider === 'modis' ? 2001 : D.FIRST_YEAR; $('endYear').value = END;
      if (c.map) { $('mapVar').value = c.variable; $('mapPeriod').value = c.period; $('mapSize').value = String(c.map); showTab('map'); runMap(); }
      else { showTab('investigate'); investigate(); }
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });

  // ---------- learn ----------
  $('learnBox').innerHTML = C.LEARN;
  $('glossary').innerHTML = '<dl>' + VARIABLES.map(v => `<dt>${v.name} <span class="muted">(${v.id}, ${v.units})</span></dt><dd>${v.simple} ${v.why} <span class="muted">Source: ${v.source}.</span></dd>`).join('') + '</dl>';

  // ---------- init ----------
  renderVarSelect();
  selectVariable(state.varId);
  setLocation(state.lat, state.lon, state.place, 5);
  $('archetype').value = 'farmland'; onArchetype();
  if (readHash()) { investigate(); }
})();
