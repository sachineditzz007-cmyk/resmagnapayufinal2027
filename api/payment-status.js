const { supabase } = require("./_shared");
module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const txnid = String(req.query.txnid || "").slice(0, 80);
  if (!txnid) return res.status(400).json({ error: "Missing transaction reference" });
  try {
    const { data, error } = await supabase().from("registrations").select("txnid,payment_status,amount,created_at").eq("txnid", txnid).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Transaction not found" });
    return res.status(200).json(data);
  } catch (e) { console.error("payment-status error:", e.message); return res.status(500).json({ error: "Could not read payment status" }); }
};
