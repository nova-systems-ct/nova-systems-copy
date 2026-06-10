const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Nova Systems <noreply@nova-systems.app>";
const ISAAC_EMAIL = "Isaac_0427@icloud.com";

async function sendEmail({ to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Resend error");
  return data;
}

Deno.serve(async (req) => {
  try {
    const { type, payload } = await req.json();

    if (type === "new_application") {
      const { name, email, phone, position, canRecord, ownsCamera, hasDrone,
              hasEditingExp, editingSoftware, portfolioUrl, resumeName,
              experience, education, whyNova, availability, expectedPay, isFilled } = payload;

      // Email to Isaac
      await sendEmail({
        to: ISAAC_EMAIL,
        subject: `New Application: ${position} — ${name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;color:#222">
            <h2 style="color:#D4A030">New Job Application — Nova Systems</h2>
            <p><strong>Position:</strong> ${position}${isFilled ? " <em>(Filled — future consideration)</em>" : ""}</p>
            <hr/>
            <h3>Applicant</h3>
            <p><strong>Name:</strong> ${name}<br/><strong>Email:</strong> ${email}<br/><strong>Phone:</strong> ${phone}</p>
            <h3>Equipment & Skills</h3>
            <p>Can record video: <strong>${canRecord}</strong><br/>
               Owns camera/1080p phone: <strong>${ownsCamera}</strong><br/>
               Has drone: <strong>${hasDrone}</strong><br/>
               Editing experience: <strong>${hasEditingExp}${hasEditingExp === "yes" ? ` — ${editingSoftware}` : ""}</strong></p>
            ${portfolioUrl ? `<p><strong>Portfolio:</strong> <a href="${portfolioUrl}">${portfolioUrl}</a></p>` : ""}
            ${resumeName ? `<p><strong>Resume:</strong> ${resumeName}</p>` : ""}
            <h3>Background</h3>
            <p><strong>Experience:</strong><br/>${(experience || "").replace(/\n/g, "<br/>")}</p>
            <p><strong>Education:</strong> ${education || "—"}</p>
            <p><strong>Why Nova Systems:</strong><br/>${(whyNova || "").replace(/\n/g, "<br/>")}</p>
            <p><strong>Availability:</strong> ${availability}<br/><strong>Expected Pay:</strong> ${expectedPay}</p>
          </div>`,
      });

      // Confirmation to applicant
      await sendEmail({
        to: email,
        subject: "Application Received — Nova Systems",
        html: `
          <div style="font-family:sans-serif;max-width:600px;color:#222">
            <h2 style="color:#D4A030">You're in the pipeline, ${name}.</h2>
            <p>We received your application for <strong>${position}</strong>.</p>
            <p>Isaac will personally review it and reach out within a few days. Keep an eye on your inbox.</p>
            <p>You can check your application status anytime at:<br/>
               <a href="https://nova-systems-copy.base44.app/applicant-login" style="color:#D4A030">nova-systems.app/applicant-login</a></p>
            <hr/>
            <p style="color:#888;font-size:12px">Nova Systems · Waterbury, CT</p>
          </div>`,
      });

      return Response.json({ ok: true });
    }

    if (type === "status_interview") {
      const { applicantEmail, applicantName, interviewDate, interviewTime } = payload;
      await sendEmail({
        to: applicantEmail,
        subject: "Interview Scheduled — Nova Systems",
        html: `
          <div style="font-family:sans-serif;max-width:600px;color:#222">
            <h2 style="color:#D4A030">Your interview is scheduled, ${applicantName}.</h2>
            <p>Isaac wants to meet with you. Here are your details:</p>
            <div style="background:#f9f6ee;padding:20px;border-left:4px solid #D4A030;margin:20px 0">
              <p><strong>Date:</strong> ${interviewDate}</p>
              <p><strong>Time:</strong> ${interviewTime}</p>
              <p><strong>Location:</strong> Bread of Heaven, 141 Grand St, Waterbury, CT</p>
            </div>
            <p>Please arrive 5 minutes early. Bring your portfolio if you have one.</p>
            <p>Questions? Reply to this email.</p>
            <hr/>
            <p style="color:#888;font-size:12px">Nova Systems · Waterbury, CT</p>
          </div>`,
      });
      return Response.json({ ok: true });
    }

    if (type === "status_hired") {
      const { applicantEmail, applicantName, token } = payload;
      const link = `https://nova-systems-copy.base44.app/set-password?token=${token}`;
      await sendEmail({
        to: applicantEmail,
        subject: "Welcome to Nova Systems — You're Hired",
        html: `
          <div style="font-family:sans-serif;max-width:600px;color:#222">
            <h2 style="color:#D4A030">Welcome to the team, ${applicantName}.</h2>
            <p>You've been selected to join Nova Systems. We're excited to build with you.</p>
            <p>Set up your employee account by clicking the link below:</p>
            <p><a href="${link}" style="display:inline-block;background:#D4A030;color:#0a0800;padding:14px 28px;font-weight:700;text-decoration:none;margin:12px 0">SET UP MY ACCOUNT</a></p>
            <p>Once you're in, you'll see your assignments and schedule.</p>
            <hr/>
            <p style="color:#888;font-size:12px">Nova Systems · Waterbury, CT</p>
          </div>`,
      });
      return Response.json({ ok: true });
    }

    if (type === "status_declined") {
      const { applicantEmail, applicantName, position } = payload;
      await sendEmail({
        to: applicantEmail,
        subject: "Your Nova Systems Application — Update",
        html: `
          <div style="font-family:sans-serif;max-width:600px;color:#222">
            <h2 style="color:#D4A030">Thank you for applying, ${applicantName}.</h2>
            <p>After reviewing your application for <strong>${position}</strong>, we've decided to move forward with other candidates at this time.</p>
            <p>We genuinely appreciate you taking the time to apply and sharing your story with us. Keep building — the right opportunity is out there.</p>
            <p>We'll keep your information on file and may reach out in the future if the right fit opens up.</p>
            <p>Best of luck,<br/><strong>Isaac & the Nova Systems team</strong></p>
            <hr/>
            <p style="color:#888;font-size:12px">Nova Systems · Waterbury, CT</p>
          </div>`,
      });
      return Response.json({ ok: true });
    }

    if (type === "manual_invite") {
      const { toEmail, toName } = payload;
      await sendEmail({
        to: toEmail,
        subject: "Isaac from Nova Systems wants you to apply",
        html: `
          <div style="font-family:sans-serif;max-width:600px;color:#222">
            <h2 style="color:#D4A030">Hey${toName ? ` ${toName}` : ""},</h2>
            <p>Isaac Nova from <strong>Nova Systems</strong> thinks you'd be a great fit for the team.</p>
            <p>Nova Systems is a growing AI-powered revenue and content agency based in Waterbury, CT — and we're looking for hungry, talented people.</p>
            <p>Fill out your application here:</p>
            <p><a href="https://nova-systems-copy.base44.app/careers" style="display:inline-block;background:#D4A030;color:#0a0800;padding:14px 28px;font-weight:700;text-decoration:none;margin:12px 0">APPLY NOW</a></p>
            <p>Takes less than 5 minutes. Isaac personally reviews every application.</p>
            <hr/>
            <p style="color:#888;font-size:12px">Nova Systems · Waterbury, CT</p>
          </div>`,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown email type" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});