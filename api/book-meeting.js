import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { handleServiceSmsRequest } from './_serviceSmsRequest.js';
import { handleLaunchPublic } from './_launchWorker.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (!rateLimit(req, res, req.method === 'GET' ? 60 : 12, 60000)) return;
  if (req.method === 'GET' || ['launch_worker_request', 'launch_cancel'].includes(req.body?.request_type)) return handleLaunchPublic(req, res);
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  if (req.body?.request_type === 'service_sms_request') return handleServiceSmsRequest(req, res);
  // Retire legacy confirmations that did not validate availability or a successful save.
  return res.status(409).json({ ok: false, error: 'Use the Nova assistant to choose an available appointment.', next: '/service-request' });
}
