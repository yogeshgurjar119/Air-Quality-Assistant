/** Pure wizard logic (no DOM) so it can be unit-tested in Node. */

/** The questionnaire steps in order. */
export const STEPS = Object.freeze([
  { id: 'place', label: 'Place', title: 'Where do you live?' },
  { id: 'travel', label: 'Daily life', title: 'How do you get around and cook?' },
  { id: 'home', label: 'Home', title: 'Tell us about your home and family' },
  { id: 'review', label: 'Review', title: 'Ready for your plan' },
]);

/** Index of the final (review) step. */
export const LAST_STEP = STEPS.length - 1;

/** Human-readable labels for every answer, keyed by profile field. */
export const LABELS = Object.freeze({
  commute: {
    car: 'Car',
    motorbike: 'Motorbike / scooter',
    public_transport: 'Public transport',
    walk: 'Walk',
    cycle: 'Cycle',
    work_from_home: 'Work from home',
  },
  cooking: {
    lpg_gas: 'LPG / natural gas',
    electric: 'Electric',
    induction: 'Induction',
    biomass: 'Wood / charcoal',
    mixed: 'Mixed',
  },
  home: { apartment: 'Apartment', house: 'House' },
  purifier: { none: 'No air cleaning', hepa_purifier: 'HEPA purifier', diy_filter: 'DIY box-fan filter' },
  vulnerable: {
    children: 'Children',
    elderly: 'Older adults',
    asthma_or_lung_condition: 'Asthma or lung condition',
    pregnancy: 'Pregnancy',
  },
});

/** Keeps a step index within the valid range. */
export const clampStep = (index) => Math.min(Math.max(index, 0), LAST_STEP);

/** Returns an error message if the answers on `stepIndex` are incomplete, otherwise null. */
export const validateStep = (stepIndex, profile) =>
  stepIndex === 0 && profile.city.trim().length < 2 ? 'Please enter your city.' : null;

/** Turns a profile into [label, value] rows for the review step. */
export const summarizeProfile = (profile) => [
  ['City', profile.city],
  ['Getting around', LABELS.commute[profile.commute] ?? '—'],
  ['Cooking fuel', LABELS.cooking[profile.cooking] ?? '—'],
  ['Home', LABELS.home[profile.home] ?? '—'],
  ['Air cleaning', LABELS.purifier[profile.purifier] ?? '—'],
  [
    'Sensitive members',
    profile.vulnerable.length ? profile.vulnerable.map((key) => LABELS.vulnerable[key] ?? key).join(', ') : 'None',
  ],
];
