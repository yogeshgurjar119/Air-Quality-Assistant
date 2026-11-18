/**
 * Major world cities used for the "how does your city compare" ranking.
 * One batched Open-Meteo call covers all of them, so the comparison costs a single request.
 */
export const MAJOR_CITIES = Object.freeze([
  { name: 'Delhi', country: 'India', code: 'IN', latitude: 28.61, longitude: 77.21 },
  { name: 'Mumbai', country: 'India', code: 'IN', latitude: 19.08, longitude: 72.88 },
  { name: 'Kolkata', country: 'India', code: 'IN', latitude: 22.57, longitude: 88.36 },
  { name: 'Bengaluru', country: 'India', code: 'IN', latitude: 12.97, longitude: 77.59 },
  { name: 'Lahore', country: 'Pakistan', code: 'PK', latitude: 31.55, longitude: 74.34 },
  { name: 'Dhaka', country: 'Bangladesh', code: 'BD', latitude: 23.81, longitude: 90.41 },
  { name: 'Beijing', country: 'China', code: 'CN', latitude: 39.9, longitude: 116.4 },
  { name: 'Shanghai', country: 'China', code: 'CN', latitude: 31.23, longitude: 121.47 },
  { name: 'Tokyo', country: 'Japan', code: 'JP', latitude: 35.68, longitude: 139.69 },
  { name: 'Seoul', country: 'South Korea', code: 'KR', latitude: 37.57, longitude: 126.98 },
  { name: 'Bangkok', country: 'Thailand', code: 'TH', latitude: 13.76, longitude: 100.5 },
  { name: 'Jakarta', country: 'Indonesia', code: 'ID', latitude: -6.21, longitude: 106.85 },
  { name: 'Cairo', country: 'Egypt', code: 'EG', latitude: 30.04, longitude: 31.24 },
  { name: 'Lagos', country: 'Nigeria', code: 'NG', latitude: 6.52, longitude: 3.38 },
  { name: 'Johannesburg', country: 'South Africa', code: 'ZA', latitude: -26.2, longitude: 28.05 },
  { name: 'Istanbul', country: 'Türkiye', code: 'TR', latitude: 41.01, longitude: 28.98 },
  { name: 'Moscow', country: 'Russia', code: 'RU', latitude: 55.76, longitude: 37.62 },
  { name: 'London', country: 'United Kingdom', code: 'GB', latitude: 51.51, longitude: -0.13 },
  { name: 'Paris', country: 'France', code: 'FR', latitude: 48.86, longitude: 2.35 },
  { name: 'Berlin', country: 'Germany', code: 'DE', latitude: 52.52, longitude: 13.4 },
  { name: 'New York', country: 'United States', code: 'US', latitude: 40.71, longitude: -74.01 },
  { name: 'Los Angeles', country: 'United States', code: 'US', latitude: 34.05, longitude: -118.24 },
  { name: 'Mexico City', country: 'Mexico', code: 'MX', latitude: 19.43, longitude: -99.13 },
  { name: 'São Paulo', country: 'Brazil', code: 'BR', latitude: -23.55, longitude: -46.63 },
  { name: 'Sydney', country: 'Australia', code: 'AU', latitude: -33.87, longitude: 151.21 },
]);
