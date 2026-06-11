import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, business, industry, phone, email, revenue, challenge, time, message } = req.body;

  // Save to Supabase if credentials present
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/demo_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          name, business, industry, phone, email,
          revenue, challenge, preferred_time: time, message,
          status: 'pending',
          created_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Supabase demo_requests save failed:', err.message);
    }
  }

  const key = process.env.RESEND_API_KEY;
  console.log('RESEND_API_KEY present:', !!key);

  if (!key) return res.status(200).json({ ok: true, warning: 'No Resend key — email not sent' });

  const resend = new Resend(key);

  const bodyText = [
    'New Demo Request — Nova Systems',
    '',
    `Name: ${name}`,
    `Business: ${business}`,
    `Industry: ${industry}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    `Monthly Revenue: ${revenue || 'Not provided'}`,
    `Biggest Challenge: ${challenge}`,
    `Best Time: ${time}`,
    '',
    'Message:',
    message || '(none)',
    '',
    `Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
  ].join('\n');

  try {
    await resend.emails.send({
      from: 'Nova Systems <noreply@nova-systems.app>',
      to: 'Isaac_0427@icloud.com',
      subject: `Demo Request: ${name} — ${business}`,
      text: bodyText,
    });

    if (email) {
      await resend.emails.send({
        from: 'Nova Systems <noreply@nova-systems.app>',
        to: email,
        subject: 'Demo request received — Nova Systems',
        text: `Hi ${name},\n\nYour demo request has been received. Isaac will reach out within 24 hours to confirm your strategy call.\n\n${bodyText}\n\n— Nova Systems\nnova-systems.app`,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend error:', err);
    res.status(500).json({ error: err.message });
  }
}
