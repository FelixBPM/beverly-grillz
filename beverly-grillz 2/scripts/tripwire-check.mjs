// Proves the pre-write tripwire actually fires: feed it a payload that a
// hypothetical future bug let through, and confirm it is detected.
import { findAddressLeaks } from '../src/bm-embargo.js';
import assert from 'node:assert/strict';

const leaky = JSON.stringify([{ uid: 'x', name: 'Camp', mystery_field: 'we are at 7:30 & E' }]);
const clean = JSON.stringify([{ uid: 'x', name: 'Camp', description: 'Cocktails nightly at 8pm sharp.' }]);

assert.ok(findAddressLeaks(leaky).length > 0, 'tripwire FAILED to catch a leak');
assert.equal(findAddressLeaks(clean).length, 0, 'tripwire false-positived on clean text');

// Regexes are /g and module-level — make sure repeated calls stay correct.
for (let i = 0; i < 5; i++) {
  assert.ok(findAddressLeaks(leaky).length > 0, `tripwire went stale on call ${i + 1}`);
  assert.equal(findAddressLeaks(clean).length, 0, `false positive on call ${i + 1}`);
}
console.log('  ✓ tripwire catches a leak that slipped past every other layer');
console.log('  ✓ tripwire stays correct across repeated calls (no /g lastIndex bug)');
