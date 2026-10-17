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
  return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
const money = value => "₹" + Number(value || 0).toLocaleString("en-IN");

async function sendRegistrationEmail(txnid) {
  const client = db();
  const { data: row, error } = await client.from("registrations")
    .select("txnid,name,email,phone,college,course_year,food_preference,events,event_total,food_selected,food_amount,accommodation,accommodation_amount,amount,payment_status,attendance_token,confirmation_email_sent_at,created_at")
    .eq("txnid", txnid).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Registration not found");
  if (String(row.payment_status).toLowerCase() !== "success") return { sent: false, reason: "payment_not_successful" };
  if (row.confirmation_email_sent_at) return { sent: true, alreadySent: true };

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

  const qrText = "RESMAGNA2027:" + token;
  const qrDataUrl = await QRCode.toDataURL(qrText, { errorCorrectionLevel: "H", margin: 2, width: 360 });
  const events = Array.isArray(row.events) ? row.events : [];
  const eventHtml = events.length
    ? events.map(event => '<li style="margin:0 0 7px">' + esc(event.name || event.id || "Registered event") + ' <span style="color:#64748b">(' + money(event.price) + ')</span></li>').join("")
    : "<li>See your registration reference below.</li>";
  const from = required("RESEND_FROM_EMAIL");
  const apiKey = required("RESEND_API_KEY");
  const subject = "Your RESMAGNA 2027 registration pass · " + row.txnid;
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#17263c;padding:24px">
  <div style="max-width:620px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #dbe4ef">
    <div style="background:#10233f;color:#fff;padding:26px 28px"><div style="font-size:12px;letter-spacing:3px;color:#7ce4d6;font-weight:bold">GOVERNMENT THOOTHUKUDI MEDICAL COLLEGE</div><h1 style="margin:10px 0 4px;font-size:28px">RESMAGNA 2027</h1><div style="color:#dbeafe">3–5 January 2027 · SKARZXXIINOZZ’ 22</div></div>
    <div style="padding:26px 28px"><h2 style="margin:0 0 8px">Registration confirmed, ${esc(row.name)}</h2><p style="line-height:1.6;color:#475569;margin-top:0">Your payment has been verified. Keep this email available on your phone and show the QR pass to the organizer at check-in.</p>
    <div style="text-align:center;background:#f8fafc;border:1px dashed #94a3b8;border-radius:14px;padding:18px;margin:20px 0"><img alt="Unique RESMAGNA attendance QR code" width="240" height="240" src="cid:resmagna-qr" style="display:block;width:240px;height:240px;max-width:100%;margin:auto"><div style="font-size:11px;letter-spacing:2px;color:#0f766e;font-weight:bold;margin-top:8px">SCAN FOR ATTENDANCE VERIFICATION</div><div style="font-size:12px;color:#64748b;margin-top:8px">Registration reference</div><div style="font-size:18px;font-weight:bold;overflow-wrap:anywhere">${esc(row.txnid)}</div></div>
    <h3 style="font-size:16px">Participant details</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="padding:8px 0;color:#64748b">Name</td><td style="padding:8px 0;font-weight:bold">${esc(row.name)}</td></tr><tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0">${esc(row.email)}</td></tr><tr><td style="padding:8px 0;color:#64748b">Mobile</td><td style="padding:8px 0">${esc(row.phone)}</td></tr><tr><td style="padding:8px 0;color:#64748b">College</td><td style="padding:8px 0">${esc(row.college)}</td></tr><tr><td style="padding:8px 0;color:#64748b">Course / year</td><td style="padding:8px 0">${esc(row.course_year)}</td></tr><tr><td style="padding:8px 0;color:#64748b">Food</td><td style="padding:8px 0">${esc(row.food_selected ? (row.food_preference + " · " + money(row.food_amount)) : "Not selected")}</td></tr><tr><td style="padding:8px 0;color:#64748b">Accommodation</td><td style="padding:8px 0">${esc(row.accommodation || "None")} · ${money(row.accommodation_amount)}</td></tr><tr><td style="padding:8px 0;color:#64748b">Total paid</td><td style="padding:8px 0;font-size:17px;font-weight:bold;color:#0f766e">${money(row.amount)}</td></tr></table>
    <h3 style="font-size:16px;margin-top:24px">Your selected events</h3><ul style="padding-left:20px;line-height:1.5;font-size:13px">${eventHtml}</ul>
    <p style="font-size:12px;color:#64748b;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:16px">This QR code is unique to your registration. Do not share it. Organizers will verify the pass against the registration system and record attendance once.</p></div>
    <div style="background:#f8fafc;padding:16px 28px;font-size:11px;color:#64748b">RESMAGNA 2027 · Government Thoothukudi Medical College · Registration support: contact the event organizers.</div>
  </div></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      reply_to: process.env.RESEND_REPLY_TO || "sachinst557@gmail.com",
      to: [row.email],
      subject,
      html,
      attachments: [{ filename: "resmagna-2027-qr.png", content: qrDataUrl.split(",")[1], content_type: "image/png", content_id: "resmagna-qr" }],
      text: "RESMAGNA 2027 registration pass\nName: " + row.name + "\nReference: " + row.txnid + "\nPayment verified: " + money(row.amount) + "\nYour QR pass is included in the HTML email. Present it at organizer check-in."
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Resend email failed: " + (result.message || response.status));
  const { error: sentError } = await client.from("registrations")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("txnid", txnid).is("confirmation_email_sent_at", null);
  if (sentError) throw sentError;
  return { sent: true };
}
module.exports = { sendRegistrationEmail };
