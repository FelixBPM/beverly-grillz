// Verification harness for the embargo logic.
//   node bm-embargo.test.mjs
//
// The failure mode we care about is silent: a location field slipping through
// before its release date. So the tests assert on the SERIALIZED payload —
// if a placement survives anywhere at any depth, the string search finds it.

import assert from 'node:assert/strict';
import {
  applyEmbargo, stripLocations, locationsReleased, RELEASE,
} from '../src/bm-embargo.js';

let passed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

// Realistic record shapes, including the nested location object.
const CAMP = {
  uid: 'a1X', name: 'Beverly Grillz', hometown: 'Los Angeles',
  description: 'Grillz, but make it Beverly.',
  location_string: '7:30 & E',
  location: { string: '7:30 & E', frontage: 'E', intersection: '7:30', hour: 7, minute: 30, gps_latitude: 40.78, gps_longitude: -119.20 },
};

const ART = {
  uid: 'b2Y', name: 'The Thing', artist: 'Someone',
  long_description: 'A very long description that must survive stripping.',
  related_works: ['x'], translation_notes: 'keep me',
  location_string: '9:00 3000',
  location: { gps_latitude: 40.79, gps_longitude: -119.21, distance: 3000, hour: 9, minute: 0 },
};

const BEFORE = new Date('2026-08-10T00:00:00Z');
const AFTER_CAMPS = new Date('2026-08-24T00:00:00Z');
const AFTER_ART = new Date('2026-08-31T00:00:00Z');

const LEAKS = ['7:30', '40.78', '-119.20', '40.79', '-119.21', '9:00', '3000'];

console.log('\nembargo');

check('camps held before Aug 23', () => {
  assert.equal(locationsReleased('camps', BEFORE), false);
});
check('camps released after Aug 23', () => {
  assert.equal(locationsReleased('camps', AFTER_CAMPS), true);
});
check('art still held on Aug 24 (later date than camps)', () => {
  assert.equal(locationsReleased('art', AFTER_CAMPS), false);
});
check('art released once gates open', () => {
  assert.equal(locationsReleased('art', AFTER_ART), true);
});
check('events inherit the camp date', () => {
  assert.equal(RELEASE.events, RELEASE.camps);
});

console.log('\nstripping');

check('no placement survives in a pre-release camp payload', () => {
  const out = JSON.stringify(applyEmbargo('camps', [CAMP], BEFORE));
  for (const leak of LEAKS) {
    assert.ok(!out.includes(leak), `leaked "${leak}" in ${out}`);
  }
});

check('no placement survives in a pre-release art payload', () => {
  const out = JSON.stringify(applyEmbargo('art', [ART], BEFORE));
  for (const leak of LEAKS) {
    assert.ok(!out.includes(leak), `leaked "${leak}" in ${out}`);
  }
});

check('art still stripped on Aug 24 even though camps are out', () => {
  const out = JSON.stringify(applyEmbargo('art', [ART], AFTER_CAMPS));
  assert.ok(!out.includes('40.79'), 'art placement leaked on the camp release date');
});

check('non-location fields are preserved', () => {
  const [out] = applyEmbargo('art', [ART], BEFORE);
  assert.equal(out.name, 'The Thing');
  assert.equal(out.artist, 'Someone');
  // The tokenizer must not eat these just because they contain lat/lon/long.
  assert.ok(out.long_description, 'long_description was wrongly stripped');
  assert.ok(out.related_works, 'related_works was wrongly stripped');
  assert.ok(out.translation_notes, 'translation_notes was wrongly stripped');
});

check('embargo flag is set so the UI can explain itself', () => {
  assert.equal(applyEmbargo('camps', [CAMP], BEFORE)[0].locationEmbargoed, true);
  assert.equal(applyEmbargo('camps', [CAMP], AFTER_CAMPS)[0].locationEmbargoed, false);
});

check('full data returns intact after release', () => {
  const [out] = applyEmbargo('camps', [CAMP], AFTER_CAMPS);
  assert.equal(out.location_string, '7:30 & E');
  assert.equal(out.location.gps_latitude, 40.78);
});

check('camelCase location keys are caught too', () => {
  const out = JSON.stringify(stripLocations({ gpsLatitude: 40.78, locationString: '7:30 & E', name: 'ok' }));
  assert.ok(!out.includes('40.78') && !out.includes('7:30'));
  assert.ok(out.includes('ok'));
});

check('deeply nested placements are caught', () => {
  const out = JSON.stringify(stripLocations({ a: { b: { c: { gps_latitude: 40.78 } } } }));
  assert.ok(!out.includes('40.78'), `leaked: ${out}`);
});

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures above)' : ''}\n`);

// ---- regression: archive sentinel direction ----
// The first live 2025 sync stripped every placement because the archive path
// passed a far-PAST date to a "now >= release" comparison. Past = not yet
// released. Assert the direction explicitly so it cannot silently flip back.
console.log('\narchive sentinel');
check('a far-past date means NOT released (this is the trap)', () => {
  assert.equal(locationsReleased('camps', new Date('2000-01-01T00:00:00Z')), false);
});
check('a far-future date is what marks a finished year as released', () => {
  assert.equal(locationsReleased('camps', new Date('2999-01-01T00:00:00Z')), true);
  assert.equal(locationsReleased('art', new Date('2999-01-01T00:00:00Z')), true);
});
check('archive records keep their placement under the future sentinel', () => {
  const [out] = applyEmbargo('camps', [CAMP], new Date('2999-01-01T00:00:00Z'));
  assert.equal(out.location_string, '7:30 & E', 'archive placement was stripped');
  assert.equal(out.locationEmbargoed, false);
});
