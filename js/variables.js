/* Variable catalog: NASA Earth science variables with plain-language definitions. */
(function (root) {
  'use strict';

  const SRC_MERRA = 'MERRA-2 reanalysis (NASA GMAO) via NASA POWER';
  const SRC_RAD = 'GEWEX SRB / CERES radiation (NASA) via NASA POWER';
  const SRC_MODIS = 'MODIS Terra MOD13Q1 v6.1 (250 m, 16-day) via ORNL DAAC';

  const VARIABLES = [
    // Heat
    { id: 'T2M', theme: 'heat', name: 'Air temperature (2 m)', units: '°C', source: SRC_MERRA, provider: 'power',
      simple: 'How warm the air is about head-height above the ground, averaged over day and night.',
      why: 'The most direct signal of a warming or cooling climate.' },
    { id: 'T2M_MAX', theme: 'heat', name: 'Daily maximum temperature', units: '°C', source: SRC_MERRA, provider: 'power',
      simple: 'The hottest temperature of each day (afternoon), averaged over the month.',
      why: 'Tracks heat stress for people, crops and livestock.' },
    { id: 'T2M_MIN', theme: 'heat', name: 'Daily minimum temperature', units: '°C', source: SRC_MERRA, provider: 'power',
      simple: 'The coolest temperature of each day (usually night), averaged over the month.',
      why: 'Warmer nights are a classic fingerprint of climate change and of urban heat islands.' },
    { id: 'TS', theme: 'heat', name: 'Land/sea skin temperature', units: '°C', source: SRC_MERRA, provider: 'power',
      simple: 'The temperature of the very surface of the ground or water (what a thermal camera would see).',
      why: 'Responds to land-cover change, irrigation and drying soils.' },
    { id: 'FROST_DAYS', theme: 'heat', name: 'Frost days', units: 'days', source: SRC_MERRA, provider: 'power',
      simple: 'Number of days in the month when the temperature falls below 0 °C.',
      why: 'Fewer frost days lengthens growing seasons and affects pests and snow.' },

    // Water
    { id: 'PRECTOTCORR', theme: 'water', name: 'Precipitation (rain + snow)', units: 'mm/day', source: SRC_MERRA + ' (bias-corrected)', provider: 'power',
      simple: 'How much rain and snow falls, as an average depth of water per day.',
      why: 'Drives floods, droughts, water supply and agriculture.' },
    { id: 'RH2M', theme: 'water', name: 'Relative humidity (2 m)', units: '%', source: SRC_MERRA, provider: 'power',
      simple: 'How close the air is to being saturated with water vapour (100% = fully saturated).',
      why: 'Falling humidity can signal drying; rising humidity raises heat stress.' },
    { id: 'QV2M', theme: 'water', name: 'Specific humidity (2 m)', units: 'g/kg', source: SRC_MERRA, provider: 'power',
      simple: 'The actual amount of water vapour in each kilogram of air.',
      why: 'Warmer air can hold more water (about 7% per °C), feeding heavier rain.' },
    { id: 'T2MDEW', theme: 'water', name: 'Dew point (2 m)', units: '°C', source: SRC_MERRA, provider: 'power',
      simple: 'The temperature at which the air would become saturated and dew would form.',
      why: 'High dew points make heat feel more dangerous (muggy).' },

    // Drought / land surface water
    { id: 'GWETTOP', theme: 'drought', name: 'Surface soil wetness', units: '0–1', source: SRC_MERRA, provider: 'power',
      simple: 'How wet the top 5 cm of soil is, from 0 (completely dry) to 1 (saturated).',
      why: 'An early-warning indicator for drought and crop stress.' },
    { id: 'GWETROOT', theme: 'drought', name: 'Root-zone soil wetness', units: '0–1', source: SRC_MERRA, provider: 'power',
      simple: 'How wet the soil is down where plant roots are (top ~1 m), from 0 (dry) to 1 (saturated).',
      why: 'Controls how much water plants can use; slow to change, so trends are meaningful.' },
    { id: 'GWETPROF', theme: 'drought', name: 'Whole-profile soil wetness', units: '0–1', source: SRC_MERRA, provider: 'power',
      simple: 'Average wetness of the whole soil column, from the surface to bedrock.',
      why: 'Reflects long-term water storage, including effects of groundwater use.' },
    { id: 'EVPTRNS', theme: 'drought', name: 'Evapotranspiration (energy)', units: 'MJ/m²/day', source: SRC_MERRA, provider: 'power',
      simple: 'Energy used to evaporate water from soil and from plant leaves (more energy = more water leaving the land).',
      why: 'Links the water, energy and vegetation cycles; changes with irrigation and drought.' },

    // Vegetation
    { id: 'NDVI', theme: 'plants', name: 'Vegetation greenness (NDVI)', units: 'index', source: SRC_MODIS, provider: 'modis',
      simple: 'A satellite measure of how green and dense the plants are: about 0.1 for bare ground, 0.3 for shrubs, 0.6–0.9 for dense forest or crops.',
      why: 'Shows greening (irrigation, re-growth) or browning (drought, deforestation, urban growth). Available from 2000.' },

    // Sun & clouds
    { id: 'ALLSKY_SFC_SW_DWN', theme: 'sun', name: 'Sunlight reaching the ground', units: 'MJ/m²/day', source: SRC_RAD, provider: 'power',
      simple: 'Solar energy that reaches the surface after passing through clouds and haze.',
      why: 'Changes with cloudiness and air pollution ("dimming" or "brightening"); matters for solar power.' },
    { id: 'ALLSKY_SFC_LW_DWN', theme: 'sun', name: 'Downward heat radiation', units: 'MJ/m²/day', source: SRC_RAD, provider: 'power',
      simple: 'Infrared heat radiated down to the ground by the atmosphere, clouds and greenhouse gases.',
      why: 'Rises as the atmosphere warms and gets more humid: the greenhouse effect, measured.' },
    { id: 'CLOUD_AMT', theme: 'sun', name: 'Cloud amount', units: '%', source: SRC_RAD, provider: 'power',
      simple: 'The percentage of the sky covered by clouds.',
      why: 'Clouds control sunlight, temperature and rainfall.' },

    // Wind & air
    { id: 'WS2M', theme: 'air', name: 'Wind speed (2 m)', units: 'm/s', source: SRC_MERRA, provider: 'power',
      simple: 'Average wind speed near the ground.',
      why: 'Affects evaporation, dust storms and air quality.' },
    { id: 'WS10M', theme: 'air', name: 'Wind speed (10 m)', units: 'm/s', source: SRC_MERRA, provider: 'power',
      simple: 'Average wind speed at 10 m height (standard weather-station height).',
      why: 'Relevant to wind energy and to "global stilling" research.' },
    { id: 'PS', theme: 'air', name: 'Surface air pressure', units: 'kPa', source: SRC_MERRA, provider: 'power',
      simple: 'The weight of the air above the ground.',
      why: 'Shifts in pressure patterns reveal changes in atmospheric circulation.' }
  ];

  const THEMES = [
    { id: 'heat', label: 'Heat & temperature', icon: '🌡️', question: 'Is it getting hotter (or colder) here?' },
    { id: 'water', label: 'Rain & humidity', icon: '🌧️', question: 'Is it getting wetter or drier?' },
    { id: 'drought', label: 'Soil water & drought', icon: '🏜️', question: 'Is the land drying out?' },
    { id: 'plants', label: 'Plants & greenness', icon: '🌿', question: 'Are plants and crops getting greener or browner?' },
    { id: 'sun', label: 'Sunlight & clouds', icon: '☀️', question: 'Is the sky getting cloudier or sunnier?' },
    { id: 'air', label: 'Wind & air pressure', icon: '💨', question: 'Is the wind changing?' }
  ];

  // Region archetypes -> suggested variables (expert rules, inspired by the challenge's
  // suggestion to use region characteristics such as desert, rainforest, estuary or a large city).
  const ARCHETYPES = [
    { id: 'city', label: 'Large city', vars: ['T2M_MIN', 'T2M', 'RH2M', 'ALLSKY_SFC_SW_DWN', 'NDVI'],
      hint: 'Cities warm faster at night (urban heat island) and lose green space as they expand.' },
    { id: 'farmland', label: 'Farmland / irrigated plains', vars: ['NDVI', 'GWETROOT', 'EVPTRNS', 'T2M_MAX', 'PRECTOTCORR'],
      hint: 'Irrigation can make land greener and cooler even while groundwater falls.' },
    { id: 'desert', label: 'Desert / dryland', vars: ['PRECTOTCORR', 'GWETTOP', 'NDVI', 'T2M_MAX', 'WS2M'],
      hint: 'Small rainfall changes matter a lot; look for re-greening or expanding dryness.' },
    { id: 'rainforest', label: 'Rainforest', vars: ['PRECTOTCORR', 'GWETROOT', 'T2M_MAX', 'RH2M', 'NDVI'],
      hint: 'Deforestation and drought can make the dry season hotter and drier.' },
    { id: 'polar', label: 'Polar / high mountains', vars: ['T2M', 'FROST_DAYS', 'ALLSKY_SFC_LW_DWN', 'CLOUD_AMT', 'PRECTOTCORR'],
      hint: 'The Arctic is warming several times faster than the global average.' },
    { id: 'coast', label: 'Coast / estuary', vars: ['T2M', 'RH2M', 'PRECTOTCORR', 'WS10M', 'CLOUD_AMT'],
      hint: 'Sea-breeze, humidity and storm rainfall patterns can shift.' }
  ];

  const PERIODS = [
    { id: 'annual', label: 'Whole year (annual mean)' },
    { id: 'DJF', label: 'Winter (Dec–Feb)' },
    { id: 'MAM', label: 'Spring (Mar–May)' },
    { id: 'JJA', label: 'Summer (Jun–Aug)' },
    { id: 'SON', label: 'Autumn (Sep–Nov)' },
    { id: 'monthly', label: 'Every month, seasonal cycle removed' },
    { id: 'm1', label: 'January only' }, { id: 'm2', label: 'February only' }, { id: 'm3', label: 'March only' },
    { id: 'm4', label: 'April only' }, { id: 'm5', label: 'May only' }, { id: 'm6', label: 'June only' },
    { id: 'm7', label: 'July only' }, { id: 'm8', label: 'August only' }, { id: 'm9', label: 'September only' },
    { id: 'm10', label: 'October only' }, { id: 'm11', label: 'November only' }, { id: 'm12', label: 'December only' }
  ];

  const byId = Object.fromEntries(VARIABLES.map(v => [v.id, v]));
  root.ETVars = { VARIABLES, THEMES, ARCHETYPES, PERIODS, byId };
})(typeof window !== 'undefined' ? window : globalThis);
