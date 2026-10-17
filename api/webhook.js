const { parseForm, updateFromPayU } = require("./_shared");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  try {
    const data = await parseForm(req);
    const result = await updateFromPayU(data);
    return res.status(200).json({ received: true, txnid: result.txnid, payment_status: result.payment_status });
  } catch (error) {
    console.error("PayU webhook verification error:", error.message);
    return res.status(400).json({ received: false, error: "Invalid or unrecognized PayU notification" });
  }
};
