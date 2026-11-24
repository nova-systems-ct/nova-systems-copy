// Apple Wallet and Google Wallet appointment passes (api/_walletPass.js), signed with throwaway test
// keys made here. The Apple signature is checked with OpenSSL; nothing is sent anywhere.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import forge from 'node-forge';
import { walletOptions, passFor, googleSaveUrl, applePkpass, appleDownloadPath, appleDownloadOk } from '../api/_walletPass.js';

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => r[k] === v);
  return { t, select: async (n, f = {}, { limit = 500 } = {}) => rows(n).filter((r) => hit(r, f)).slice(0, limit).map((r) => ({ ...r })), insert: async (n, row) => { const full = { id: crypto.randomUUID(), ...row }; rows(n).push(full); return { ...full }; } };
}
const db = memoryDb();
await db.insert('organizations', { id: ORG, name: 'Crystal Clear' });
await db.insert('business_agents', { organization_id: ORG, business_name: 'Crystal Clear' });
const svc = await db.insert('business_services', { organization_id: ORG, name: 'Full detail, sedan' });
const slot = await db.insert('voice_calendar_slots', { organization_id: ORG, start_at: '2026-11-25T15:00:00Z', end_at: '2026-11-25T17:00:00Z' });
const j = { id: crypto.randomUUID(), organization_id: ORG, stage: 'scheduled', slot_id: slot.id, service_id: svc.id, service_address: '1 Main St, Fairfield, CT' };

check('no keys set: no wallet buttons', !walletOptions({}).apple && !walletOptions({}).google);
check('a request not yet booked has no pass', (await passFor(db, { ...j, stage: 'quoted' })) === null);
const p = await passFor(db, j, { link: 'https://nova-systems.app/start?org=x' });
check('the pass holds the business, the service, the time in Connecticut and the address', p.business === 'Crystal Clear' && p.service === 'Full detail, sedan' && /Wed, Nov 25, 10:00 AM/.test(p.when) && p.address === '1 Main St, Fairfield, CT');

// Google: a save link signed with the service account's key.
const g = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const GENV = { GOOGLE_WALLET_ISSUER_ID: '3388000000012345678', GOOGLE_WALLET_SERVICE_EMAIL: 'wallet@nova.iam.gserviceaccount.com', GOOGLE_WALLET_PRIVATE_KEY: g.privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n') };
check('Google keys set: the Google button shows', walletOptions(GENV).google === true);
const url = googleSaveUrl(p, GENV);
const [h, c, s] = url.replace('https://pay.google.com/gp/v/save/', '').split('.');
const claims = JSON.parse(Buffer.from(c, 'base64url'));
const obj = claims.payload.genericObjects[0];
check('Google: the link is signed with the service account key (RS256)', crypto.createVerify('RSA-SHA256').update(`${h}.${c}`).verify(g.publicKey, Buffer.from(s, 'base64url')) && JSON.parse(Buffer.from(h, 'base64url')).alg === 'RS256');
check('Google: a save-to-wallet link from Nova\'s site for this appointment', claims.aud === 'google' && claims.typ === 'savetowallet' && claims.iss === GENV.GOOGLE_WALLET_SERVICE_EMAIL && claims.origins[0] === 'https://nova-systems.app' && obj.classId === `${GENV.GOOGLE_WALLET_ISSUER_ID}.nova_appointment` && obj.cardTitle.defaultValue.value === 'Crystal Clear' && obj.header.defaultValue.value === 'Full detail, sedan' && obj.textModulesData.some((m) => m.body === '1 Main St, Fairfield, CT'));

// Apple: a .pkpass signed with a Pass Type ID certificate (test CA stands in for Apple's WWDR).
const mk = (subject, issuerKey, issuer, ca) => {
  const keys = forge.pki.rsa.generateKeyPair(2048); const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey; cert.serialNumber = '0' + crypto.randomBytes(8).toString('hex');
  cert.validity.notBefore = new Date(Date.now() - 86_400_000); cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  cert.setSubject([{ name: 'commonName', value: subject }]); cert.setIssuer(issuer ? issuer.subject.attributes : [{ name: 'commonName', value: subject }]);
  cert.setExtensions(ca ? [{ name: 'basicConstraints', cA: true }, { name: 'keyUsage', keyCertSign: true, digitalSignature: true }] : [{ name: 'basicConstraints', cA: false }, { name: 'keyUsage', digitalSignature: true }]);
  cert.sign(issuerKey || keys.privateKey, forge.md.sha256.create()); return { keys, cert };
};
const ca = mk('Test WWDR', null, null, true);
const leaf = mk('Pass Type ID: pass.app.nova-systems.appointment', ca.keys.privateKey, ca.cert, false);
const AENV = { APPLE_PASS_TYPE_ID: 'pass.app.nova-systems.appointment', APPLE_TEAM_ID: 'ABCDE12345', APPLE_PASS_CERT_PEM: forge.pki.certificateToPem(leaf.cert), APPLE_PASS_KEY_PEM: forge.pki.privateKeyToPem(leaf.keys.privateKey), APPLE_WWDR_PEM: forge.pki.certificateToPem(ca.cert) };
check('Apple keys set: the Apple button shows', walletOptions(AENV).apple === true);
const file = applePkpass(p, AENV);
const entries = {}; // read the stored ZIP back
for (let o = 0; file.readUInt32LE(o) === 0x04034b50;) { const size = file.readUInt32LE(o + 18), nlen = file.readUInt16LE(o + 26); const name = file.subarray(o + 30, o + 30 + nlen).toString(); entries[name] = file.subarray(o + 30 + nlen, o + 30 + nlen + size); o += 30 + nlen + size; }
check('Apple: the file holds the pass, its icons, the manifest and the signature', ['pass.json', 'icon.png', 'icon@2x.png', 'manifest.json', 'signature'].every((n) => entries[n]?.length > 0));
const pj = JSON.parse(entries['pass.json']), manifest = JSON.parse(entries['manifest.json']);
check('Apple: the manifest lists the right fingerprint of every file', ['pass.json', 'icon.png', 'icon@2x.png'].every((n) => manifest[n] === crypto.createHash('sha1').update(entries[n]).digest('hex')));
check('Apple: the pass is an appointment card for this business and time', pj.passTypeIdentifier === AENV.APPLE_PASS_TYPE_ID && pj.teamIdentifier === 'ABCDE12345' && pj.organizationName === 'Crystal Clear' && pj.eventTicket.primaryFields[0].value === 'Full detail, sedan' && pj.relevantDate === '2026-11-25T15:00:00Z' && pj.eventTicket.auxiliaryFields[0].value === '1 Main St, Fairfield, CT');
check('Apple: the icons are real PNG images of the right size', entries['icon.png'].readUInt32BE(16) === 29 && entries['icon@2x.png'].readUInt32BE(16) === 58 && entries['icon.png'].subarray(1, 4).toString() === 'PNG');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pass-'));
fs.writeFileSync(path.join(dir, 'signature'), entries.signature); fs.writeFileSync(path.join(dir, 'manifest.json'), entries['manifest.json']); fs.writeFileSync(path.join(dir, 'ca.pem'), AENV.APPLE_WWDR_PEM);
let verified = '';
try { verified = execFileSync('openssl', ['smime', '-verify', '-binary', '-inform', 'DER', '-in', path.join(dir, 'signature'), '-content', path.join(dir, 'manifest.json'), '-CAfile', path.join(dir, 'ca.pem'), '-purpose', 'any', '-out', '/dev/null'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString() + 'ok'; } catch (e) { verified = String(e.stderr || e.message); }
check('Apple: OpenSSL verifies the signature over the manifest, up to the issuing certificate', /ok$/.test(verified));
fs.writeFileSync(path.join(dir, 'manifest.json'), Buffer.from(String(entries['manifest.json']).replace('"', '"x')));
let tampered = false;
try { execFileSync('openssl', ['smime', '-verify', '-binary', '-inform', 'DER', '-in', path.join(dir, 'signature'), '-content', path.join(dir, 'manifest.json'), '-CAfile', path.join(dir, 'ca.pem'), '-purpose', 'any', '-out', '/dev/null'], { stdio: 'ignore' }); } catch { tampered = true; }
check('Apple: a changed manifest fails verification', tampered);
fs.rmSync(dir, { recursive: true, force: true });

// The Apple download address lasts ten minutes and cannot be forged.
const SECRET = 's'.repeat(40), now = Date.UTC(2026, 10, 24, 15);
const q = Object.fromEntries(new URLSearchParams(appleDownloadPath(j.id, SECRET, now).split('?')[1]));
check('Apple download address: works for ten minutes, never holds the customer\'s key', appleDownloadOk(q, SECRET, now) && appleDownloadOk(q, SECRET, now + 9 * 60_000) && !appleDownloadOk(q, SECRET, now + 11 * 60_000) && !('token' in q) && !('k' in q));
check('Apple download address: another request, a changed time or another secret fails', !appleDownloadOk({ ...q, j: crypto.randomUUID() }, SECRET, now) && !appleDownloadOk({ ...q, exp: String(Number(q.exp) + 600) }, SECRET, now) && !appleDownloadOk(q, 't'.repeat(40), now) && !appleDownloadOk(q, '', now));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
