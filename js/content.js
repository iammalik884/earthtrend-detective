/* Static content: preset places, guided case files, and the Learn & Methods page. */
(function (root) {
  'use strict';

  const PLACES = [
    { name: 'Sargodha, Pakistan', lat: 32.08, lon: 72.67, type: 'farmland' },
    { name: 'Lahore, Pakistan', lat: 31.55, lon: 74.34, type: 'city' },
    { name: 'Karachi, Pakistan', lat: 24.86, lon: 67.01, type: 'coast' },
    { name: 'Islamabad, Pakistan', lat: 33.69, lon: 73.05, type: 'city' },
    { name: 'Thar Desert, Pakistan/India', lat: 26.5, lon: 70.5, type: 'desert' },
    { name: 'Gilgit-Baltistan (Karakoram)', lat: 35.9, lon: 74.3, type: 'polar' },
    { name: 'Ludhiana, Indian Punjab', lat: 30.9, lon: 75.85, type: 'farmland' },
    { name: 'Delhi, India', lat: 28.61, lon: 77.21, type: 'city' },
    { name: 'Dhaka, Bangladesh', lat: 23.81, lon: 90.41, type: 'city' },
    { name: 'Svalbard (Arctic), Norway', lat: 78.22, lon: 15.65, type: 'polar' },
    { name: 'Niamey (Sahel), Niger', lat: 13.51, lon: 2.11, type: 'desert' },
    { name: 'Manaus (Amazon), Brazil', lat: -3.12, lon: -60.02, type: 'rainforest' },
    { name: 'Cairo, Egypt', lat: 30.04, lon: 31.24, type: 'city' },
    { name: 'Nairobi, Kenya', lat: -1.29, lon: 36.82, type: 'city' },
    { name: 'Phoenix, USA', lat: 33.45, lon: -112.07, type: 'desert' },
    { name: 'Central Valley, California, USA', lat: 36.6, lon: -119.8, type: 'farmland' },
    { name: 'Chesapeake Bay estuary, USA', lat: 38.0, lon: -76.3, type: 'coast' },
    { name: 'London, UK', lat: 51.51, lon: -0.13, type: 'city' },
    { name: 'Aral Sea region, Kazakhstan/Uzbekistan', lat: 45.0, lon: 60.0, type: 'desert' },
    { name: 'Beijing, China', lat: 39.9, lon: 116.4, type: 'city' },
    { name: 'Sydney, Australia', lat: -33.87, lon: 151.21, type: 'coast' }
  ];

  const CASES = [
    { emoji: '🧊', title: 'The Warming Arctic', q: 'Is Svalbard warming faster than the rest of the world?',
      place: 'Svalbard (Arctic), Norway', lat: 78.22, lon: 15.65, variable: 'T2M', period: 'annual', type: 'polar',
      story: 'Scientists talk about “Arctic amplification”. Predict the warming rate per decade, then compare it with the global average of roughly 0.2 °C per decade.' },
    { emoji: '🌙', title: 'Hot Summer Nights in Punjab', q: 'Are summer nights in Sargodha getting warmer?',
      place: 'Sargodha, Pakistan', lat: 32.08, lon: 72.67, variable: 'T2M_MIN', period: 'JJA', type: 'farmland',
      story: 'Warmer nights stop people, animals and crops from recovering from daytime heat. Compare night-time (minimum) with daytime (maximum) temperature trends.' },
    { emoji: '🌾', title: 'Greening of the Indus–Ganges Plains', q: 'Are irrigated farmlands getting greener from space?',
      place: 'Ludhiana, Indian Punjab', lat: 30.9, lon: 75.85, variable: 'NDVI', period: 'annual', type: 'farmland',
      story: 'MODIS sees plant greenness every 16 days. Intensive irrigation and double cropping can raise NDVI — then check root-zone soil wetness for the hidden cost.' },
    { emoji: '🌧️', title: 'Has the Sahel Recovered?', q: 'Is rainy-season rainfall in Niamey trending?',
      place: 'Niamey (Sahel), Niger', lat: 13.51, lon: 2.11, variable: 'PRECTOTCORR', period: 'JJA', type: 'desert',
      story: 'The Sahel suffered severe droughts in the 1970s–80s. Rainfall is very noisy year to year — a good test of whether a trend can reach significance. Look for a change point.' },
    { emoji: '🌳', title: 'The Amazon Dry Season', q: 'Is the Amazon’s dry season getting hotter?',
      place: 'Manaus (Amazon), Brazil', lat: -3.12, lon: -60.02, variable: 'T2M_MAX', period: 'SON', type: 'rainforest',
      story: 'September–November is the end of the Amazon dry season, when droughts and fires peak. Investigate daytime maximum temperature.' },
    { emoji: '🏜️', title: 'The Shrinking Aral Sea', q: 'Has the land around the former Aral Sea dried out?',
      place: 'Aral Sea region, Kazakhstan/Uzbekistan', lat: 45.0, lon: 60.0, variable: 'GWETTOP', period: 'annual', type: 'desert',
      story: 'Once the world’s fourth-largest lake, the Aral Sea shrank after its rivers were diverted. Explore surface soil wetness, then try temperature.' },
    { emoji: '↕️', title: 'Same Variable, Opposite Signs', q: 'Can rainfall rise in one place and fall nearby?',
      place: 'Sargodha, Pakistan', lat: 32.08, lon: 72.67, variable: 'PRECTOTCORR', period: 'annual', type: 'farmland', map: 10,
      story: 'Opens the Trend Map over a 10° × 10° region of Pakistan and north-west India. Look for cells where rainfall increases and others where it decreases, even though the same monsoon system drives both.' },
    { emoji: '🏙️', title: 'Urban Heat in Lahore', q: 'Is Lahore heating up more at night than during the day?',
      place: 'Lahore, Pakistan', lat: 31.55, lon: 74.34, variable: 'T2M_MIN', period: 'annual', type: 'city',
      story: 'Run the Variable Scanner afterwards to see every variable that is trending in Lahore — with false-discovery-rate protection.' }
  ];

  const LEARN = `
  <h2>📘 Learn &amp; Methods</h2>
  <p>EarthTrend Detective is designed for high-school and college students and curious members of the public. It follows the four steps of the challenge: <b>(1)</b> choose an Earth science variable, <b>(2)</b> get data for a region, <b>(3)</b> build and visualize a long time series, and <b>(4)</b> measure the rate of change and test whether it is significant.</p>

  <h3>Data sources (all free and open)</h3>
  <dl>
    <dt>NASA POWER — Prediction Of Worldwide Energy Resources</dt>
    <dd>Monthly data from 1981 to the latest complete year on a 0.5° × 0.625° grid. Meteorology and soil variables come from NASA GMAO’s <b>MERRA-2</b> reanalysis; solar and longwave radiation come from NASA’s <b>GEWEX SRB</b> and <b>CERES</b> projects. Accessed live through the POWER API (power.larc.nasa.gov).</dd>
    <dt>MODIS Terra MOD13Q1 v6.1 — Vegetation Indices</dt>
    <dd>16-day, 250 m NDVI from the MODIS instrument on NASA’s Terra satellite (2000–present), accessed through the ORNL DAAC MODIS web service. We average the valid pixels in a ~3 km × 3 km window and then average the composites in each month. Pixels flagged as fill values are excluded.</dd>
  </dl>

  <h3>How the statistics work (in plain language)</h3>
  <dl>
    <dt>Trend (rate of change)</dt>
    <dd>We use the <b>Theil–Sen slope</b>: the median of the slopes between every pair of years. Unlike an ordinary straight-line fit, a single extreme year cannot drag it around. We report it per decade with a 95% confidence interval (Sen, 1968).</dd>
    <dt>Mann–Kendall test</dt>
    <dd>Compares every year with every later year and counts how often the later one is higher. If “ups” greatly outnumber “downs” (or vice versa), the trend is unlikely to be chance. It does not assume the data follow a bell curve.</dd>
    <dt>Modified Mann–Kendall (Yue &amp; Wang, 2004) — our main test for yearly data</dt>
    <dd>Climate data are often <i>autocorrelated</i> (a warm year tends to follow a warm year), which makes ordinary tests over-confident. This version inflates the test’s variance to account for that, so we do not cry “significant” too easily. We apply the correction conservatively: it can only make the test stricter, never more lenient than the original.</dd>
    <dt>Seasonal Mann–Kendall (Hirsch et al., 1982) — our main test for monthly data</dt>
    <dd>Runs Mann–Kendall separately for each calendar month (January vs January, July vs July…) and combines them, so the big summer–winter cycle does not hide the long-term trend.</dd>
    <dt>Linear regression t-test with 95% confidence interval</dt>
    <dd>The classic straight-line fit. We also show an <b>autocorrelation-adjusted</b> version that uses an effective sample size (Santer et al., 2000). If the regression and Mann–Kendall disagree, the tool warns you.</dd>
    <dt>Pettitt change-point test (Pettitt, 1979)</dt>
    <dd>Asks whether the series looks more like a sudden <i>step</i> than a steady slope, and when the step happened.</dd>
    <dt>False discovery rate (Benjamini &amp; Hochberg, 1995)</dt>
    <dd>If you test 20 variables, about 1 will look “significant” at p &lt; 0.05 by pure luck. The Variable Scanner and the Trend Map correct for this by reporting q-values.</dd>
    <dt>p-value</dt>
    <dd>The probability of seeing a trend at least this strong if nothing were really changing. p &lt; 0.05 → significant (95% confidence); p &lt; 0.01 → highly significant.</dd>
    <dt>“Years needed” estimate</dt>
    <dd>If a trend is not yet significant, we estimate how many years of data would be needed (assuming the same rate and noise continue). As the challenge notes, sometimes all a trend needs is a longer record.</dd>
  </dl>

  <h3>Validation</h3>
  <p>Every statistical routine in this app is written in plain JavaScript and checked automatically against the reference Python libraries <b>SciPy</b> (linear regression, Theil–Sen, false discovery rate) and <b>pymannkendall</b> (original, Yue–Wang modified and seasonal Mann–Kendall) on 80 synthetic test series, including tied values and autocorrelated noise. All results match to better than one part in a million.</p>

  <h3>Honest limitations</h3>
  <ul>
    <li>Reanalysis data (MERRA-2) blend models and observations; they are excellent for large-scale trends but can miss very local effects such as a single city block.</li>
    <li>A grid cell is about 50 km across — a “city” cell also contains surrounding countryside.</li>
    <li>Statistical significance tells you a change is unlikely to be random — not <i>what caused</i> it. Use the Trend Map, the change-point test and other variables to form hypotheses.</li>
    <li>We detect monotonic (mostly linear) trends, as the challenge recommends. Non-linear and cyclic behaviour (e.g. El Niño) can affect results over short periods.</li>
    <li>The Trend Map flags cells individually and with FDR correction; neighbouring cells are not independent.</li>
  </ul>

  <h3>Variable glossary</h3>
  <div id="glossary"></div>

  <h3>References</h3>
  <ul class="muted">
    <li>Benjamini, Y. &amp; Hochberg, Y. (1995). Controlling the false discovery rate. <i>J. R. Stat. Soc. B</i>, 57, 289–300.</li>
    <li>Gelaro, R. et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). <i>J. Climate</i>, 30, 5419–5454.</li>
    <li>Hirsch, R. M., Slack, J. R. &amp; Smith, R. A. (1982). Techniques of trend analysis for monthly water quality data. <i>Water Resour. Res.</i>, 18, 107–121.</li>
    <li>Kendall, M. G. (1975). <i>Rank Correlation Methods</i>. Griffin. · Mann, H. B. (1945). Nonparametric tests against trend. <i>Econometrica</i>, 13, 245–259.</li>
    <li>Pettitt, A. N. (1979). A non-parametric approach to the change-point problem. <i>Appl. Statist.</i>, 28, 126–135.</li>
    <li>Santer, B. D. et al. (2000). Statistical significance of trends and trend differences in layer-average atmospheric temperature time series. <i>J. Geophys. Res.</i>, 105, 7337–7356.</li>
    <li>Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall’s tau. <i>J. Am. Stat. Assoc.</i>, 63, 1379–1389.</li>
    <li>Yue, S. &amp; Wang, C. (2004). The Mann-Kendall test modified by effective sample size. <i>Water Resour. Manage.</i>, 18, 201–218.</li>
    <li>Didan, K. (2021). MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061. NASA EOSDIS LP DAAC.</li>
    <li>NASA POWER Project, NASA Langley Research Center — power.larc.nasa.gov.</li>
  </ul>`;

  root.ETContent = { PLACES, CASES, LEARN };
})(typeof window !== 'undefined' ? window : globalThis);
