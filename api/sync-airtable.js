const { syncAllRegistrations } = require("./_airtable");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  const auth = req.headers.authorization || "";
  if (!expected || auth !== "Bearer " + expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await syncAllRegistrations();
    console.log("Airtable initial/full sync complete:", result.synced);
    return res.status(200).json({ ok: true, synced: result.synced });
  } catch (error) {
    console.error("Airtable full sync error:", error.message);
    return res.status(502).json({ error: "Airtable sync failed", detail: error.message });
  }
};
