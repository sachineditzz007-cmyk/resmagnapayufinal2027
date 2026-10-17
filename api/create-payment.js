const crypto = require("crypto");
const { env, supabase, sha512, amountString, calculate } = require("./_shared");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const body = req.body || {};
    const p = body.participant || {};
    const name = String(p.name || "").trim().slice(0, 80);
    const email = String(p.email || "").trim().toLowerCase().slice(0, 160);
    const phone = String(p.phone || "").replace(/\D/g, "").slice(0, 15);
    const college = String(p.college || "").trim().slice(0, 180);
    const year = String(p.year || "").trim().slice(0, 60);
    const diet = String(p.diet || "").trim().slice(0, 40);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 10 || !college) return res.status(400).json({ error: "Enter valid name, email, mobile and college details." });
    const accommodation = body.accommodation || "none";
    const cart = calculate(body.eventIds, body.food, accommodation); // Never trust a browser-supplied amount.
    const amount = amountString(cart.total);
    const txnid = "RM27" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(5).toString("hex").toUpperCase();
    const productinfo = "RESMAGNA 2027 Registration";
    const firstname = name.split(/\s+/)[0];
    const key = env("PAYU_KEY"), salt = env("PAYU_SALT");
    const baseUrl = env("APP_BASE_URL").replace(/\/$/, "");
    const udf1 = "RESMAGNA2027", udf2 = "", udf3 = "", udf4 = "", udf5 = "";
    const hashString = [key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, "", "", "", "", "", salt].join("|");
    const hash = sha512(hashString);
    const db = supabase();
    const { error } = await db.from("registrations").insert({
      txnid, name, email, phone, college, course_year: year, food_preference: diet,
      attendance_token: crypto.randomBytes(24).toString("base64url"),
      events: cart.events, event_ids: body.eventIds, event_total: cart.eventTotal,
      food_selected: body.food, food_amount: cart.foodTotal,
      accommodation, accommodation_amount: cart.accommodationTotal,
      amount: cart.total, payment_status: "pending", productinfo
    });
    if (error) throw error;
    const fields = {
      key, txnid, amount, productinfo, firstname, email, phone,
      surl: baseUrl + "/api/response", furl: baseUrl + "/api/response", curl: baseUrl + "/api/response",
      udf1, udf2, udf3, udf4, udf5, hash
    };
    const paymentUrl = (process.env.PAYU_MODE || "test").toLowerCase() === "production" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment";
    return res.status(200).json({ paymentUrl, fields, txnid });
  } catch (error) {
    console.error("create-payment error:", error.message);
    return res.status(500).json({ error: "Unable to create payment. Check server environment variables and database setup." });
  }
};
