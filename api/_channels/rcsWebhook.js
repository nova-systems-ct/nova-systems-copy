import { dbOne, dbRpc, enc } from '../_sales/core.js';
import crypto from 'node:crypto';
import { rawChannelBody } from './service.js';
import { verifyRcsEnvelope, normalizeRcsEvent } from './rcs.js';
import {channelCredentialsAssigned} from './delivery.js';
export async function handleRcsWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.query?.connection_id || '')) return res.status(400).json({ error: 'A configured RCS connection is required' });
    const connection = await dbOne(`channel_connections?id=eq.${enc(req.query.connection_id)}&provider=eq.android_rcs&select=*`);
    const ref = connection?.webhook_secret_ref;
    const token = /^NOVA_CHANNEL_WEBHOOK_[A-Z0-9_]{1,80}$/.test(ref || '') ? process.env[ref] : null;
    if (!token||!channelCredentialsAssigned(connection)) return res.status(403).json({ error: 'RCS webhook is not configured' });
    let body; try { body = JSON.parse((await rawChannelBody(req)).toString('utf8')); } catch (error) { if (error.status === 413) throw error; return res.status(400).json({ error: 'Invalid RCS envelope' }); }
    if (req.headers?.['x-goog-webhook-type'] === 'verification') {
      const supplied = Buffer.from(String(body.clientToken || '')), expected = Buffer.from(token);
      if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected) || typeof body.secret !== 'string' || body.secret.length > 4096) return res.status(403).json({ error: 'RCS verification refused' });
      return res.status(200).send(body.secret);
    }
    const event = verifyRcsEnvelope(body, req.headers?.['x-goog-signature'], token);
    if (!event || event.agentId !== connection.provider_account_id) return res.status(403).json({ error: 'Invalid RCS source signature or agent' });
    if (req.headers?.['x-goog-webhook-type'] !== 'message_callback' || (event.eventType&&!['UNSUBSCRIBE','SUBSCRIBE'].includes(event.eventType))) return res.status(200).json({ received: true, events: 0 });
    const normalized = normalizeRcsEvent(event);
    if (!normalized) return res.status(400).json({ error: 'Unsupported RCS event identifiers' });
    await dbRpc('nova_channel_ingest', { p_event: normalized });
    return res.status(200).json({ received: true, events: 1 });
  } catch (error) { return res.status(error.status === 413 ? 413 : 503).json({ error: error.status === 413 ? 'RCS message too large' : 'RCS receipt could not be saved; delivery may be retried' }); }
}
