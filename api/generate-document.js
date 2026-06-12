import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';

const VALID_TYPES = ['Proposal', 'Contract', 'Invoice', 'Scope of Work', 'Letter of Intent'];

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const b = req.body || {};
  const entity_name = sanitize(b.entity_name, 200);
  const industry    = sanitize(b.industry, 100);
  const doc_type    = sanitize(b.doc_type, 60);
  const description = sanitize(b.description, 2000);
  const client_id   = sanitize(b.client_id, 100);
  const lead_id     = sanitize(b.lead_id, 100);

  if (!entity_name || !doc_type) {
    return res.status(400).json({ error: 'entity_name and doc_type are required' });
  }
  if (!VALID_TYPES.includes(doc_type)) {
    return res.status(400).json({ error: 'Invalid document type' });
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const userPrompt = [
    `Generate a professional ${doc_type} for: ${entity_name}`,
    industry ? `Industry: ${industry}` : '',
    `Date: ${today}`,
    description ? `\nSpecific details / instructions:\n${description}` : '',
    '\nNova Systems info: Isaac Nova, Founder | nova-systems.app | Waterbury, CT | isaac@nova-systems.app',
    '\nFormat as a clean, professional, ready-to-sign document with clear sections.',
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: [
          'You are a professional business document writer for Nova Systems, a Connecticut-based operational infrastructure company.',
          'Nova Systems builds custom websites, CRMs, AI agents, and social media systems for small businesses.',
          'Generate clean, professional, concise documents. Use plain text with clear sections and line breaks.',
          'Include a proper letterhead, date, parties involved, terms, and signature lines.',
          'Be specific and business-ready. Do not include placeholder text — write real content based on the context provided.',
        ].join(' '),
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[generate-document] Anthropic error:', data.error);
      return res.status(500).json({ error: data.error.message || 'AI generation failed' });
    }

    const text = data.content?.[0]?.text || '';

    // Save to Supabase if configured
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && (client_id || lead_id)) {
      try {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            client_id: client_id || null,
            lead_id: lead_id || null,
            entity_name,
            type: doc_type,
            content: text,
            status: 'draft',
            created_at: new Date().toISOString(),
          }),
        });
        console.log('[generate-document] Draft saved to Supabase');
      } catch (err) {
        console.error('[generate-document] Supabase save (non-fatal):', err.message);
      }
    }

    res.status(200).json({ text });
  } catch (err) {
    console.error('[generate-document] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate document' });
  }
}
