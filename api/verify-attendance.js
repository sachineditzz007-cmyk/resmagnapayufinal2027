const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
function equal(a,b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || !equal(supplied, expected)) return res.status(401).json({ error: "Organizer authentication required." });
  try {
    const body = req.body || {};
    const token = String(body.token || "").replace(/^RESMAGNA2027:/, "").trim();
    const organizer = String(body.organizer || "Organizer").trim().slice(0, 100);
    if (!/^[A-Za-z0-9_-]{30,80}$/.test(token)) return res.status(400).json({ error: "This QR code is not a valid RESMAGNA 2027 pass." });
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server configuration missing");
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: row, error } = await db.from("registrations")
      .select("txnid,name,email,phone,college,course_year,events,amount,payment_status,attendance_checked_in_at,attendance_checked_in_by")
      .eq("attendance_token", token).maybeSingle();
    if (error) throw error;
    if (!row || String(row.payment_status).toLowerCase() !== "success") {
      return res.status(404).json({ error: "Pass not found or payment is not verified. Do not admit on this QR alone." });
    }
    if (row.attendance_checked_in_at) {
      return res.status(409).json({ error: "ALREADY CHECKED IN", alreadyCheckedIn: true, registration: row });
    }
    const { data: updated, error: updateError } = await db.from("registrations")
      .update({ attendance_checked_in_at: new Date().toISOString(), attendance_checked_in_by: organizer })
      .eq("txnid", row.txnid).is("attendance_checked_in_at", null)
      .select("txnid,name,email,phone,college,course_year,events,amount,payment_status,attendance_checked_in_at,attendance_checked_in_by").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      const { data: latest } = await db.from("registrations")
        .select("txnid,name,email,phone,college,course_year,events,amount,payment_status,attendance_checked_in_at,attendance_checked_in_by")
        .eq("txnid", row.txnid).single();
      return res.status(409).json({ error: "ALREADY CHECKED IN", alreadyCheckedIn: true, registration: latest || row });
    }
    return res.status(200).json({ ok: true, registration: updated });
  } catch (error) {
    console.error("verify-attendance error:", error.message);
    return res.status(500).json({ error: "Could not verify attendance." });
  }
};
