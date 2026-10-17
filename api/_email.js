const crypto = require("crypto");
const QRCode = require("qrcode");
const { createClient } = require("@supabase/supabase-js");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}
function db() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });
}
function esc(value) {
  return String(value == null || value === "" ? "Not provided" : value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
const money = value => "₹" + Number(value || 0).toLocaleString("en-IN");
const label = value => String(value || "none").replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

async function sendRegistrationEmail(txnid, requestedStage) {
  const client = db();
  const { data: row, error } = await client.from("registrations")
    .select("txnid,name,email,phone,college,gender,course_year,food_preference,events,event_total,food_selected,food_amount,accommodation,accommodation_amount,amount,payment_status,attendance_token,pending_email_sent_at,failure_email_sent_at,confirmation_email_sent_at,created_at")
    .eq("txnid", txnid).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Registration not found");

  const status = String(row.payment_status || "pending").toLowerCase();
  const stage = requestedStage || (status === "success" ? "success" : status === "failure" ? "failure" : "pending");
  if (stage === "success" && status !== "success") return { sent: false, reason: "payment_not_successful" };
  if (stage === "failure" && status !== "failure") return { sent: false, reason: "payment_not_failed" };
  const sentColumn = stage === "success" ? "confirmation_email_sent_at" : stage === "failure" ? "failure_email_sent_at" : "pending_email_sent_at";
  if (row[sentColumn]) return { sent: true, alreadySent: true };

  let qrDataUrl = null;
  if (stage === "success") {
    let token = row.attendance_token;
    if (!token) {
      token = crypto.randomBytes(24).toString("base64url");
      const { error: tokenError } = await client.from("registrations")
        .update({ attendance_token: token }).eq("txnid", txnid).is("attendance_token", null);
      if (tokenError) throw tokenError;
      const { data: latest, error: latestError } = await client.from("registrations")
        .select("attendance_token,confirmation_email_sent_at").eq("txnid", txnid).single();
      if (latestError) throw latestError;
      token = latest.attendance_token;
      if (latest.confirmation_email_sent_at) return { sent: true, alreadySent: true };
    }
    qrDataUrl = await QRCode.toDataURL("RESMAGNA2027:" + token, { errorCorrectionLevel: "H", margin: 2, width: 360 });
  }

  const events = Array.isArray(row.events) ? row.events : [];
  const eventHtml = events.length
    ? events.map(event => '<tr><td style="padding:11px 12px;border-bottom:1px solid #e7edf5;color:#24364b">' + esc(event.name || event.id || "Registered event") + '<div style="font-size:11px;color:#7b8ba0;margin-top:3px">' + esc(event.day || "") + (event.type ? " · " + esc(event.type) : "") + '</div></td><td align="right" style="padding:11px 12px;border-bottom:1px solid #e7edf5;white-space:nowrap;font-weight:700;color:#24364b">' + money(event.price) + '</td></tr>').join("")
    : '<tr><td colspan="2" style="padding:12px;color:#64748b">No event details are available for this registration.</td></tr>';

  const statusConfig = stage === "success"
    ? { title: "Payment confirmed", subtitle: "Your registration payment has been verified successfully.", color: "#087f68", pale: "#e8f8f3", icon: "✓" }
    : stage === "failure"
      ? { title: "Payment not successful", subtitle: "The payment provider has reported that this transaction was not successful. If your account was debited, please contact the organizers before trying again.", color: "#b45309", pale: "#fff7e6", icon: "!" }
      : { title: "Registration received", subtitle: "Your registration details have been received. Payment is not confirmed yet. We will send you an updated email if the payment is verified.", color: "#9a6700", pale: "#fff8df", icon: "…" };

  const from = required("BREVO_FROM_EMAIL");
  const apiKey = required("BREVO_API_KEY");
  const subject = (stage === "success" ? "Payment confirmed" : stage === "failure" ? "Payment status update" : "Registration details received") + " · RESMAGNA 2027 · " + row.txnid;
  const qrBlock = stage === "success"
    ? '<div style="margin:22px 0;padding:22px;text-align:center;border:1px dashed #9ab5c9;border-radius:14px;background:#f7fbff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:800;color:#0d7668">YOUR OFFICIAL ATTENDANCE PASS</div><img alt="Unique RESMAGNA 2027 attendance QR pass" width="220" height="220" src="cid:resmagna-qr" style="display:block;width:220px;height:220px;max-width:100%;margin:14px auto 8px"><div style="font-size:12px;color:#60758b">Show this QR code to the organizers at check-in.</div><div style="font-size:12px;line-height:1.8;color:#334b63;margin-top:10px"><strong>Registration:</strong> '+esc(row.txnid)+'<br><strong>College:</strong> '+esc(row.college)+'<br><strong>Gender:</strong> '+esc(row.gender || "Not provided")+'</div></div>'
    : '<div style="margin:22px 0;padding:16px 18px;background:#f6f8fb;border:1px solid #e2e8f0;border-radius:12px;color:#52657a;font-size:13px;line-height:1.6"><strong style="color:#24364b">Attendance pass:</strong> Your QR attendance pass will be included in the confirmation email after your payment is verified.</div>';

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
  <body style="margin:0;padding:0;background:#edf2f8;font-family:Arial,Helvetica,sans-serif;color:#1d2d42">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(statusConfig.title)} · RESMAGNA 2027 registration details and payment summary.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf2f8;padding:28px 10px"><tr><td align="center">
  <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dce5ef;border-radius:18px;overflow:hidden">
    <tr><td style="background:#10243d;padding:30px 32px 26px">
      <div style="font-size:11px;letter-spacing:2px;line-height:1.6;font-weight:700;color:#a6dcd6">GOVERNMENT THOOTHUKUDI MEDICAL COLLEGE</div>
      <div style="font-size:31px;line-height:1.15;font-weight:800;letter-spacing:1px;color:#ffffff;margin-top:10px">RESMAGNA <span style="color:#79d7ca">2027</span></div>
      <div style="font-size:13px;line-height:1.7;color:#d7e2ef;margin-top:8px">3–5 January 2027 <span style="color:#79d7ca">|</span> Participant Registration</div>
    </td></tr>
    <tr><td style="padding:28px 32px 8px">
      <div style="font-size:14px;color:#62748a">Dear ${esc(row.name)},</div>
      <h1 style="font-size:24px;line-height:1.3;margin:9px 0 12px;color:#162a43">${esc(statusConfig.title)}</h1>
      <p style="font-size:14px;line-height:1.75;color:#52657a;margin:0">${esc(statusConfig.subtitle)}</p>
      <div style="margin-top:20px;padding:15px 17px;background:${statusConfig.pale};border:1px solid ${statusConfig.color}30;border-radius:12px">
        <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:${statusConfig.color}">CURRENT PAYMENT STATUS</div>
        <div style="font-size:18px;font-weight:800;color:${statusConfig.color};margin-top:6px">${stage === "success" ? "PAID · CONFIRMED" : stage === "failure" ? "NOT SUCCESSFUL" : "PENDING · NOT YET CONFIRMED"}</div>
      </div>
      <div style="margin:23px 0 8px;font-size:11px;letter-spacing:1.4px;font-weight:800;color:#6d8197;text-transform:uppercase">Registration reference</div>
      <div style="font-size:17px;line-height:1.5;letter-spacing:.4px;font-weight:800;color:#183b5b;overflow-wrap:anywhere">${esc(row.txnid)}</div>
      ${qrBlock}
    </td></tr>
    <tr><td style="padding:12px 32px 4px">
      <h2 style="font-size:16px;margin:0 0 12px;color:#172d47">Participant information</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:13px">
        ${[
          ["Full name",row.name],["Email address",row.email],["Mobile number",row.phone],["College / institution",row.college],["Gender",row.gender || "Not provided"],["Course / year",row.course_year]
        ].map(([k,v]) => '<tr><td width="39%" style="padding:10px 0;border-bottom:1px solid #edf1f6;color:#75869a;vertical-align:top">' + esc(k) + '</td><td style="padding:10px 0;border-bottom:1px solid #edf1f6;color:#263a52;font-weight:600;overflow-wrap:anywhere">' + esc(v) + '</td></tr>').join("")}
      </table>
    </td></tr>
    <tr><td style="padding:24px 32px 4px">
      <h2 style="font-size:16px;margin:0 0 12px;color:#172d47">Selected events</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e7edf5;border-radius:10px;border-collapse:separate;border-spacing:0;overflow:hidden">
        <tr><td colspan="2" style="padding:11px 12px;background:#f5f8fc;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:800;color:#6a7e94">Event / activity</td></tr>
        ${eventHtml}
        <tr><td style="padding:12px;font-size:13px;color:#52657a">Events subtotal</td><td align="right" style="padding:12px;font-size:13px;font-weight:700;color:#263a52">${money(row.event_total)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 32px 4px">
      <h2 style="font-size:16px;margin:0 0 12px;color:#172d47">Food & accommodation</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:13px">
        <tr><td style="padding:10px 0;border-bottom:1px solid #edf1f6;color:#75869a">Food selection</td><td align="right" style="padding:10px 0;border-bottom:1px solid #edf1f6;color:#263a52;font-weight:600">${row.food_selected ? esc(label(row.food_preference)) + " · " + money(row.food_amount) : "Not selected · ₹0"}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #edf1f6;color:#75869a">Accommodation</td><td align="right" style="padding:10px 0;border-bottom:1px solid #edf1f6;color:#263a52;font-weight:600">${esc(label(row.accommodation))} · ${money(row.accommodation_amount)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 32px 28px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f8fc;border:1px solid #e2eaf3;border-radius:12px"><tr><td style="padding:17px 18px;color:#52657a;font-size:13px;line-height:1.6">Total registration amount</td><td align="right" style="padding:17px 18px;color:#173b5a;font-size:23px;font-weight:800;white-space:nowrap">${money(row.amount)}</td></tr></table>
      <p style="font-size:12px;line-height:1.7;color:#738399;margin:16px 0 0">${stage === "success" ? "Please keep this email and your QR pass safe. The attendance pass is unique to your registration and should not be shared." : stage === "failure" ? "This email is a status update, not a payment receipt. If money was debited, do not pay again immediately. Share the registration reference with the organizers so they can help verify the transaction." : "This email acknowledges receipt of your registration details only. It is not a payment receipt or confirmation of a successful transaction. Please retain the reference above until your payment status is updated."}</p>
    </td></tr>
    <tr><td style="background:#10243d;padding:23px 32px;text-align:center">
      <div style="font-size:14px;font-weight:700;color:#ffffff">Thank you for being part of RESMAGNA 2027.</div>
      <div style="font-size:12px;line-height:1.8;color:#c4d2e2;margin-top:7px">We look forward to welcoming you for three days of learning, collaboration and celebration.</div>
      <div style="height:1px;background:#31465f;margin:18px 0"></div>
      <div style="font-size:12px;letter-spacing:1px;font-weight:800;color:#a6dcd6">CONDUCTING BATCH · SKARXXIINOZZ 22</div>
      <div style="font-size:10px;line-height:1.7;color:#91a5bb;margin-top:8px">RESMAGNA 2027 · Government Thoothukudi Medical College</div>
    </td></tr>
  </table>
  <div style="font-size:10px;line-height:1.7;color:#8291a4;text-align:center;max-width:600px;padding:15px 10px">This is an automated registration email. Keep your transaction reference for any payment-related enquiry.</div>
  </td></tr></table></body></html>`;

  const body = {
    sender: { email: from, name: "RESMAGNA 2027" },
    replyTo: { email: process.env.BREVO_REPLY_TO || "sachinst557@gmail.com" },
    // Send to the email address supplied by the participant in the registration form.
    to: [{ email: row.email, name: row.name }],
    subject,
    htmlContent: html,
    textContent: [
      "RESMAGNA 2027 · Government Thoothukudi Medical College",
      "Dear " + row.name + ",",
      statusConfig.title,
      statusConfig.subtitle,
      "Payment status: " + (stage === "success" ? "PAID / CONFIRMED" : stage === "failure" ? "NOT SUCCESSFUL" : "PENDING / NOT CONFIRMED"),
      "Registration reference: " + row.txnid,
      "Name: " + row.name,
      "Email: " + row.email,
      "Mobile: " + row.phone,
      "College: " + row.college,
      "Gender: " + (row.gender || "Not provided"),
      "Course / year: " + row.course_year,
      "Events: " + events.map(e => (e.name || e.id) + " (" + money(e.price) + ")").join(", "),
      "Food: " + (row.food_selected ? label(row.food_preference) + " (" + money(row.food_amount) + ")" : "Not selected"),
      "Accommodation: " + label(row.accommodation) + " (" + money(row.accommodation_amount) + ")",
      "Events subtotal: " + money(row.event_total),
      "Total registration amount: " + money(row.amount),
      stage === "success" ? "Your unique QR attendance pass is attached/embedded in this email." : "Your QR attendance pass will be provided in the payment-confirmation email.",
      "Thank you for participating in RESMAGNA 2027.",
      "Conducting batch: SKARXXIINOZZ 22"
    ].join("\n")
  };
  if (qrDataUrl) body.attachment = [{
    name: "resmagna-2027-qr.png",
    content: qrDataUrl.split(",")[1]
  }];

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const raw = await response.text();
  let result = {};
  try {
    result = JSON.parse(raw);
  } catch {
    // Preserve non-JSON response text for diagnostics.
  }
  if (!response.ok) {
    // Log status and response body only, never API keys or request headers.
    console.error("Brevo API error:", {
      status: response.status,
      body: raw.slice(0, 1500)
    });
    throw new Error(
      `Brevo email failed (HTTP ${response.status}): ${result.message || result.code || raw.slice(0, 300) || "Empty response"}`
    );
  }
  const { error: sentError } = await client.from("registrations")
    .update({ [sentColumn]: new Date().toISOString() })
    .eq("txnid", txnid).is(sentColumn, null);
  if (sentError) throw sentError;
  return { sent: true, stage };
}
module.exports = { sendRegistrationEmail };
