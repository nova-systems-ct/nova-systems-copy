// Offline setup utility. Never uploads a private key or prints the generated JWT.
// Apple/Supabase account configuration and real sign-in acceptance are separate.
import { createPrivateKey, sign } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const APPLE_SECRET_MAX_SECONDS = 15_777_000;
export function createAppleClientSecret({ privateKeyPem, keyId, teamId, servicesId, now = Math.floor(Date.now() / 1000), ttlSeconds = 30 * 86400 } = {}) {
  if (!/^[A-Z0-9]{10}$/.test(keyId || '') || !/^[A-Z0-9]{10}$/.test(teamId || '')) throw new Error('Apple Key ID and Team ID must each be 10 uppercase letters or digits.');
  if (!/^[A-Za-z][A-Za-z0-9.-]{2,254}$/.test(servicesId || '') || servicesId.startsWith(`${teamId}.`)) throw new Error('Use the exact registered web Services ID without a Team ID prefix.');
  if (!Number.isSafeInteger(now) || now <= 0 || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > APPLE_SECRET_MAX_SECONDS || !Number.isSafeInteger(now + ttlSeconds)) throw new Error('Choose a valid lifetime between 60 and 15777000 seconds.');
  let key;
  try { key = createPrivateKey(privateKeyPem); } catch { throw new Error('A valid Sign in with Apple P-256 private key is required.'); }
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('A valid Sign in with Apple P-256 private key is required.');
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = now + ttlSeconds;
  const message = `${encode({ alg: 'ES256', kid: keyId })}.${encode({ iss: teamId, iat: now, exp: expiresAt, aud: 'https://appleid.apple.com', sub: servicesId })}`;
  const signature = sign('sha256', Buffer.from(message), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return { token: `${message}.${signature}`, expiresAt };
}

export function saveAppleClientSecret({ keyFile, outFile, keyId, teamId, servicesId, ttlSeconds } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  if (!path.isAbsolute(keyFile || '') || !path.isAbsolute(outFile || '')) throw new Error('Use absolute paths for the signing key and output file.');
  const realKey = fs.realpathSync(keyFile);
  const realParent = fs.realpathSync(path.dirname(outFile));
  const output = path.join(realParent, path.basename(outFile));
  const inRepo = value => value === root.slice(0, -1) || value.startsWith(root);
  if (inRepo(output) || inRepo(realKey)) throw new Error('Keep the signing key and generated secret outside the repository.');
  const info = fs.statSync(realKey);
  if (!info.isFile() || (info.mode & 0o077) !== 0) throw new Error('The signing key must be a private file readable only by its owner (mode 0600).');
  const generated = createAppleClientSecret({ privateKeyPem: fs.readFileSync(realKey), keyId, teamId, servicesId, ttlSeconds });
  // Exclusive creation refuses an existing file or symlink; never overwrites an
  // active credential. The JWT is sent only to this explicitly selected file.
  const fd = fs.openSync(output, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, `${generated.token}\n`); }
  finally { fs.closeSync(fd); }
  return { expiresAt: generated.expiresAt };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const help = 'Usage: node scripts/apple_signin_secret.mjs --key-file /private/AuthKey.p8 --key-id KEY_ID --team-id TEAM_ID --services-id REGISTERED_SERVICES_ID --out /private/apple.client-secret.jwt [--ttl-seconds 2592000]';
  if (process.argv.includes('--help')) console.log(help);
  else {
    try {
      const args = process.argv.slice(2);
      const allowed = new Set(['--key-file', '--key-id', '--team-id', '--services-id', '--out', '--ttl-seconds']);
      const values = new Map();
      if (!args.length || args.length % 2) throw new Error(help);
      for (let i = 0; i < args.length; i += 2) {
        if (!allowed.has(args[i]) || values.has(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(help);
        values.set(args[i], args[i + 1]);
      }
      const result = saveAppleClientSecret({ keyFile: values.get('--key-file'), outFile: values.get('--out'), keyId: values.get('--key-id'), teamId: values.get('--team-id'), servicesId: values.get('--services-id'), ttlSeconds: values.has('--ttl-seconds') ? Number(values.get('--ttl-seconds')) : undefined });
      console.log(`Apple client secret saved to a new private file. Expires ${new Date(result.expiresAt * 1000).toISOString()}. Configure it only in the server-side Apple Auth provider settings; rotate before expiry.`);
    } catch (error) {
      // Filesystem errors can contain private paths. Report only known, safe
      // validation text, never key material, raw crypto errors or a JWT.
      const message = error?.code ? 'The private file could not be read or created. Check the paths, permissions and whether the output already exists.' : error.message;
      console.error(message);
      process.exitCode = 1;
    }
  }
}
