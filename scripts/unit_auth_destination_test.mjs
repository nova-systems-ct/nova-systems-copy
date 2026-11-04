import assert from 'node:assert/strict';
import { authDestination } from '../src/lib/authDestination.js';
import * as Return from '../src/lib/returnTo.js';
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
assert.equal(typeof Return.loginRedirect,'function');
assert.equal(Return.loginRedirect({pathname:'/dashboard/audit/case',search:'?tab=clock',hash:'#policy'}),'/login?returnTo=%2Fdashboard%2Faudit%2Fcase%3Ftab%3Dclock%23policy');
console.log(`${cases.length} passed, 0 failed`);
