const { createClient } = require("@supabase/supabase-js");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}

const BASE_ID = process.env.AIRTABLE_BASE_ID || "appPCaaLv4bp4QBWE";
const TABLE_ID = "tblKfRHfJRHIoTaW6";
const FIELDS = [
  "txnid", "name", "email", "phone", "college", "course_year",
  "food_preference", "events", "event_total", "food_selected", "food_amount",
  "accommodation", "accommodation_amount", "amount", "payment_status",
  "payu_txn_id", "payu_mode", "payu_unmapped_status", "created_at", "updated_at"
].join(",");

function toAirtable(row) {
  const events = Array.isArray(row.events) ? row.events : [];
  const fields = {
    "Registration ID": row.txnid,
    "Participant Name": row.name || "",
    "Email": row.email || "",
    "Phone": row.phone || "",
    "College": row.college || "",
    "Course / Year": row.course_year || "",
    "Food Preference": row.food_preference || "",
    "Events Selected": events.map(event => event.name || event.id).filter(Boolean),
    "Event Total": Number(row.event_total || 0),
    "Food Selected": Boolean(row.food_selected),
    "Food Amount": Number(row.food_amount || 0),
    "Accommodation": row.accommodation || "none",
    "Accommodation Amount": Number(row.accommodation_amount || 0),
    "Total Amount": Number(row.amount || 0),
    "Payment Status": String(row.payment_status || "pending").toLowerCase(),
    "Created At": row.created_at || new Date().toISOString(),
    "Updated At": row.updated_at || row.created_at || new Date().toISOString()
  };
  if (row.payu_txn_id) fields["PayU Transaction ID"] = row.payu_txn_id;
  if (row.payu_mode) fields["PayU Mode"] = row.payu_mode;
  if (row.payu_unmapped_status) fields["PayU Unmapped Status"] = row.payu_unmapped_status;
  return fields;
}

async function upsertRows(rows) {
  if (!rows.length) return { synced: 0 };
  const token = required("AIRTABLE_API_KEY");
  const url = "https://api.airtable.com/v0/" + BASE_ID + "/" + TABLE_ID;
  let synced = 0;
  // Airtable permits up to 10 records per batch request.
  for (let i = 0; i < rows.length; i += 10) {
    const batch = rows.slice(i, i + 10).map(row => ({ fields: toAirtable(row) }));
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["Registration ID"] },
        typecast: true,
        records: batch
      })
    });
    const raw = await response.text();
    let result = {};
    try { result = JSON.parse(raw); } catch {}
    if (!response.ok) {
      console.error("Airtable sync failed:", response.status, raw.slice(0, 1200));
      throw new Error("Airtable sync failed (HTTP " + response.status + "): " + (result.error?.message || raw.slice(0, 250)));
    }
    synced += Array.isArray(result.records) ? result.records.length : batch.length;
  }
  return { synced };
}

async function getDb() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });
}

async function syncRegistration(txnid) {
  const db = await getDb();
  const { data, error } = await db.from("registrations").select(FIELDS).eq("txnid", txnid).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Registration not found for Airtable sync");
  return upsertRows([data]);
}

async function syncAllRegistrations() {
  const db = await getDb();
  const { data, error } = await db.from("registrations").select(FIELDS).order("created_at", { ascending: true }).limit(1000);
  if (error) throw error;
  return upsertRows(data || []);
}

module.exports = { syncRegistration, syncAllRegistrations };
