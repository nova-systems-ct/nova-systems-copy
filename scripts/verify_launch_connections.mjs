import { checkLaunchConnections } from '../api/_connectionChecks.js';
// Vercel build logs are private. Output only selected status fields, never tokens or raw provider bodies.
// No secrets are exported or written to public build artifacts.
if (process.env.VERCEL_ENV === 'production') {
  try {
    const status=await checkLaunchConnections();
    console.log('[nova-launch-connections] '+JSON.stringify(status));
  } catch { console.log('[nova-launch-connections] '+JSON.stringify({error:'unverified',operations:'read_only'})); }
} else console.log('[nova-launch-connections] Local build: provider checks skipped.');
