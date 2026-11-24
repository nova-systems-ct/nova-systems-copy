// Appointment passes for Apple Wallet and Google Wallet (Nova system 18).
//
// Once a request is booked for a time, the customer's request page offers "Add to Apple Wallet"
// and "Add to Google Wallet": a card with the business, the service, the time, the address and a
// link back to the request. Apple passes are signed with Nova's Pass Type ID certificate; Google
// passes with Nova's Wallet service account. Both are free to issue. Each wallet only appears when
// its keys are set (APPLE_PASS_* or GOOGLE_WALLET_*); without them the buttons are not shown.
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import forge from 'node-forge';

const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const pem = (v) => String(v || '').replace(/\\n/g, '\n').trim();
export const walletOptions = (env = process.env) => ({
  apple: !!(env.APPLE_PASS_TYPE_ID && env.APPLE_TEAM_ID && env.APPLE_PASS_CERT_PEM && env.APPLE_PASS_KEY_PEM && env.APPLE_WWDR_PEM),
  google: !!(env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SERVICE_EMAIL && env.GOOGLE_WALLET_PRIVATE_KEY),
});

// What goes on the card. Only a request booked for a time has a pass.
export async function passFor(db, j, { link, timeZone = 'America/New_York' } = {}) {
  if (j.stage !== 'scheduled' || !j.slot_id) return null;
  const [slot, svc, agent, org] = await Promise.all([
    one(db, 'voice_calendar_slots', { id: j.slot_id, organization_id: j.organization_id }),
    j.service_id ? one(db, 'business_services', { id: j.service_id, organization_id: j.organization_id }) : null,
    one(db, 'business_agents', { organization_id: j.organization_id }),
    one(db, 'organizations', { id: j.organization_id }),
  ]);
  if (!slot) return null;
  const when = new Date(slot.start_at).toLocaleString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return { serial: `${j.id}:${slot.id}`, business: agent?.business_name || org?.name || 'Your appointment', service: svc?.name || 'Appointment', start: slot.start_at, end: slot.end_at || null, when, address: j.service_address || null, link };
}

// ---- Google Wallet: a signed "save" link; Google stores the card ------------------------------
const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
export function googleSaveUrl(p, env = process.env) {
  const issuer = env.GOOGLE_WALLET_ISSUER_ID, classId = `${issuer}.nova_appointment`;
  const text = (value) => ({ defaultValue: { language: 'en-US', value: String(value).slice(0, 200) } });
  const object = {
    id: `${issuer}.${crypto.createHash('sha256').update(p.serial).digest('hex').slice(0, 40)}`, classId, state: 'ACTIVE', hexBackgroundColor: '#1b2430',
    cardTitle: text(p.business), header: text(p.service), subheader: text('Appointment'),
    textModulesData: [{ id: 'when', header: 'When', body: p.when }, ...(p.address ? [{ id: 'where', header: 'Where', body: p.address.slice(0, 300) }] : [])],
    ...(p.link ? { linksModuleData: { uris: [{ uri: p.link, description: 'Your request' }] } } : {}),
    validTimeInterval: { start: { date: p.start }, ...(p.end ? { end: { date: p.end } } : {}) },
  };
  const claims = { iss: env.GOOGLE_WALLET_SERVICE_EMAIL, aud: 'google', typ: 'savetowallet', iat: Math.floor(Date.now() / 1000), origins: ['https://nova-systems.app'], payload: { genericClasses: [{ id: classId }], genericObjects: [object] } };
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(pem(env.GOOGLE_WALLET_PRIVATE_KEY)).toString('base64url');
  return `https://pay.google.com/gp/v/save/${unsigned}.${sig}`;
}

// ---- Apple Wallet: a signed .pkpass file ------------------------------------------------------
const crc32 = zlib.crc32 || ((buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; });
function png(size, rgb) { // a plain square icon, so the pass needs no image files
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).map((_, i) => rgb[i % 3])]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(size).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}
function zip(files) { // stored ZIP, as Wallet reads it
  const locals = [], central = []; let offset = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name), crc = crc32(data);
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt32LE(crc, 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(n.length, 26);
    const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(data.length, 20); dir.writeUInt32LE(data.length, 24); dir.writeUInt16LE(n.length, 28); dir.writeUInt32LE(offset, 42);
    locals.push(head, n, data); central.push(dir, n); offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export function applePkpass(p, env = process.env) {
  const pass = {
    formatVersion: 1, passTypeIdentifier: env.APPLE_PASS_TYPE_ID, teamIdentifier: env.APPLE_TEAM_ID,
    serialNumber: crypto.createHash('sha256').update(p.serial).digest('hex').slice(0, 32), organizationName: p.business.slice(0, 60), description: `${p.service} with ${p.business}`.slice(0, 120),
    backgroundColor: 'rgb(27,36,48)', foregroundColor: 'rgb(255,255,255)', labelColor: 'rgb(200,192,179)', relevantDate: p.start,
    eventTicket: {
      primaryFields: [{ key: 'service', label: 'APPOINTMENT', value: p.service.slice(0, 60) }],
      secondaryFields: [{ key: 'when', label: 'WHEN', value: p.when }],
      auxiliaryFields: p.address ? [{ key: 'where', label: 'WHERE', value: p.address.slice(0, 120) }] : [],
      backFields: [{ key: 'business', label: 'Business', value: p.business }, ...(p.link ? [{ key: 'link', label: 'Your request', value: p.link }] : [])],
    },
  };
  const files = [['pass.json', Buffer.from(JSON.stringify(pass))], ['icon.png', png(29, [27, 36, 48])], ['icon@2x.png', png(58, [27, 36, 48])]];
  const manifest = Buffer.from(JSON.stringify(Object.fromEntries(files.map(([n, d]) => [n, crypto.createHash('sha1').update(d).digest('hex')]))));
  const cert = forge.pki.certificateFromPem(pem(env.APPLE_PASS_CERT_PEM)), wwdr = forge.pki.certificateFromPem(pem(env.APPLE_WWDR_PEM));
  const signed = forge.pkcs7.createSignedData();
  signed.content = forge.util.createBuffer(manifest.toString('binary'));
  signed.addCertificate(cert); signed.addCertificate(wwdr);
  signed.addSigner({ key: forge.pki.privateKeyFromPem(pem(env.APPLE_PASS_KEY_PEM)), certificate: cert, digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [{ type: forge.pki.oids.contentType, value: forge.pki.oids.data }, { type: forge.pki.oids.messageDigest }, { type: forge.pki.oids.signingTime, value: new Date() }] });
  signed.sign({ detached: true });
  const signature = Buffer.from(forge.asn1.toDer(signed.toAsn1()).getBytes(), 'binary');
  return zip([...files, ['manifest.json', manifest], ['signature', signature]]);
}

// A short-lived download address for the Apple pass, so the customer's key never goes in a URL.
const sign = (s, secret) => crypto.createHmac('sha256', secret).update(s).digest('hex');
export function appleDownloadPath(journeyId, secret, now = Date.now()) {
  const exp = Math.floor(now / 1000) + 600;
  return `/api/client?resource=journey&op=wallet-pass&j=${journeyId}&exp=${exp}&sig=${sign(`${journeyId}.${exp}`, secret)}`;
}
export function appleDownloadOk({ j, exp, sig }, secret, now = Date.now()) {
  if (!secret || !/^[0-9a-f-]{36}$/.test(String(j)) || !/^\d{10}$/.test(String(exp)) || !/^[0-9a-f]{64}$/.test(String(sig))) return false;
  if (Number(exp) < now / 1000) return false;
  const want = Buffer.from(sign(`${j}.${exp}`, secret)), got = Buffer.from(String(sig));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
