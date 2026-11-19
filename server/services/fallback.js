import { ADVICE } from '../data/advice.js';
import { severity } from './aqi.js';

const MAX_ITEMS_PER_SECTION = 5;
/** Fuels that burn indoors, so cooking needs ventilation and induction is a real upgrade. */
const COMBUSTION_FUELS = new Set(['lpg_gas', 'biomass', 'mixed']);

const isAtLeast = (air, level) => severity(air.level) >= severity(level);

// ── Daily routines ──────────────────────────────────────────────────────────────────────────
const exerciseTip = ({ air }) =>
  isAtLeast(air, 'sensitive') ? ADVICE.exercise.indoors(air.aqi) : ADVICE.exercise.cleanWindow;

const commuteTip = ({ air, profile }) => {
  const tip = ADVICE.commute[profile.commute];
  return typeof tip === 'function' ? tip(isAtLeast(air, 'sensitive')) : tip;
};

const sensitiveMembersTip = ({ air, profile }) =>
  profile.vulnerable.length > 0 ? ADVICE.sensitiveMembers(isAtLeast(air, 'sensitive')) : null;

const routines = (context) =>
  [exerciseTip(context), commuteTip(context), ADVICE.checkAqi, sensitiveMembersTip(context)].filter(Boolean);

// ── Indoor air ──────────────────────────────────────────────────────────────────────────────
const ventilationTip = ({ air }) =>
  isAtLeast(air, 'moderate') ? ADVICE.ventilation.burst : ADVICE.ventilation.crossFlow;
const cookingTip = ({ profile }) => (COMBUSTION_FUELS.has(profile.cooking) ? ADVICE.cooking.vent : ADVICE.cooking.fan);
const purifierTip = ({ profile }) => (profile.purifier === 'none' ? ADVICE.purifier.diy : ADVICE.purifier.run);

const indoor = (context) => [
  ventilationTip(context),
  cookingTip(context),
  purifierTip(context),
  ADVICE.dampDust,
  ADVICE.cleanRoom(context.profile.home),
];

// ── Sustainable alternatives ────────────────────────────────────────────────────────────────
const inductionTip = ({ profile }) => (COMBUSTION_FUELS.has(profile.cooking) ? ADVICE.alternatives.induction : null);

const alternatives = (context) =>
  [
    ADVICE.alternatives.shortTrips,
    ADVICE.alternatives.transit,
    inductionTip(context),
    ADVICE.alternatives.noBurning,
    ADVICE.alternatives.offPeak,
  ].filter(Boolean);

const summarize = ({ air, location }) =>
  `${location.name} AQI is ${air.aqi} (${air.label}). ${ADVICE.summary[air.level]}`;

/** Rule-based plan used when no LLM is available or the LLM call fails. */
export const buildFallbackPlan = (context) => ({
  summary: summarize(context),
  routines: routines(context).slice(0, MAX_ITEMS_PER_SECTION),
  indoor: indoor(context).slice(0, MAX_ITEMS_PER_SECTION),
  alternatives: alternatives(context).slice(0, MAX_ITEMS_PER_SECTION),
});
