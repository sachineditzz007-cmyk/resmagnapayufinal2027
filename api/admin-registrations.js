const { supabase, env } = require("./_shared");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || supplied.length !== expected.length || !require("crypto").timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const db = supabase();
    const { data, error } = await db.from("registrations")
      .select("txnid,name,email,phone,college,gender,course_year,food_preference,attendance_dates,privacy_consent,privacy_consent_at,event_ids,events,event_total,food_selected,food_amount,accommodation,accommodation_amount,amount,payment_status,payu_txn_id,payu_mode,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return res.status(200).json({ registrations: data || [] });
  } catch (error) {
    console.error("admin registrations error:", error.message);
    return res.status(500).json({ error: "Could not load registrations" });
  }
};
