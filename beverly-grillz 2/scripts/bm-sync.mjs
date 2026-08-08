#!/usr/bin/env node
// ============================================================
// BEVERLY GRILLZ — BURNING MAN API SYNC
// ============================================================
// Pulls camps / art / events from the Burning Man Public API, applies the
// location embargo, and writes the result into the same Supabase `kv_store`
// table the rest of the site already reads from. The browser then loads it
// with the existing `load(key, default, true)` helper — no new client
// dependencies, no API key in the bundle.
//
// WHY A SERVER JOB AND NOT A fetch() IN THE APP
// ---------------------------------------------
// 1. The BM API key would be visible to anyone who opened devtools. Vite
//    inlines every VITE_* variable into the built JS.
// 2. api.burningman.org is a small community service. One request a night
//    beats one per pageview.
// 3. The embargo has to be enforced somewhere the public cannot see. The
//    Supabase anon key IS public, so anything written to kv_store is
//    published. Stripping has to happen HERE, before the write.
//
// USAGE
//   node bm-sync.mjs                 # fetch, apply embargo, write to Supabase
//   node bm-sync.mjs --dry-run       # do everything except the write
//   node bm-sync.mjs --probe         # print one raw record per collection
//   node bm-sync.mjs --full-dump     # write bm-<year>-full.json LOCALLY only
//   node bm-sync.mjs --archive 2025  # load a PAST year from the free public
//                                    # archive — no API key required at all
//
// ENV
//   BM_API_KEY                 required — from https://api.burningman.org/
//   SUPABASE_URL               required
//   SUPABASE_SERVICE_ROLE_KEY  preferred for writes (falls back to anon)
//   SUPABASE_ANON_KEY          fallback
//   BM_YEAR                    default 2026
//   BM_CAMP_NAME               your camp's name as registered, for matching
//   BM_CAMP_UID                more reliable than the name, once you know it

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  BM_YEAR as DEFAULT_YEAR,
  applyEmbargo,
  locationsReleased,
  releaseLabel,
  findAddressLeaks,
} from '../src/bm-embargo.js';

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------

const API_ROOT = 'https://api.burningman.org/api/v1';

// Burning Man publishes finished years as flat JSON on S3, free and keyless:
//   https://bm-innovate.s3.amazonaws.com/archive/2025/camps.json
// Past years carry no embargo — the event is over and BMorg published them
// openly — so this is a legitimate way to fill the site with real data before
// a live key exists. See ARCHIVE_YEAR below for the guard that stops anyone
// using this path to sidestep the CURRENT year's embargo.
const ARCHIVE_ROOT = 'https://bm-innovate.s3.amazonaws.com/archive';

const YEAR = Number(process.env.BM_YEAR || DEFAULT_YEAR);
const BM_API_KEY = process.env.BM_API_KEY;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const CAMP_NAME = process.env.BM_CAMP_NAME || 'Beverly Grillz';
const CAMP_UID = process.env.BM_CAMP_UID || '';

const rawArgs = process.argv.slice(2);
const argv = new Set(rawArgs);
const DRY_RUN = argv.has('--dry-run');
const PROBE = argv.has('--probe');
const FULL_DUMP = argv.has('--full-dump');

// --archive <year> pulls a completed year from the public S3 archive instead
// of the authenticated API. No key needed.
const archiveIdx = rawArgs.indexOf('--archive');
const ARCHIVE_YEAR = archiveIdx >= 0 ? Number(rawArgs[archiveIdx + 1]) : null;

// The three collections. Endpoint paths are kept in one place because BMorg
// has moved them between API versions before — if a path 404s, fix it here.
// `archive` is the filename in the S3 archive, which does not always match
// the live endpoint name (`camp` vs `camps.json`).
const COLLECTIONS = [
  { kind: 'camps', path: 'camp', archive: 'camps' },
  { kind: 'art', path: 'art', archive: 'art' },
  { kind: 'events', path: 'event', archive: 'events' },
];

// ------------------------------------------------------------
// SMALL HELPERS
// ------------------------------------------------------------

const log = (...a) => console.log('[bm-sync]', ...a);
const warn = (...a) => console.warn('[bm-sync]', ...a);

function die(msg) {
  console.error('[bm-sync] FATAL:', msg);
  process.exit(1);
}

/** Basic auth with the API key as username and an empty password. */
function authHeader(key) {
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
}

/** Trim a long string for storage; the site does not need full essays. */
function clamp(str, max = 600) {
  if (typeof str !== 'string') return str;
  const s = str.trim();
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

function norm(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// ------------------------------------------------------------
// FETCH
// ------------------------------------------------------------

async function fetchCollection(path) {
  const url = `${API_ROOT}/${path}?year=${YEAR}`;
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(BM_API_KEY),
      Accept: 'application/json',
      // BMorg asks that apps identify themselves.
      'User-Agent': 'BeverlyGrillz-CampSite/1.0 (+camp website sync)',
    },
  });

  if (res.status === 401 || res.status === 403) {
    die(`${res.status} from ${path} — check BM_API_KEY, and confirm your key has been approved for ${YEAR} data.`);
  }
  if (res.status === 404) {
    die(`404 from ${url} — the endpoint path may have changed. Adjust COLLECTIONS at the top of this file.`);
  }
  if (!res.ok) {
    die(`${res.status} ${res.statusText} from ${url}`);
  }

  const body = await res.json();
  // Be tolerant: some BM endpoints return a bare array, others wrap it.
  const list = Array.isArray(body)
    ? body
    : Array.isArray(body?.results) ? body.results
    : Array.isArray(body?.data) ? body.data
    : null;

  if (!list) {
    warn(`Unexpected response shape from ${path}; top-level keys:`, Object.keys(body || {}));
    return [];
  }
  return list;
}

/**
 * Fetch a completed year from the free public archive. No API key involved.
 *
 * The guard below is the important part. Archive files for a PAST year carry
 * no embargo, but if someone pointed this at the current year it would become
 * a way to publish placements that the embargo exists to withhold. So the
 * current year is refused outright, regardless of what the archive contains.
 */
async function fetchArchive(name, year) {
  const url = `${ARCHIVE_ROOT}/${year}/${name}.json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BeverlyGrillz-CampSite/1.0 (+camp website sync)' },
  });
  if (res.status === 404) {
    die(`404 from ${url} — ${year} may not be archived. Published years: 2015-2019, 2022-2025.`);
  }
  if (!res.ok) die(`${res.status} ${res.statusText} from ${url}`);

  const body = await res.json();
  const list = Array.isArray(body) ? body : body?.results || body?.data;
  if (!Array.isArray(list)) {
    warn(`Unexpected archive shape at ${url}; keys:`, Object.keys(body || {}));
    return [];
  }
  return list;
}

// ------------------------------------------------------------
// SLIMMING
// ------------------------------------------------------------
// The full camps list is well over a megabyte. Every byte written to kv_store
// is a byte the browser downloads on page load, so keep only what the site
// actually renders. Location fields are preserved here and removed later by
// applyEmbargo() — slimming and embargo are separate concerns on purpose.

export function slimArt(a) {
  return {
    uid: a.uid,
    name: a.name,
    artist: a.artist,
    description: clamp(a.description),
    hometown: a.hometown,
    category: a.category,
    url: a.url,
    donation_link: a.donation_link,
    images: Array.isArray(a.images)
      ? a.images.slice(0, 1).map(i => ({ thumbnail_url: i.thumbnail_url, gallery_ref: i.gallery_ref }))
      : [],
    location: a.location,
    location_string: a.location_string,
  };
}

// Field names confirmed against the real 2025 archive, not guessed:
//   uid, name, year, url, contact_email, hometown, description, landmark,
//   location{frontage,intersection,intersection_type,dimensions,exact_location},
//   location_string, images[{thumbnail_url}]
export function slimCamp(c) {
  return {
    uid: c.uid,
    name: c.name,
    description: clamp(c.description, 400),
    hometown: c.hometown,
    url: c.url,
    contact_email: c.contact_email,
    // "Look for the big neon tooth" — genuinely useful, and a placement hint,
    // so it is on the embargo token list and disappears until release day.
    landmark: c.landmark,
    images: Array.isArray(c.images)
      ? c.images.slice(0, 1).map(i => ({ thumbnail_url: i.thumbnail_url }))
      : [],
    location: c.location,
    location_string: c.location_string,
  };
}

export function slimEvent(e) {
  return {
    uid: e.uid,
    title: e.title,
    description: clamp(e.description, 400),
    event_type: e.event_type,
    hosted_by_camp: e.hosted_by_camp,
    located_at_art: e.located_at_art,
    other_location: e.other_location,
    all_day: e.all_day,
    check_location: e.check_location,
    occurrence_set: e.occurrence_set,
  };
}

// ------------------------------------------------------------
// SUPABASE WRITE
// ------------------------------------------------------------
// Uses the PostgREST endpoint directly so this script has zero npm
// dependencies and can run in a bare CI container.

async function upsert(key, value) {
  if (DRY_RUN) {
    const bytes = Buffer.byteLength(JSON.stringify(value));
    log(`DRY RUN — would write ${key} (${(bytes / 1024).toFixed(1)} KB)`);
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      key,
      value,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    die(`Supabase write failed for "${key}": ${res.status} ${text}`);
  }
  const bytes = Buffer.byteLength(JSON.stringify(value));
  log(`wrote ${key} (${(bytes / 1024).toFixed(1)} KB)`);
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

async function main() {
  const isArchive = ARCHIVE_YEAR != null;
  const now = new Date();
  const thisYear = now.getUTCFullYear();

  // ---- archive mode guardrail ----
  // The archive is a legitimate keyless source for FINISHED years. It must
  // never become a side door around the current year's embargo, so the
  // current year (and anything later) is refused here, before any fetch.
  if (isArchive) {
    if (!Number.isInteger(ARCHIVE_YEAR)) {
      die('--archive needs a year, e.g. `node bm-sync.mjs --archive 2025`');
    }
    if (ARCHIVE_YEAR >= thisYear) {
      die(
        `REFUSED — --archive ${ARCHIVE_YEAR} is the current year or later. ` +
        `The archive path has no embargo logic because past years need none. ` +
        `For ${thisYear} data use the live API with BM_API_KEY, which applies ` +
        `the embargo properly.`
      );
    }
  } else if (!BM_API_KEY) {
    die('BM_API_KEY is not set. Request one at https://api.burningman.org/ — ' +
        'or load a past year with `--archive 2025`, which needs no key.');
  }

  if (!PROBE && !DRY_RUN && !FULL_DUMP) {
    if (!SUPABASE_URL) die('SUPABASE_URL is not set.');
    if (!SUPABASE_KEY) die('Set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY.');
  }

  const year = isArchive ? ARCHIVE_YEAR : YEAR;

  log(`${isArchive ? 'ARCHIVE' : 'LIVE'} · year ${year} · run at ${now.toISOString()}`);
  if (isArchive) {
    log('past year — no embargo applies, BMorg publishes these openly.');
  } else {
    log(`embargo — camps: ${locationsReleased('camps', now) ? 'RELEASED' : `held until ${releaseLabel('camps')}`}`);
    log(`embargo — art:   ${locationsReleased('art', now) ? 'RELEASED' : `held until ${releaseLabel('art')}`}`);
  }

  const raw = {};
  for (const c of COLLECTIONS) {
    const list = isArchive
      ? await fetchArchive(c.archive, year)
      : await fetchCollection(c.path);
    raw[c.kind] = list;
    log(`fetched ${list.length} ${c.kind}`);
  }

  if (PROBE) {
    for (const { kind } of COLLECTIONS) {
      console.log(`\n===== RAW ${kind.toUpperCase()} RECORD =====`);
      console.log(JSON.stringify(raw[kind][0] ?? null, null, 2));
    }
    log('\nprobe only — nothing written.');
    return;
  }

  if (FULL_DUMP) {
    const file = `bm-${year}-full.json`;
    writeFileSync(file, JSON.stringify(raw, null, 2));
    log(`wrote ${file} — LOCAL ONLY, do not commit or upload.`);
    return;
  }

  // ---- slim ----
  const camps = raw.camps.map(slimCamp);
  const art = raw.art.map(slimArt);
  const events = raw.events.map(slimEvent);

  // ---- identify our own camp ----
  const ours = camps.find(c =>
    (CAMP_UID && c.uid === CAMP_UID) || norm(c.name) === norm(CAMP_NAME)
  );
  if (ours) {
    log(`matched our camp: ${ours.name} (uid ${ours.uid})`);
  } else if (!isArchive) {
    warn(`Camp "${CAMP_NAME}" not found in ${camps.length} records. ` +
         `The directory may not be published yet, or the registered name differs. ` +
         `Set BM_CAMP_UID once you know it.`);
  }

  const ourEvents = ours
    ? events.filter(e => e.hosted_by_camp && e.hosted_by_camp === ours.uid)
    : [];

  // ---- embargo ----
  // Archive years are finished, so applyEmbargo is a no-op for them — but it
  // is still called rather than skipped, so there is exactly ONE code path
  // that data can travel down. A second "trusted" path is how leaks happen.
  const embargoAt = isArchive ? new Date('2000-01-01T00:00:00Z') : now;
  const pub = {
    camps: applyEmbargo('camps', camps, embargoAt),
    art: applyEmbargo('art', art, embargoAt),
    events: applyEmbargo('events', events, embargoAt),
    ourCamp: ours ? applyEmbargo('camps', [ours], embargoAt)[0] : null,
    ourEvents: applyEmbargo('events', ourEvents, embargoAt),
  };

  // ---- last line of defence, before anything is published ----
  if (!isArchive) {
    for (const [key, kind] of [
      ['camps', 'camps'], ['ourCamp', 'camps'],
      ['art', 'art'],
      ['events', 'events'], ['ourEvents', 'events'],
    ]) {
      if (locationsReleased(kind, now)) continue;
      const leaks = findAddressLeaks(JSON.stringify(pub[key] ?? null));
      if (leaks.length) {
        die(
          `ABORTED — "${key}" still contains ${leaks.length} apparent address(es) ` +
          `while under embargo: ${JSON.stringify(leaks.slice(0, 5))}. Nothing was ` +
          `written. Run --probe to inspect raw fields, then widen LOCATION_TOKENS ` +
          `or ADDRESS_PATTERNS in bm-embargo.js.`
        );
      }
    }
    log('pre-write leak scan clean.');
  }

  // ---- size sanity ----
  // Everything written here is downloaded by every visitor's browser. Warn
  // loudly rather than silently shipping a 4 MB page.
  for (const [key, payload] of Object.entries(pub)) {
    const kb = Buffer.byteLength(JSON.stringify(payload)) / 1024;
    if (kb > 1500) {
      warn(`"${key}" is ${kb.toFixed(0)} KB — that is a lot for the browser to ` +
           `pull on page load. Consider trimming the slim* functions.`);
    }
  }

  // ---- write ----
  await upsert(`bm:${year}:camps`, pub.camps);
  await upsert(`bm:${year}:art`, pub.art);
  await upsert(`bm:${year}:events`, pub.events);
  await upsert(`bm:${year}:ourCamp`, pub.ourCamp);
  await upsert(`bm:${year}:ourEvents`, pub.ourEvents);
  await upsert(`bm:${year}:meta`, {
    year,
    isArchive,
    syncedAt: now.toISOString(),
    counts: {
      camps: camps.length, art: art.length,
      events: events.length, ourEvents: ourEvents.length,
    },
    released: isArchive
      ? { camps: true, art: true }
      : { camps: locationsReleased('camps', now), art: locationsReleased('art', now) },
    attribution: 'Data from the Burning Man Public API — burningman.org',
  });

  // The pointer the site reads first, so swapping which year is on display is
  // one row change rather than a redeploy. Loading 2025 today and 2026 on the
  // 9th costs nothing but a re-run with different arguments.
  await upsert('bm:current', { year, isArchive, syncedAt: now.toISOString() });

  log(`done — site will display ${year}${isArchive ? ' (archive)' : ''}.`);
}

// Only run when executed directly (`node bm-sync.mjs`). Importing this module
// — which the test harness does, to exercise the real slim functions rather
// than a copy of them — must not fire off a live sync.
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch(err => die(err?.stack || String(err)));
}
