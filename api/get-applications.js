import { rateLimit } from './_rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('[get-applications] Supabase not configured — returning empty');
    return res.status(200).json([]);
  }

  try {
    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/applications?select=*&order=submitted_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!sbRes.ok) {
      console.error('[get-applications] Supabase error:', sbRes.status, await sbRes.text());
      return res.status(200).json([]);
    }

    const rows = await sbRes.json();

    // Normalize Supabase column names to match frontend localStorage schema
    const normalized = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone || '',
      position: r.position,
      status: r.status || 'new',
      cover_letter: r.cover_letter || '',
      experience: r.experience || '',
      why_nova: r.why_nova_systems || '',
      availability: r.availability || '',
      expected_pay: r.expected_pay || '',
      password_hash: r.password_hash || '',
      portfolio_url: r.portfolio_url || '',
      owns_camera: r.owns_camera || '',
      camera_specs: r.camera_specs || '',
      has_editing_exp: r.has_editing_exp || '',
      editing_software: r.editing_software || '',
      social_media: r.social_media || '',
      has_drone: r.has_drone || '',
      sales_experience: r.sales_experience || '',
      industries: r.industries || '',
      has_car: r.has_car || '',
      cold_calling: r.cold_calling || '',
      biggest_sale: r.biggest_sale || '',
      reference_1_name: r.reference_1_name || '',
      reference_1_relationship: r.reference_1_relationship || '',
      reference_1_phone: r.reference_1_phone || '',
      reference_1_email: r.reference_1_email || '',
      reference_2_name: r.reference_2_name || '',
      reference_2_relationship: r.reference_2_relationship || '',
      reference_2_phone: r.reference_2_phone || '',
      reference_2_email: r.reference_2_email || '',
      reference_3_name: r.reference_3_name || '',
      reference_3_relationship: r.reference_3_relationship || '',
      reference_3_phone: r.reference_3_phone || '',
      reference_3_email: r.reference_3_email || '',
      resume_name: r.resume_name || '',
      submittedAt: r.submitted_at,
      submitted_at: r.submitted_at,
      status_messages: r.status_messages || [],
      adminNotes: r.admin_notes || '',
      interviewDate: r.interview_date || '',
      interviewTime: r.interview_time || '',
    }));

    return res.status(200).json(normalized);
  } catch (err) {
    console.error('[get-applications] Error:', err.message);
    return res.status(200).json([]);
  }
}
