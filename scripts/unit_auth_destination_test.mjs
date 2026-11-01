import assert from 'node:assert/strict';
import { authDestination } from '../src/lib/authDestination.js';
const cases = [
  [{type:'invite'},'/reset-password?returnTo=%2Fdashboard'],
  [{type:'recovery',returnTo:'/dashboard/audit'},'/reset-password?returnTo=%2Fdashboard%2Faudit'],
  [{event:'PASSWORD_RECOVERY',returnTo:'/dashboard'},'/reset-password?returnTo=%2Fdashboard'],
  [{type:'invite',returnTo:'/reset-password'},'/reset-password?returnTo=%2Fdashboard'],
  [{type:'signup',returnTo:'/dashboard/audit'},'/dashboard/audit'],
  [{type:'magiclink',returnTo:'https://example.com'},'/dashboard'],
  [{type:'invite',returnTo:'//example.com'},'/reset-password?returnTo=%2Fdashboard'],
];
for (const [input,expected] of cases) assert.equal(authDestination(input),expected);
console.log(`${cases.length} passed, 0 failed`);
