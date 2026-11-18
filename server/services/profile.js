import { HttpError } from '../errors.js';

/** Allowed values for each lifestyle field. Single source of truth for validation and prompts. */
export const OPTIONS = Object.freeze({
  commute: ['walk', 'cycle', 'public_transport', 'car', 'motorbike', 'work_from_home'],
  cooking: ['electric', 'induction', 'lpg_gas', 'biomass', 'mixed'],
  home: ['apartment', 'house'],
  purifier: ['none', 'hepa_purifier', 'diy_filter'],
  vulnerable: ['children', 'elderly', 'asthma_or_lung_condition', 'pregnancy', 'none'],
});

const MAX_CITY_LENGTH = 80;
const CITY_PATTERN = /^[\p{L}\p{M}0-9 .,'’()-]+$/u;

const pickEnum = (field, value) => {
  if (!OPTIONS[field].includes(value)) {
    throw new HttpError(400, `Invalid value for "${field}".`);
  }
  return value;
};

/** Validates and normalises an untrusted city name. */
export const parseCity = (value) => {
  const city = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  const hasLetter = /\p{L}/u.test(city);
  if (city.length < 2 || city.length > MAX_CITY_LENGTH || !hasLetter || !CITY_PATTERN.test(city)) {
    throw new HttpError(400, 'Please enter a valid city name (2–80 letters).');
  }
  return city;
};

export const requireObject = (body) => {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  return body;
};

/** Validates and normalises untrusted request input into a lifestyle profile. */
export const parseProfile = (input) => {
  const body = requireObject(input);
  const city = parseCity(body.city);

  const rawVulnerable = Array.isArray(body.vulnerable) ? body.vulnerable : [];
  const vulnerable = [...new Set(rawVulnerable.map((v) => pickEnum('vulnerable', v)))].filter(
    (v) => v !== 'none',
  );

  return {
    city,
    commute: pickEnum('commute', body.commute),
    cooking: pickEnum('cooking', body.cooking),
    home: pickEnum('home', body.home),
    purifier: pickEnum('purifier', body.purifier),
    vulnerable,
  };
};
