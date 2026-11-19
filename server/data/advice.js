/**
 * Content for the built-in (rule-based) plan. Kept apart from the selection logic in
 * `services/fallback.js` so wording can be edited or translated without touching code.
 * Entries that depend on the situation are functions of that situation.
 */
const item = (title, action, impact) => ({ title, action, impact });

/** Built-in, rule-based advice text used when the AI is unavailable. */
export const ADVICE = Object.freeze({
  exercise: {
    indoors: (aqi) =>
      item(
        'Move outdoor exercise indoors',
        'Skip running or sport outside today; do a home workout or visit an indoor gym.',
        `Hard breathing multiplies how much PM2.5 reaches your lungs. Today's AQI is ${aqi}, so staying inside cuts that dose sharply.`,
      ),
    cleanWindow: item(
      'Exercise in the cleanest window',
      'Plan outdoor activity for mid-afternoon, away from busy roads and rush hours.',
      'Traffic fumes (NO₂ and fine particles) peak at rush hour and drop away from main roads, lowering what you inhale.',
    ),
  },

  /** One tip per commute mode; `cycle` adapts to how poor the air is. */
  commute: {
    car: item(
      'Share or swap one car trip',
      'Carpool, or replace one short trip a week with transit, a bike or a walk.',
      'Each avoided cold-start short trip removes the highest-emission part of a car journey from your street.',
    ),
    motorbike: item(
      'Swap one short ride for transit or walking',
      'Use public transport or walk for trips under 2 km.',
      'Two-stroke and older motorbike engines emit disproportionate particulates; fewer short trips directly lowers local PM.',
    ),
    public_transport: item(
      'Keep riding transit, choose quieter routes',
      'Walk the last stretch along side streets rather than main roads.',
      'Transit already cuts per-person emissions; side streets can have noticeably lower roadside pollution than arterials.',
    ),
    walk: item(
      'Choose back-street walking routes',
      'Take parks or side streets and avoid waiting beside idling traffic.',
      'Roadside concentrations fall quickly with distance from heavy traffic, reducing your exposure on the same trip.',
    ),
    cycle: (poorAir) =>
      item(
        'Cycle on low-traffic routes',
        poorAir
          ? 'On high-AQI days, switch to transit or wear a well-fitted FFP2/N95 mask.'
          : 'Use quieter streets or bike paths.',
        'Cycling is zero-emission; avoiding busy roads and high-AQI hours lowers the extra pollution you breathe while exerting.',
      ),
    work_from_home: item(
      'Batch errands into one trip',
      'Combine shopping and errands into a single outing at off-peak hours.',
      'Fewer separate trips means fewer cold starts and less time exposed to peak traffic fumes.',
    ),
  },

  checkAqi: item(
    'Check AQI before you leave',
    'Look at the forecast each morning and shift flexible plans to the cleanest hours.',
    'Daily exposure is driven by a few bad hours; timing outings around them cuts your total dose at no cost.',
  ),

  sensitiveMembers: (poorAir) =>
    item(
      'Protect the most sensitive family members',
      poorAir
        ? 'Keep children, older adults and anyone with lung conditions indoors; avoid outdoor play today.'
        : 'Keep reliever medication handy and watch for coughing or wheezing during outings.',
      'Children, older adults and people with asthma are affected at lower pollution levels, so protecting them gives the biggest health gain.',
    ),

  ventilation: {
    burst: item(
      'Ventilate in short, smart bursts',
      'Open windows briefly at off-peak hours (late night/early morning) instead of all day.',
      'Outdoor PM2.5 enters through open windows; short, well-timed airing refreshes CO₂ and moisture while limiting particle intake.',
    ),
    crossFlow: item(
      'Air the home properly',
      'Open windows on opposite sides for 10 minutes to flush stale air.',
      'Cross-ventilation clears indoor CO₂, cooking by-products and VOCs when outdoor air is clean.',
    ),
  },

  cooking: {
    vent: item(
      'Vent every cooking session',
      'Run the exhaust fan or open a window while cooking and 10 minutes after; use lids to shorten burn time.',
      'Combustion cooking is a major indoor source of PM2.5 and NO₂; venting removes it at the source before you breathe it.',
    ),
    fan: item(
      'Use the cooktop fan on high-heat dishes',
      'Switch on the extractor when frying or sautéing.',
      'Frying releases fine particles and oil aerosols even on electric hobs; extraction reduces them quickly.',
    ),
  },

  purifier: {
    diy: item(
      'Build a low-cost DIY air cleaner',
      'Strap a HEPA or MERV-13 furnace filter to a box fan (filter on the intake side) in the main room.',
      'Such cleaners can cut indoor PM2.5 substantially at a fraction of a purifier’s price, especially in a closed bedroom.',
    ),
    run: item(
      'Run your purifier where you spend most time',
      'Place it in the bedroom or living room with doors closed, and replace filters on schedule.',
      'A HEPA filter removes most fine particles in a closed room, but a clogged filter stops working.',
    ),
  },

  dampDust: item(
    'Damp-dust instead of sweeping',
    'Wipe surfaces and mop rather than dry sweep; vacuum with a HEPA bag.',
    'Dry sweeping resuspends settled dust and allergens into the air you breathe.',
  ),

  cleanRoom: (home) =>
    item(
      'Add a sealed “clean room”',
      home === 'apartment'
        ? 'Seal gaps around the bedroom door and windows with draught strips.'
        : 'Pick one room to keep windows shut on bad-air days and filter it.',
      'A well-sealed room keeps outdoor particles out, giving a protected space for sleeping or for sensitive family members.',
    ),

  alternatives: {
    shortTrips: item(
      'Switch short trips to walking or cycling',
      'Replace trips under 3 km with a walk or bike ride at least three times a week.',
      'Removes tailpipe emissions on the shortest, least efficient journeys and cuts local NO₂ and PM.',
    ),
    transit: item(
      'Choose public or shared transport for longer trips',
      'Use metro, bus or a carpool for regular commutes.',
      'One bus or train carrying many people displaces dozens of cars, lowering per-person emissions.',
    ),
    induction: item(
      'Move toward induction or electric cooking',
      'Use an induction hob for daily cooking; reserve gas or biomass for backup.',
      'Induction has no on-site combustion, removing a major source of indoor NO₂ and particles and lowering household emissions as the grid cleans up.',
    ),
    noBurning: item(
      'Never burn waste or leaves',
      'Compost garden waste and use municipal collection for rubbish.',
      'Open burning releases dense smoke, dioxins and fine particles that settle in your own neighbourhood.',
    ),
    offPeak: item(
      'Cut electricity-peak use',
      'Run heavy appliances off-peak and choose efficient (LED, 5-star) appliances.',
      'Lower power demand reduces fuel burned at power plants, a significant source of regional pollution.',
    ),
  },

  /** One-line guidance per AQI band, used in the plan summary. */
  summary: {
    good: 'Air is clean today — a good day for outdoor activity.',
    moderate: 'Air is acceptable, but unusually sensitive people should take it easier outdoors.',
    sensitive: 'Sensitive family members should limit time outdoors today.',
    unhealthy: 'Everyone should reduce prolonged outdoor exertion today.',
    very_unhealthy: 'Avoid outdoor exertion and keep windows closed today.',
    hazardous: 'Stay indoors with filtered air today; avoid all outdoor exertion.',
  },
});
