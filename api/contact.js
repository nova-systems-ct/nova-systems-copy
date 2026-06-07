export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.RESEND_API_KEY;
  console.log("[api/contact] API_KEY present:", !!API_KEY);

  if (!API_KEY) {
    console.error("[api/contact] RESEND_API_KEY is not set");
    return res.status(500).json({ error: "Email service not configured — RESEND_API_KEY missing" });
  }

  const {
    subject, body, replyTo,
    confirmTo, confirmName,
    name, email, company, phone, message,
  } = req.body;

  console.log("[api/contact] Incoming payload:", {
    subject, name, email, company, phone,
    hasBody: !!body, hasConfirmTo: !!confirmTo,
  });

  const FROM = "Nova Systems <noreply@nova-systems.app>";
  const DEST = "Isaac_0427@icloud.com";

  const emailBody =
    body ||
    [
      name && `Name: ${name}`,
      email && `Email: ${email}`,
      company && `Company: ${company}`,
      phone && `Phone: ${phone}`,
      message && `\nMessage:\n${message}`,
    ]
      .filter(Boolean)
      .join("\n") ||
    "(no details provided)";

  const emailSubject = subject || "New Submission — Nova Systems";

  // ── Send notification to Isaac ──────────────────────────────────────────────
  let mainPayload;
  try {
    mainPayload = {
      from: FROM,
      to: [DEST],
      subject: emailSubject,
      text: emailBody,
      ...(replyTo || email ? { reply_to: replyTo || email } : {}),
    };

    console.log("[api/contact] Sending to Resend:", mainPayload);

    const r1 = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mainPayload),
    });

    const r1Body = await r1.text();
    console.log("[api/contact] Resend response status:", r1.status);
    console.log("[api/contact] Resend response body:", r1Body);

    if (!r1.ok) {
      console.error("[api/contact] Resend error sending main email:", r1.status, r1Body);
      return res.status(500).json({ error: "Failed to send email", details: r1Body });
    }
  } catch (err) {
    console.error("[api/contact] Fetch error sending main email:", err.message);
    return res.status(500).json({ error: "Network error contacting Resend" });
  }

  // ── Send confirmation to submitter ───────────────────────────────────────────
  const confirmEmail = confirmTo || email;
  const confirmNameStr = confirmName || name || "there";

  if (confirmEmail) {
    try {
      const confirmPayload = {
        from: FROM,
        to: [confirmEmail],
        subject: "We received your request — Nova Systems",
        text: [
          `Hi ${confirmNameStr},`,
          "",
          "Thanks for reaching out to Nova Systems. Isaac will personally review your request and get back to you within 24 hours.",
          "",
          "Talk soon,",
          "Isaac Nova",
          "Founder, Nova Systems",
        ].join("\n"),
      };

      console.log("[api/contact] Sending confirmation to:", confirmEmail);

      const r2 = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(confirmPayload),
      });

      const r2Body = await r2.text();
      console.log("[api/contact] Confirmation response:", r2.status, r2Body);

      if (!r2.ok) {
        console.warn("[api/contact] Confirmation email failed (non-fatal):", r2.status, r2Body);
      }
    } catch (err) {
      console.warn("[api/contact] Confirmation email network error (non-fatal):", err.message);
    }
  }

  return res.status(200).json({ ok: true });
}
