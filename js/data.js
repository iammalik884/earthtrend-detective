/* Data access layer: NASA POWER (MERRA-2 / radiation) and MODIS NDVI (ORNL DAAC), plus aggregation. */
(function (root) {
  'use strict';

  const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/monthly';
  const MODIS_BASE = 'https://modis.ornl.gov/rst/api/v1/MOD13Q1';
  const FIRST_YEAR = 1981;
  const cache = new Map();

  function lastCompleteYear() {
    // POWER monthly products are published for complete years; use previous calendar year.
    return new Date().getUTCFullYear() - 1;
  }

  async function fetchJSON(url, opts = {}, retries = 2) {
    let lastErr;
    for (let a = 0; a <= retries; a++) {
      try {
        const r = await fetch(url, { headers: { Accept: 'application/json' }, ...opts });
        if (!r.ok) {
          const txt = await r.text();
          const err = new Error(`HTTP ${r.status}: ${txt.slice(0, 300)}`);
          err.status = r.status;
          throw err;
        }
        return await r.json();
      } catch (e) {
        lastErr = e;
        if (e.status && e.status < 500 && e.status !== 429) break;
        await new Promise(res => setTimeout(res, 800 * (a + 1)));
      }
    }
    throw lastErr;
  }

  // Convert POWER {YYYYMM: value} (MM 13 = annual) into ordered monthly arrays
  function powerToSeries(obj, fill) {
    const dates = [], values = [];
    for (const key of Object.keys(obj).sort()) {
      const mm = +key.slice(4, 6);
      if (mm < 1 || mm > 12) continue;
      const v = obj[key];
      dates.push(`${key.slice(0, 4)}-${key.slice(4, 6)}`);
      values.push(v === fill || v === null || v === undefined || v <= -990 ? null : v);
    }
    return { dates, values };
  }

  async function powerPoint(lat, lon, params, endYear) {
    endYear = endYear || lastCompleteYear();
    const key = `pp|${lat.toFixed(3)}|${lon.toFixed(3)}|${params.join(',')}|${endYear}`;
    if (cache.has(key)) return cache.get(key);
    const url = `${POWER_BASE}/point?parameters=${params.join(',')}&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${FIRST_YEAR}&end=${endYear}&format=JSON`;
    let j;
    try { j = await fetchJSON(url); }
    catch (e) {
      // If the newest year is not yet published, retry one year earlier.
      if (e.status === 422 || e.status === 400) return powerPoint(lat, lon, params, endYear - 1);
      throw e;
    }
    const fill = j.header && j.header.fill_value !== undefined ? j.header.fill_value : -999;
    const out = { meta: { url, endYear, elevation: j.geometry && j.geometry.coordinates ? j.geometry.coordinates[2] : null, sources: j.header && j.header.sources }, series: {} };
    for (const p of params) {
      if (j.properties.parameter[p]) out.series[p] = powerToSeries(j.properties.parameter[p], fill);
    }
    cache.set(key, out);
    return out;
  }

  // Regional grid (0.5 deg) for one parameter
  async function powerRegional(param, latMin, latMax, lonMin, lonMax, endYear) {
    endYear = endYear || lastCompleteYear();
    const key = `pr|${param}|${latMin}|${latMax}|${lonMin}|${lonMax}|${endYear}`;
    if (cache.has(key)) return cache.get(key);
    const url = `${POWER_BASE}/regional?parameters=${param}&community=AG&latitude-min=${latMin}&latitude-max=${latMax}&longitude-min=${lonMin}&longitude-max=${lonMax}&start=${FIRST_YEAR}&end=${endYear}&format=JSON`;
    let j;
    try { j = await fetchJSON(url); }
    catch (e) {
      if ((e.status === 422 || e.status === 400) && /end|date|year/i.test(e.message)) return powerRegional(param, latMin, latMax, lonMin, lonMax, endYear - 1);
      throw e;
    }
    const fill = j.header && j.header.fill_value !== undefined ? j.header.fill_value : -999;
    const cells = (j.features || []).map(f => ({
      lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
      ...powerToSeries(f.properties.parameter[param], fill)
    }));
    const out = { url, endYear, cells };
    cache.set(key, out);
    return out;
  }

  // MODIS NDVI (MOD13Q1) around a point: mean of valid 250 m pixels in a ~3x3 km window, aggregated to months.
  async function modisNDVI(lat, lon, onProgress) {
    const key = `ndvi|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    if (cache.has(key)) return cache.get(key);
    const dj = await fetchJSON(`${MODIS_BASE}/dates?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`);
    const dates = dj.dates;
    const chunks = [];
    for (let i = 0; i < dates.length; i += 10) chunks.push(dates.slice(i, i + 10));
    const results = new Array(chunks.length);
    let done = 0, next = 0;
    const worker = async () => {
      while (next < chunks.length) {
        const idx = next++;
        const c = chunks[idx];
        const url = `${MODIS_BASE}/subset?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&band=250m_16_days_NDVI&startDate=${c[0].modis_date}&endDate=${c[c.length - 1].modis_date}&kmAboveBelow=1&kmLeftRight=1`;
        const j = await fetchJSON(url, {}, 3);
        const scale = parseFloat(j.scale) || 0.0001;
        results[idx] = j.subset.map(s => {
          const valid = s.data.filter(v => v > -2000 && v <= 10000).map(v => v * scale);
          return { date: s.calendar_date, value: valid.length >= Math.ceil(s.data.length / 3) ? valid.reduce((a, b) => a + b, 0) / valid.length : null };
        });
        done++;
        if (onProgress) onProgress(done / chunks.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    const composites = results.flat().filter(Boolean);
    // monthly means of 16-day composites
    const byMonth = new Map();
    for (const c of composites) {
      if (c.value === null) continue;
      const m = c.date.slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(c.value);
    }
    const months = [];
    const startY = +composites[0].date.slice(0, 4), endY = +composites[composites.length - 1].date.slice(0, 4);
    for (let y = startY; y <= endY; y++) for (let m = 1; m <= 12; m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
    const values = months.map(m => byMonth.has(m) ? byMonth.get(m).reduce((a, b) => a + b, 0) / byMonth.get(m).length : null);
    // trim trailing incomplete months (no data)
    let last = values.length - 1; while (last > 0 && values[last] === null) last--;
    const out = { meta: { composites: composites.length, window: '3 km x 3 km mean of 250 m pixels', url: `${MODIS_BASE}/subset` }, series: { NDVI: { dates: months.slice(0, last + 1), values: values.slice(0, last + 1) } } };
    cache.set(key, out);
    return out;
  }

  // ---------- aggregation ----------
  const SEASONS = { DJF: [12, 1, 2], MAM: [3, 4, 5], JJA: [6, 7, 8], SON: [9, 10, 11] };

  // Returns { x:[years], y:[values], label } for annual/seasonal/single-month periods.
  // minFrac: fraction of months required (1 = all months must be present).
  function aggregate(series, period, minFrac = 1) {
    const map = new Map();
    series.dates.forEach((d, i) => map.set(d, series.values[i]));
    const years = [...new Set(series.dates.map(d => +d.slice(0, 4)))].sort((a, b) => a - b);
    const x = [], y = [];
    let months;
    if (period === 'annual') months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    else if (SEASONS[period]) months = SEASONS[period];
    else if (/^m\d+$/.test(period)) months = [+period.slice(1)];
    else throw new Error('Unknown period ' + period);
    for (const yr of years) {
      const vals = [];
      for (const m of months) {
        // DJF: December belongs to previous year (season labelled by Jan/Feb year)
        const yy = (period === 'DJF' && m === 12) ? yr - 1 : yr;
        const v = map.get(`${yy}-${String(m).padStart(2, '0')}`);
        if (v !== null && v !== undefined) vals.push(v);
      }
      if (vals.length >= Math.ceil(months.length * minFrac) && vals.length > 0) {
        x.push(yr); y.push(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
    }
    return { x, y };
  }

  // Monthly anomalies (seasonal cycle removed) and climatology
  function anomalies(series) {
    const sums = new Array(12).fill(0), counts = new Array(12).fill(0);
    series.dates.forEach((d, i) => { const v = series.values[i]; if (v !== null) { const m = +d.slice(5, 7) - 1; sums[m] += v; counts[m]++; } });
    const clim = sums.map((s, i) => counts[i] ? s / counts[i] : null);
    const x = [], y = [], dates = [];
    series.dates.forEach((d, i) => {
      const v = series.values[i];
      if (v === null) return;
      const yr = +d.slice(0, 4), m = +d.slice(5, 7);
      x.push(yr + (m - 0.5) / 12); y.push(v - clim[m - 1]); dates.push(d);
    });
    return { x, y, dates, clim };
  }

  // 12 arrays (one per calendar month) ordered by year, for seasonal Mann-Kendall
  function seasonsMatrix(series) {
    const years = [...new Set(series.dates.map(d => +d.slice(0, 4)))].sort((a, b) => a - b);
    const map = new Map(); series.dates.forEach((d, i) => map.set(d, series.values[i]));
    const seasons = [];
    for (let m = 1; m <= 12; m++) seasons.push(years.map(yr => { const v = map.get(`${yr}-${String(m).padStart(2, '0')}`); return v === undefined ? null : v; }));
    return seasons;
  }

  function clipYears(series, startYear, endYear) {
    const dates = [], values = [];
    series.dates.forEach((d, i) => { const yr = +d.slice(0, 4); if (yr >= startYear && yr <= endYear) { dates.push(d); values.push(series.values[i]); } });
    return { dates, values };
  }

  root.ETData = { powerPoint, powerRegional, modisNDVI, aggregate, anomalies, seasonsMatrix, clipYears, lastCompleteYear, FIRST_YEAR };
})(typeof window !== 'undefined' ? window : globalThis);
