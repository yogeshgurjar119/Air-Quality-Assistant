import { severity } from './aqi.js';

/** Topic matchers, checked in order. Each returns advice tailored to the live AQI band. */
const INTENTS = [
  {
    pattern: /\b(mask|n95|ffp2|respirator)\b/,
    advise: ({ poor }) =>
      poor
        ? 'A well-fitted N95/FFP2 mask cuts the fine particles you inhale when you must be outside. Cloth and surgical masks help much less.'
        : 'Masks are not needed at this level for most people, but sensitive family members may prefer a fitted N95/FFP2 near heavy traffic.',
  },
  {
    pattern: /\b(kid|kids|child|children|school|baby|infant|toddler)\b/,
    advise: ({ poor }) =>
      poor
        ? 'Children breathe faster and their lungs are still developing, so keep outdoor play and sport indoors today and use the cleanest hour for the school run.'
        : 'Outdoor play is fine for most children today. Avoid playing right beside busy roads, and keep reliever medication handy if a child has asthma.',
  },
  {
    pattern:
      /\b(exercise|jog|jogging|run|running|workout|gym|sport|sports|walk|cycling|cycle|outside|outdoor|outdoors|play)\b/,
    advise: ({ poor, best }) =>
      poor
        ? `Skip hard outdoor exercise today because heavy breathing pulls more fine particles deep into your lungs.${best ? ` If you must go out, the cleanest hour is around ${best}.` : ''}`
        : `Outdoor activity is fine today.${best ? ` The cleanest hour is around ${best}.` : ''} Choose parks or side streets over main roads.`,
  },
  {
    pattern: /\b(purifier|filter|hepa|indoor|indoors|inside|ventilat\w*|window|windows|air out|dust)\b/,
    advise: ({ poor }) =>
      poor
        ? 'Keep windows shut during the worst hours and run a HEPA purifier (or a box fan with a MERV-13 filter) in the room you use most. Air the home briefly at the cleanest hour.'
        : 'Open windows on opposite sides for about 10 minutes to flush stale air. Damp-dust instead of sweeping so dust does not get back into the air.',
  },
  {
    pattern: /\b(cook|cooking|stove|kitchen|gas|lpg|biomass|induction|fry|frying)\b/,
    advise: () =>
      'Cooking is a big indoor source of fine particles and NO2. Use the exhaust fan or open a window while cooking and for 10 minutes after, and use lids to shorten burn time. Induction avoids burning fuel indoors.',
  },
  {
    pattern: /\b(car|drive|driving|commute|traffic|bike|motorbike|scooter|transport|bus|metro|train)\b/,
    advise: () =>
      'Swapping even a few short car trips for walking, cycling or transit removes the highest-emission part of a journey from your street. If you drive, use recirculation mode and avoid idling.',
  },
  {
    pattern: /\b(when|time|best|cleanest|forecast|tomorrow|later|hour|hours)\b/,
    advise: ({ best }) =>
      best
        ? `The cleanest hour in the next 24 hours is around ${best}. Plan outdoor activity then, and avoid rush hours.`
        : 'Check the 24-hour chart above and plan outdoor time for the cleanest hour, away from rush hours.',
  },
];

const OVERVIEW = {
  good: 'Air is clean, so enjoy the outdoors.',
  moderate: 'Air is acceptable; unusually sensitive people should take it easier outdoors.',
  sensitive: 'Sensitive family members should limit time outdoors.',
  unhealthy: 'Everyone should reduce prolonged outdoor exertion.',
  very_unhealthy: 'Avoid outdoor exertion and keep windows closed.',
  hazardous: 'Stay indoors with filtered air and avoid all outdoor exertion.',
};

const formatHour = (iso) => (typeof iso === 'string' ? iso.slice(11, 16) : null);

/**
 * Rule-based chat answer built from live city data. Used when no AI model can respond,
 * so the assistant always says something useful and grounded.
 */
export const buildFallbackReply = ({ location, air }, question) => {
  const text = String(question).toLowerCase();
  const advice = {
    poor: severity(air.level) >= severity('sensitive'),
    best: formatHour(air.forecast?.best?.time),
  };
  const intent = INTENTS.find(({ pattern }) => pattern.test(text));
  const lead = `${location.name} AQI is ${air.aqi} (${air.label}).`;
  const body = intent
    ? intent.advise(advice)
    : `${OVERVIEW[air.level]} Ask me about exercise, kids, masks, indoor air, cooking or commuting.`;
  return `${lead} ${body}`;
};
