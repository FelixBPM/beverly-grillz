// ============================================================
// BURNING MAN DATA EMBARGO — single source of truth
// ============================================================
// This file is imported by BOTH the Node sync job (bm-sync.mjs) and the
// browser client (PlayaData.jsx). Keep it dependency-free and plain ESM so
// both runtimes can load it unchanged.
//
// BMorg's terms are explicit: developers receive location data early, but
// must not publish it to users until a stated date. For 2026:
//
//   Camp locations  — developers Aug 9,  public Aug 23 (Sunday before event)
//   Art locations   — developers Aug 9,  public Aug 30 (when gates open)
//
// Source: https://innovate.burningman.org/apis-page/
//
// Violating this is the single easiest way for a camp to lose API access, so
// the embargo is enforced at the SYNC boundary (see bm-sync.mjs), not just in
// the UI. Location fields are stripped before anything is written to
// Supabase, because the Supabase anon key is public — anything sitting in
// kv_store is effectively published whether or not a component renders it.
// The client checks below are a second layer, not the primary control.

export const BM_YEAR = 2026;

// Release instants, expressed in UTC. Black Rock City runs on Pacific time;
// Aug 2026 is PDT (UTC-7), so 00:00 PDT == 07:00 UTC the same day.
//
// These are deliberately the EARLIEST defensible moment. If you want to be
// more conservative, push them later — never earlier.
export const RELEASE = {
  // Camp placements: public from the Sunday of the week before the event.
  camps: '2026-08-23T07:00:00Z',
  // Art placements: public only once gates actually open.
  art: '2026-08-30T07:00:00Z',
};

// Events are hosted AT camps and art pieces, so an event's location string
// leaks a camp placement. Event locations therefore inherit the camp embargo.
RELEASE.events = RELEASE.camps;

/**
 * Has the location embargo lifted for this collection?
 * @param {'camps'|'art'|'events'} kind
 * @param {Date} [now] - injectable for testing
 */
export function locationsReleased(kind, now = new Date()) {
  const iso = RELEASE[kind];
  if (!iso) return true; // unknown collection => no embargo claimed
  return now.getTime() >= Date.parse(iso);
}

/** Human-readable release date, e.g. "August 23". */
export function releaseLabel(kind) {
  const iso = RELEASE[kind];
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

/** Whole days until release; 0 once released. */
export function daysUntilRelease(kind, now = new Date()) {
  const iso = RELEASE[kind];
  if (!iso) return 0;
  const ms = Date.parse(iso) - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86400000);
}

// ------------------------------------------------------------
// FIELD STRIPPING
// ------------------------------------------------------------
// Rather than allow-listing the exact field names BMorg uses (which have
// changed between API versions, and which we cannot fully confirm without a
// live key), we deny-list anything that smells like a placement. Over-
// stripping costs us a field we could have shown; under-stripping is a ToS
// violation. The asymmetry is the whole point.
//
// Matching is done on TOKENS, not raw substrings. A naive /lat|lon/ substring
// test also eats `long_description`, `related`, and `translation` — which
// would quietly delete the art descriptions we actually want to show. Keys are
// split on separators and camelCase humps first, then compared whole.
const LOCATION_TOKENS = new Set([
  'location', 'locations', 'located',
  'gps', 'lat', 'latitude', 'lon', 'lng', 'longitude',
  'coord', 'coords', 'coordinate', 'coordinates',
  'address', 'placement', 'placed', 'position',
  'street', 'frontage', 'intersection', 'plaza', 'block', 'sector',
  'hour', 'minute', 'clock', 'distance',
  // BRC-specific vocabulary that a future API version might use instead
  'neighborhood', 'quadrant', 'radial', 'ring', 'esplanade', 'portal',
  'zone', 'geo', 'avenue', 'corner', 'site',
  // "look for the neon tooth" is how you find a camp — same thing as an address
  'landmark', 'landmarks',
]);

function keyTokens(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(t => t.toLowerCase());
}

function isLocationKey(key) {
  const tokens = keyTokens(key);
  return tokens.some(t => LOCATION_TOKENS.has(t));
}

/**
 * Recursively remove location-bearing keys from an API record.
 * Returns a new object; the input is not mutated.
 */
export function stripLocations(value) {
  if (Array.isArray(value)) return value.map(stripLocations);
  if (value === null || typeof value !== 'object') return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (isLocationKey(k)) continue;
    out[k] = stripLocations(v);
  }
  return out;
}

// ------------------------------------------------------------
// FREE-TEXT SCRUBBING
// ------------------------------------------------------------
// Removing location KEYS is not enough. Camp and event descriptions are
// written by campers, and they very often contain the address in prose:
//
//   "Cocktails nightly — come find us at 7:30 & E!"
//
// That text arrives in the `description` field, which we obviously want to
// keep, so key-stripping sails right past it. These patterns catch BRC
// addresses embedded in ordinary sentences.
//
// This is a heuristic, and heuristics on free text are never total. It runs
// only while an embargo is active, so a false positive costs one temporarily
// redacted sentence and nothing more — the full text comes back on release
// day. That trade is deliberately lopsided in the safe direction.
const ADDRESS_PATTERNS = [
  // "7:30 & E", "9:00 and Esplanade", "3:00 @ Ballyhoo
  /\b(?:1[0-2]|[1-9]):[0-5]\d\s*(?:&|and|@|,)\s*(?:[A-L]\b|Esplanade|Espl\b|Plaza|Portal|Rod'?s\s+Road|Airport|[A-Z][a-z]{2,})/gi,
  // Reversed: "E & 7:30", "Esplanade and 9:00"
  /\b(?:[A-L]|Esplanade|Espl|Plaza|Portal)\s*(?:&|and|@)\s*(?:1[0-2]|[1-9]):[0-5]\d\b/gi,
  // Clock plus radial distance in feet: "9:00 3000"
  /\b(?:1[0-2]|[1-9]):[0-5]\d\s+\d{3,4}\b/g,
  // Decimal GPS pairs anywhere near Black Rock City
  /\b4[01]\.\d{3,}\s*[,\s]\s*-?\s*1(?:19|20)\.\d{3,}/g,
];

/** Redact BRC addresses found inside a free-text string. */
export function scrubAddressText(str, label = 'location withheld') {
  if (typeof str !== 'string' || !str) return str;
  let out = str;
  for (const re of ADDRESS_PATTERNS) {
    out = out.replace(re, `[${label}]`);
  }
  return out;
}

/**
 * Scan arbitrary text for anything that still looks like a BRC address.
 * Returns the offending matches, or [] if clean.
 *
 * This exists to be run over the FINAL payload, immediately before it is
 * written. Every other control in this file depends on my having correctly
 * predicted BMorg's field names. This one does not — it reads the finished
 * bytes and asks "is there an address in here", which is the actual question.
 */
export function findAddressLeaks(text) {
  const hits = [];
  for (const re of ADDRESS_PATTERNS) {
    // Regexes are /g, so reset lastIndex before reuse.
    re.lastIndex = 0;
    const found = String(text).match(re);
    if (found) hits.push(...found);
  }
  return [...new Set(hits)];
}

/** Recursively scrub every string value in a record. */
function scrubValues(value, label) {
  if (typeof value === 'string') return scrubAddressText(value, label);
  if (Array.isArray(value)) return value.map(v => scrubValues(v, label));
  if (value === null || typeof value !== 'object') return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = scrubValues(v, label);
  return out;
}

/**
 * Apply the embargo to a list of records for a collection.
 *
 * Two passes, because they catch different things:
 *   1. stripLocations — removes location-bearing KEYS
 *   2. scrubValues    — removes addresses written into free-text VALUES
 *
 * Adds `locationEmbargoed: true` so the UI can render an honest placeholder
 * instead of silently showing a record with a missing field.
 */
export function applyEmbargo(kind, records, now = new Date()) {
  if (locationsReleased(kind, now)) {
    return records.map(r => ({ ...r, locationEmbargoed: false }));
  }
  const label = `address withheld until ${releaseLabel(kind)}`;
  return records.map(r => ({
    ...scrubValues(stripLocations(r), label),
    locationEmbargoed: true,
  }));
}
