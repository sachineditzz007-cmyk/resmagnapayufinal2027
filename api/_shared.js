const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const EVENTS = {
  "E01": {
    "day": "Day 1",
    "type": "Workshop",
    "name": "ECG Interpretation Workshop",
    "price": 450
  },
  "E02": {
    "day": "Day 1",
    "type": "Workshop",
    "name": "Basic Suturing & Knot-Tying",
    "price": 650
  },
  "E03": {
    "day": "Day 1",
    "type": "Workshop",
    "name": "Basic Life Support (BLS)",
    "price": 700
  },
  "E04": {
    "day": "Day 1",
    "type": "Workshop",
    "name": "Airway Management Basics",
    "price": 550
  },
  "E05": {
    "day": "Day 1",
    "type": "Academic",
    "name": "Thyroid Case Presentation · Surgery",
    "price": 250
  },
  "E06": {
    "day": "Day 1",
    "type": "Competition",
    "name": "Clinical Case Challenge",
    "price": 300
  },
  "E07": {
    "day": "Day 1",
    "type": "Competition",
    "name": "Medical Quiz: Prelims",
    "price": 250
  },
  "E08": {
    "day": "Day 2",
    "type": "Workshop",
    "name": "ABG & Acid–Base Made Practical",
    "price": 450
  },
  "E09": {
    "day": "Day 2",
    "type": "Workshop",
    "name": "X-ray & Imaging Essentials",
    "price": 400
  },
  "E10": {
    "day": "Day 2",
    "type": "Workshop",
    "name": "Ultrasound Basics Demo",
    "price": 600
  },
  "E11": {
    "day": "Day 2",
    "type": "Academic",
    "name": "Research Paper Oral Presentation",
    "price": 350
  },
  "E12": {
    "day": "Day 2",
    "type": "Academic",
    "name": "Poster Presentation",
    "price": 300
  },
  "E13": {
    "day": "Day 2",
    "type": "Competition",
    "name": "Medical Quiz: Finals",
    "price": 250
  },
  "E14": {
    "day": "Day 2",
    "type": "Competition",
    "name": "Clinical Skills OSCE",
    "price": 400
  },
  "E15": {
    "day": "Day 2",
    "type": "Academic",
    "name": "Pharmacology Prescription Audit",
    "price": 250
  },
  "E16": {
    "day": "Day 3",
    "type": "Workshop",
    "name": "Wound Care & Dressing",
    "price": 450
  },
  "E17": {
    "day": "Day 3",
    "type": "Workshop",
    "name": "Obstetric Emergency Drill",
    "price": 600
  },
  "E18": {
    "day": "Day 3",
    "type": "Competition",
    "name": "Anatomy Spotters",
    "price": 250
  },
  "E19": {
    "day": "Day 3",
    "type": "Competition",
    "name": "Medical Photography & Infographic",
    "price": 300
  },
  "E20": {
    "day": "Day 3",
    "type": "Academic",
    "name": "Grand Clinical Debate",
    "price": 250
  }
};
const EVENT_SLOTS = {
  "E01": "A",
  "E02": "B",
  "E03": "D",
  "E04": "E",
  "E05": "A",
  "E06": "C",
  "E07": "B",
  "E08": "A",
  "E09": "A",
  "E10": "B",
  "E11": "B",
  "E12": "C",
  "E13": "C",
  "E14": "D",
  "E15": "D",
  "E16": "A",
  "E17": "B",
  "E18": "A",
  "E19": "C",
  "E20": "D"
};
const ADDONS = { food: 900, shared: 1500, private: 2800, none: 0 };
function env(name) { const value = process.env[name]; if (!value) throw new Error(`Missing environment variable: ${name}`); return value; }
function supabase() { return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }); }
function sha512(value) { return crypto.createHash("sha512").update(value, "utf8").digest("hex"); }
function safeEqual(a, b) { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")); }
function amountString(value) { return Number(value).toFixed(2); }
function calculate(eventIds, food, accommodation) {
  if (!Array.isArray(eventIds) || eventIds.length < 1 || eventIds.length > 20) throw new Error("Choose between 1 and 20 events.");
  const unique = [...new Set(eventIds)];
  if (unique.length !== eventIds.length || unique.some(id => !EVENTS[id])) throw new Error("Invalid or duplicate event selection.");
  if (typeof food !== "boolean") throw new Error("Invalid food selection.");
  if (!Object.prototype.hasOwnProperty.call(ADDONS, accommodation)) throw new Error("Invalid accommodation selection.");
  const events = unique.map(id => ({ id, ...EVENTS[id] }));
  const occupiedSlots = new Set();
  for (const event of events) {
    const slotKey = `${event.day}|${EVENT_SLOTS[event.id]}`;
    if (occupiedSlots.has(slotKey)) {
      const conflicting = events.find(other => other.id !== event.id && other.day === event.day && EVENT_SLOTS[other.id] === EVENT_SLOTS[event.id]);
      throw new Error(`Event time conflict: ${event.name} overlaps with ${conflicting ? conflicting.name : "another selected event"}. Please choose only one event per time slot.`);
    }
    occupiedSlots.add(slotKey);
  }
  const eventTotal = events.reduce((sum, event) => sum + event.price, 0);
  const foodTotal = food ? ADDONS.food : 0;
  const accommodationTotal = ADDONS[accommodation];
  return { events, eventTotal, foodTotal, accommodationTotal, total: eventTotal + foodTotal + accommodationTotal };
}
function verifyResponseHash(data, salt) {
  const seq = [salt, data.status || "", "", "", "", "", "", data.udf5 || "", data.udf4 || "", data.udf3 || "", data.udf2 || "", data.udf1 || "", data.email || "", data.firstname || "", data.productinfo || "", data.amount || "", data.txnid || "", data.key || ""];
  // Standard PayU reverse hash: SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
  return safeEqual(sha512(seq.join("|")), String(data.hash || "").toLowerCase());
}
async function parseForm(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return Object.fromEntries(new URLSearchParams(req.body));
  let body = ""; for await (const chunk of req) body += chunk; return Object.fromEntries(new URLSearchParams(body));
}
async function updateFromPayU(data) {
  const db = supabase();
  const { data: row, error } = await db.from("registrations").select("txnid,amount,payment_status").eq("txnid", data.txnid).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Unknown transaction ID");
  if (amountString(data.amount) !== amountString(row.amount)) throw new Error("Amount mismatch");
  if (data.key !== env("PAYU_KEY")) throw new Error("Merchant key mismatch");
  if (!verifyResponseHash(data, env("PAYU_SALT"))) throw new Error("Invalid PayU response hash");
  const status = String(data.status || "").toLowerCase() === "success" ? "success" : "failure";
  // Do not downgrade a previously confirmed success on a later failure callback.
  const finalStatus = row.payment_status === "success" ? "success" : status;
  const { error: updateError } = await db.from("registrations").update({
    payment_status: finalStatus,
    payu_txn_id: data.mihpayid || null,
    payu_mode: data.mode || null,
    payu_unmapped_status: data.unmappedstatus || null,
    payu_response: data,
    updated_at: new Date().toISOString()
  }).eq("txnid", data.txnid);
  if (updateError) throw updateError;
  return { txnid: data.txnid, payment_status: finalStatus };
}
module.exports = { env, supabase, sha512, amountString, calculate, verifyResponseHash, parseForm, updateFromPayU };
