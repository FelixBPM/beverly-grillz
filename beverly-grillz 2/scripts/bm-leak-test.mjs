// ============================================================
// ADVERSARIAL LEAK TEST
// ============================================================
//   node bm-leak-test.mjs
//
// bm-embargo.test.mjs checks that the stripper behaves as designed. This file
// asks a different and more useful question: if BMorg's real data is NASTIER
// than I assumed, does a placement still get out?
//
// It drives the REAL pipeline — the actual slimCamp/slimArt/slimEvent imported
// from bm-sync.mjs, then the actual applyEmbargo — over deliberately hostile
// records: addresses hidden in prose, field names I never anticipated, GPS
// buried three levels deep, camelCase variants.
//
// The assertion is blunt on purpose. Serialize the final payload, then search
// it for every address fragment we planted. If any fragment appears anywhere,
// at any depth, under any key, the test fails.

import assert from 'node:assert/strict';
import { slimCamp, slimArt, slimEvent } from './bm-sync.mjs';
import { applyEmbargo } from '../src/bm-embargo.js';

let passed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const BEFORE = new Date('2026-08-10T00:00:00Z');   // embargo active
const AFTER_CAMPS = new Date('2026-08-24T00:00:00Z');
const AFTER_ART = new Date('2026-08-31T00:00:00Z');

// ------------------------------------------------------------
// HOSTILE FIXTURES
// ------------------------------------------------------------

const HOSTILE_CAMP = {
  uid: 'a1XVI000009awgo2AA',
  name: 'Beverly Grillz',
  hometown: 'Los Angeles, CA',
  // The address is in PROSE. Key-stripping alone never touches this.
  description: 'Grillz, but make it Beverly. Cocktails nightly — come find us at 7:30 & E, right behind the big neon tooth!',
  url: 'https://beverlygrillz.com',
  contact_email: 'hi@beverlygrillz.com',
  location_string: '7:30 & E',
  location: {
    string: '7:30 & E',
    frontage: 'E',
    intersection: '7:30',
    hour: 7, minute: 30,
    gps_latitude: 40.786400, gps_longitude: -119.206500,
  },
  // Field names the current code was never written against.
  neighborhood: 'The Deep 7:30 Sector',
  quadrant: 'NW',
  placementNotes: 'Adjacent to 7:30 portal',
  bm_zone: { radial: '7:30', annular: 'E' },
};

const HOSTILE_ART = {
  uid: 'b2YVI000004xyz',
  name: 'The Bureau of Erotic Discourse',
  artist: 'Someone Somewhere',
  // Long-form fields that MUST survive — these are the ones a naive
  // substring filter for lat/lon would have destroyed.
  description: 'A monument to bureaucracy. Installed at 9:00 3000 in deep playa. GPS 40.790000, -119.210000 for the navigators.',
  long_description: 'A much longer essay about the work that should survive intact.',
  related_works: ['prior piece'],
  translation_notes: 'keep me',
  hometown: 'Reno, NV',
  category: 'Sculpture',
  images: [{ thumbnail_url: 'https://example.org/t.jpg', gallery_ref: 'g1' }],
  location_string: '9:00 3000',
  location: { gps_latitude: 40.790000, gps_longitude: -119.210000, distance: 3000, hour: 9, minute: 0 },
  // Deeply nested, three levels down.
  meta: { survey: { precise: { gps_latitude: 40.790000 } } },
};

const HOSTILE_EVENT = {
  uid: 'c3Z',
  title: 'Mimosas at 7:30 & E',           // address in the TITLE
  description: 'Bring a cup. We are at 7:30 and Esplanade this year.',
  event_type: { label: 'Food' },
  hosted_by_camp: 'a1XVI000009awgo2AA',
  other_location: 'Behind the tooth, 7:30 & E',
  all_day: false,
  check_location: '7:30 & E',
  occurrence_set: [{ start_time: '2026-08-31T10:00:00', end_time: '2026-08-31T12:00:00' }],
};

// Every fragment that must NOT appear in an embargoed payload.
const FRAGMENTS = [
  '7:30 & E', '7:30 and Esplanade', '9:00 3000',
  '40.786400', '-119.206500', '40.790000', '-119.210000',
  '40.7864', '-119.2065', '40.79', '-119.21',
  'Deep 7:30 Sector', '7:30 portal',
];

function assertClean(payload, label) {
  const json = JSON.stringify(payload);
  for (const frag of FRAGMENTS) {
    assert.ok(
      !json.includes(frag),
      `LEAK in ${label}: found "${frag}"\n    payload: ${json.slice(0, 400)}`
    );
  }
}

// ------------------------------------------------------------

console.log('\nadversarial — embargo active');

check('camp: no address survives, including the one written into prose', () => {
  const out = applyEmbargo('camps', [slimCamp(HOSTILE_CAMP)], BEFORE);
  assertClean(out, 'camp');
});

check('camp: unanticipated field names are dropped by the slim allow-list', () => {
  const [out] = applyEmbargo('camps', [slimCamp(HOSTILE_CAMP)], BEFORE);
  // neighborhood / quadrant / placementNotes / bm_zone were never in slimCamp,
  // so they never reach the embargo stage at all. This is the load-bearing
  // property: the allow-list is what protects against field names I did not
  // predict, and the deny-list is the backup.
  assert.equal(out.neighborhood, undefined);
  assert.equal(out.quadrant, undefined);
  assert.equal(out.placementNotes, undefined);
  assert.equal(out.bm_zone, undefined);
});

check('art: no address survives, including nested three levels deep', () => {
  const out = applyEmbargo('art', [slimArt(HOSTILE_ART)], BEFORE);
  assertClean(out, 'art');
});

check('event: no address survives from title, description, or other_location', () => {
  const out = applyEmbargo('events', [slimEvent(HOSTILE_EVENT)], BEFORE);
  assertClean(out, 'event');
});

check('art placements still held on the CAMP release date', () => {
  const out = applyEmbargo('art', [slimArt(HOSTILE_ART)], AFTER_CAMPS);
  assertClean(out, 'art-on-camp-release-day');
});

console.log('\nadversarial — content preservation');

check('the useful content is still there', () => {
  const [camp] = applyEmbargo('camps', [slimCamp(HOSTILE_CAMP)], BEFORE);
  assert.equal(camp.name, 'Beverly Grillz');
  assert.equal(camp.hometown, 'Los Angeles, CA');
  assert.equal(camp.contact_email, 'hi@beverlygrillz.com');
  assert.ok(camp.description.includes('Cocktails nightly'), 'description was over-scrubbed');

  const [art] = applyEmbargo('art', [slimArt(HOSTILE_ART)], BEFORE);
  assert.equal(art.name, 'The Bureau of Erotic Discourse');
  assert.equal(art.artist, 'Someone Somewhere');
  assert.ok(art.description.includes('monument to bureaucracy'), 'art description was over-scrubbed');

  const [ev] = applyEmbargo('events', [slimEvent(HOSTILE_EVENT)], BEFORE);
  assert.ok(ev.occurrence_set?.[0]?.start_time, 'event times must survive — they are not placements');
});

check('redaction is visible, not silent', () => {
  const [camp] = applyEmbargo('camps', [slimCamp(HOSTILE_CAMP)], BEFORE);
  assert.ok(
    /address withheld until August 23/.test(camp.description),
    `expected a visible redaction marker, got: ${camp.description}`
  );
  assert.equal(camp.locationEmbargoed, true);
});

console.log('\nadversarial — after release');

check('camp address returns intact once released', () => {
  const [camp] = applyEmbargo('camps', [slimCamp(HOSTILE_CAMP)], AFTER_CAMPS);
  assert.equal(camp.location_string, '7:30 & E');
  assert.equal(camp.location.gps_latitude, 40.7864);
  assert.ok(camp.description.includes('7:30 & E'), 'prose should be unredacted after release');
  assert.equal(camp.locationEmbargoed, false);
});

check('art address returns intact once gates open', () => {
  const [art] = applyEmbargo('art', [slimArt(HOSTILE_ART)], AFTER_ART);
  assert.equal(art.location_string, '9:00 3000');
  assert.ok(art.description.includes('40.790000'));
});

console.log(`\n${passed} adversarial checks passed${process.exitCode ? ' — SEE FAILURES ABOVE' : ''}\n`);
