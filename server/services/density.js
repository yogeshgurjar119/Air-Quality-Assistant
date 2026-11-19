import { SPARQL_URL } from '../data/endpoints.js';
import { fetchJson } from './http.js';
const SQ_METRES_PER_SQ_KM = 1_000_000;

/** Wikidata links GeoNames ids (P1566) to population (P1082) and area (P2046, normalised to m²). */
const buildQuery = (geonamesId) =>
  `SELECT ?pop ?area WHERE { ?c wdt:P1566 "${Number(geonamesId)}". ` +
  'OPTIONAL { ?c wdt:P1082 ?pop } OPTIONAL { ?c p:P2046/psn:P2046/wikibase:quantityAmount ?area } } LIMIT 1';

/**
 * Parses a SPARQL result into population density. Exported for unit testing.
 * Returns null when population or area is missing or implausible.
 */
export const parseDensity = (data) => {
  const row = data?.results?.bindings?.[0];
  const population = Number(row?.pop?.value);
  const areaKm2 = Number(row?.area?.value) / SQ_METRES_PER_SQ_KM;
  if (!(population > 0) || !(areaKm2 > 0)) return null;
  return {
    population: Math.round(population),
    areaKm2: Math.round(areaKm2),
    perKm2: Math.round(population / areaKm2),
  };
};

/** City population density from Wikidata (free, no API key). Null when unavailable. */
export const fetchDensity = async (geonamesId, options) => {
  if (!Number.isInteger(geonamesId)) return null;
  const url = `${SPARQL_URL}?${new URLSearchParams({ query: buildQuery(geonamesId), format: 'json' })}`;
  const data = await fetchJson(url, {
    ...options,
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'AirWise/1.0' },
  });
  return parseDensity(data);
};
