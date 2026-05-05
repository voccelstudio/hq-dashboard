// Ciudades del world clock (las 4 fijas + tu ubicación dinámica)
// mapX/mapY son coords aproximadas en el SVG de 1000x500 del world-map
export const CITIES = [
  { code: 'TIJ', name: 'BAJA_CAL', city: 'Tijuana',  country: 'MX', tz: 'America/Tijuana',  lat: 32.5149, lon: -117.0382, mapX: 175, mapY: 195 },
  { code: 'SGN', name: 'SINGEN',   city: 'Singen',   country: 'DE', tz: 'Europe/Berlin',    lat: 47.7596, lon:    8.8400, mapX: 510, mapY: 145 },
  { code: 'KOL', name: 'KOLKATA',  city: 'Kolkata',  country: 'IN', tz: 'Asia/Kolkata',     lat: 22.5726, lon:   88.3639, mapX: 720, mapY: 215 },
  { code: 'BIO', name: 'BILBAO',   city: 'Bilbao',   country: 'ES', tz: 'Europe/Madrid',    lat: 43.2630, lon:   -2.9350, mapX: 478, mapY: 158 },
];
