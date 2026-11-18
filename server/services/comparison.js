const NEAR_DEGREES = 0.5;

const isSameCity = (a, b) =>
  Math.abs(a.latitude - b.latitude) < NEAR_DEGREES && Math.abs(a.longitude - b.longitude) < NEAR_DEGREES;

/**
 * Ranks the user's city among major world cities (most polluted first) and, when other major
 * cities share the user's country, adds a country-level average. Returns null without world data.
 */
export const buildComparison = ({ location, air }, world) => {
  if (!world || world.length === 0) return null;

  const you = {
    name: location.name,
    country: location.country,
    code: location.countryCode,
    aqi: air.aqi,
    level: air.level,
    isYou: true,
  };
  const others = world.filter((city) => !isSameCity(city, location));
  const cities = [...others, you]
    .sort((a, b) => b.aqi - a.aqi)
    .map(({ name, country, code, aqi, level, isYou = false }) => ({ name, country, code, aqi, level, isYou }));

  const countryCities = cities.filter((city) => location.countryCode && city.code === location.countryCode);
  const countryAverage =
    countryCities.length > 1
      ? Math.round(countryCities.reduce((sum, city) => sum + city.aqi, 0) / countryCities.length)
      : null;

  return {
    cities,
    rank: cities.findIndex((city) => city.isYou) + 1,
    total: cities.length,
    country: location.country,
    countryAverage,
    countryCityCount: countryCities.length,
  };
};
