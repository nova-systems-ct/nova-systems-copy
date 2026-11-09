import assert from 'node:assert/strict';
import { ownerFirstName } from '../src/lib/ownerGreeting.js';

const cases = [
  ['Local Test Owner', ''], ['Test Owner', ''], ['  test  ', ''],
  [' Isaac Nova ', 'Isaac'], ['Testa Nova', 'Testa'], ['José Ariel', 'José'],
  ['', ''], [null, ''], [42, ''],
];
for (const [input, expected] of cases) assert.equal(ownerFirstName(input), expected, `greeting for ${JSON.stringify(input)}`);
console.log(`${cases.length} passed, 0 failed`);
