// ============================================================
// BLACK ROCK CITY GEOMETRY
// ============================================================
// Everything needed to answer "how far, and which way" on playa.
//
// WHERE THESE CONSTANTS CAME FROM
// -------------------------------
// They were not looked up or guessed. BMorg's art records carry BOTH a clock
// address (hour/minute + radial distance in feet) and true GPS. That is an
// over-determined system, so the city's centre and rotation can be solved for
// directly: a grid search over the bearing of the 12:00 radial, taking the
// centre as the mean residual at each candidate.
//
// Fitted against all 324 placed 2025 art installations:
//
//     bearing of 12:00 : 45.000°   (dead northeast — a round number falling
//                                   out of a numerical fit is a good sign the
//                                   model is right, not fudged)
//     Golden Spike     : 40.7869512, -119.2030053
//     RMS error        : 10 feet
//
// Ten feet across 324 points is inside the rounding of the published clock
// addresses themselves, so the model is as accurate as the source data.
//
// RE-FIT THIS EACH YEAR. Black Rock City is surveyed and rebuilt annually and
// the Golden Spike moves. `fitCityGeometry()` below re-derives all of it from
// whatever art data is loaded, so this is a one-line update, not a research
// task.

export const CITY = {
  year: 2025,
  goldenSpike: { lat: 40.7869512, lon: -119.2030053 },
  bearingOf12: 45.0,
  fitRmsFeet: 10,
  fitSampleSize: 324,
};

// Feet per degree of latitude is near enough constant; longitude shrinks with
// the cosine of latitude. At BRC's 40.79° that is about a 24% difference, so
// it matters — treating them as equal would put a mile-out art piece hundreds
// of feet off.
const FT_PER_DEG_LAT = 364000;
const ftPerDegLon = (lat) => FT_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// ------------------------------------------------------------
// CORE MATH
// ------------------------------------------------------------

/** Great-circle distance in feet. */
export function distanceFeet(a, b) {
  const R = 20902231; // Earth radius, feet
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** True bearing from a to b, degrees clockwise from north. */
export function bearingDegrees(a, b) {
  const dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// ------------------------------------------------------------
// PLAYA COORDINATES
// ------------------------------------------------------------
// Burners navigate by clock position, not by compass. "Head toward 4:30" is
// immediately actionable in a way "bearing 180°" is not, because the city's
// radial streets are literally labelled with those numbers.

/** A true bearing expressed as a BRC clock position, e.g. "4:30". */
export function bearingToClock(bearingDeg, city = CITY) {
  let a = (bearingDeg - city.bearingOf12 + 360) % 360;
  let totalMinutes = Math.round((a / 360) * 720); // 12 hours of 60 minutes
  totalMinutes = ((totalMinutes % 720) + 720) % 720;
  let h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Where a lat/lon sits in playa terms: clock position and feet from the Man. */
export function toPlaya(pt, city = CITY) {
  const d = distanceFeet(city.goldenSpike, pt);
  const b = bearingDegrees(city.goldenSpike, pt);
  return { clock: bearingToClock(b, city), distanceFeet: d, bearing: b };
}

/** The inverse: a clock address back to lat/lon. */
export function playaToLatLon(hour, minute, distFt, city = CITY) {
  const ang = rad(city.bearingOf12 + (hour % 12) * 30 + minute * 0.5);
  const { lat, lon } = city.goldenSpike;
  return {
    lat: lat + (distFt * Math.cos(ang)) / FT_PER_DEG_LAT,
    lon: lon + (distFt * Math.sin(ang)) / ftPerDegLon(lat),
  };
}

/**
 * Pull usable coordinates off an API record, or null.
 * Art carries real GPS. Camps in the archive carry only frontage/intersection,
 * so they return null and the UI degrades to a bearing rather than inventing
 * a distance it cannot know.
 */
export function coordsOf(record) {
  const l = record?.location;
  if (l && typeof l.gps_latitude === 'number' && typeof l.gps_longitude === 'number') {
    return { lat: l.gps_latitude, lon: l.gps_longitude };
  }
  return null;
}

/**
 * The clock angle of a record even when it has no GPS — camps publish
 * `intersection` ("3:15"), which is exactly the bearing half of the answer.
 */
export function clockOf(record) {
  const l = record?.location;
  if (!l) return null;
  if (typeof l.hour === 'number' && typeof l.minute === 'number') {
    return `${l.hour}:${String(l.minute).padStart(2, '0')}`;
  }
  if (typeof l.intersection === 'string' && /^\d{1,2}:\d{2}$/.test(l.intersection.trim())) {
    return l.intersection.trim();
  }
  return null;
}

/** Clock string -> true bearing, for pointing at a camp with no GPS. */
export function clockToBearing(clock, city = CITY) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(clock).trim());
  if (!m) return null;
  const h = Number(m[1]) % 12;
  return (city.bearingOf12 + h * 30 + Number(m[2]) * 0.5) % 360;
}

// ------------------------------------------------------------
// PRESENTATION
// ------------------------------------------------------------

/** Feet under half a mile, miles above — how people actually talk out there. */
export function formatDistance(ft) {
  if (!isFinite(ft)) return '';
  if (ft < 1000) return `${Math.round(ft / 10) * 10} ft`;
  if (ft < 2640) return `${Math.round(ft / 50) * 50} ft`;
  return `${(ft / 5280).toFixed(1)} mi`;
}

/** Rough walking time. ~3 mph on flat ground, slower in deep dust. */
export function walkMinutes(ft) {
  return Math.max(1, Math.round(ft / 250));
}

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export function compassPoint(bearing) {
  return COMPASS[Math.round(((bearing % 360) / 22.5)) % 16];
}

// ------------------------------------------------------------
// ANNUAL RE-FIT
// ------------------------------------------------------------

/**
 * Re-derive the city's centre and rotation from any set of art records that
 * carry both GPS and a clock address. Run this once when the new year's data
 * lands and paste the result into CITY above.
 *
 *   import { fitCityGeometry } from './playa-geo';
 *   console.log(fitCityGeometry(artRecords));
 */
export function fitCityGeometry(artRecords) {
  const pts = (artRecords || [])
    .map(a => a.location)
    .filter(l => l && l.gps_latitude != null && l.distance > 0)
    .map(l => ({
      lat: l.gps_latitude,
      lon: l.gps_longitude,
      ang: (l.hour % 12) * 30 + l.minute * 0.5,
      d: l.distance,
    }));
  if (pts.length < 20) return null;

  const meanLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const fpdLon = ftPerDegLon(meanLat);

  let best = null;
  for (let b0 = 0; b0 < 360; b0 += 0.05) {
    let sLat = 0, sLon = 0;
    for (const p of pts) {
      const th = rad(b0 + p.ang);
      sLat += p.lat - (p.d * Math.cos(th)) / FT_PER_DEG_LAT;
      sLon += p.lon - (p.d * Math.sin(th)) / fpdLon;
    }
    const lat0 = sLat / pts.length, lon0 = sLon / pts.length;
    let err = 0;
    for (const p of pts) {
      const th = rad(b0 + p.ang);
      const dLat = (p.lat - lat0) * FT_PER_DEG_LAT - p.d * Math.cos(th);
      const dLon = (p.lon - lon0) * fpdLon - p.d * Math.sin(th);
      err += dLat * dLat + dLon * dLon;
    }
    const rms = Math.sqrt(err / pts.length);
    if (!best || rms < best.rms) best = { b0, lat0, lon0, rms };
  }
  return {
    bearingOf12: +best.b0.toFixed(3),
    goldenSpike: { lat: +best.lat0.toFixed(7), lon: +best.lon0.toFixed(7) },
    fitRmsFeet: +best.rms.toFixed(1),
    fitSampleSize: pts.length,
  };
}
