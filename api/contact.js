export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.RESEND_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "Email service not configured" });
  }

  const {
    subject, body, replyTo,
    confirmTo, confirmName,
    name, email, company, phone, message,
  } = req.body;

  const FROM = "Nova Systems <noreply@nova-systems.app>";
  const DEST = "Isaac_0427@icloud.com";

  const emailBody =
    body ||
    [
      name    && `Name: ${name}`,
      email   && `Email: ${email}`,
      company && `Company: ${company}`,
      phone   && `Phone: ${phone}`,
      message && `\nMessage:\n${message}`,
    ]
      .filter(Boolean)
      .join("\n") ||
    "(no details)";

  const emailSubject = subject || "New Submission — Nova Systems";

  try {
    const r1 = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [DEST],
        subject: emailSubject,
        text: emailBody,
        ...(replyTo || email ? { reply_to: replyTo || email } : {}),
      }),
    });

    if (!r1.ok) {
      const errText = await r1.text();
      console.error("Resend error:", errText);
      return res.status(500).json({ error: "Failed to send email" });
    }

    const confirmEmail = confirmTo || email;
    const confirmNameStr = confirmName || name || "there";
    if (confirmEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("api/contact error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
