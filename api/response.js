const { parseForm, updateFromPayU } = require("./_shared");
const { sendRegistrationEmail } = require("./_email");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  try {
    const data = await parseForm(req);
    const result = await updateFromPayU(data);
    const success = result.payment_status === "success";
    let emailNote = "";
    try {
      await sendRegistrationEmail(result.txnid, success ? "success" : "failure");
      emailNote = success
        ? " A payment-confirmation email with your full registration details and QR attendance pass has been sent if this confirmation had not already been emailed."
        : " A payment-status update has been emailed if this status update had not already been sent.";
    } catch (emailError) {
      console.error("Registration email error:", emailError.message);
      emailNote = success
        ? " Your payment is verified, but the confirmation email could not be sent yet. Please contact the organizers with your transaction reference."
        : " We could not send the status email right now. Keep your transaction reference for any enquiry.";
    }
    const title = success ? "Payment verified" : "Payment not completed";
    const message = (success ? "Your PayU payment response has been verified. Keep this transaction reference for your records." : "PayU reported that this payment was not successful. If money was debited, contact the event organizers with this reference.") + emailNote;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · RESMAGNA 2027</title><style>body{font-family:system-ui;background:#f3f6fb;color:#15243b;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:540px;margin:20px;background:white;border-radius:20px;padding:32px;box-shadow:0 10px 40px #14264012}h1{font-size:26px}p{line-height:1.6}.ref{padding:12px;background:#f1f5f9;border-radius:10px;overflow-wrap:anywhere}a{color:#1764bd}</style></head><body><main class="card"><h1>${title}</h1><p>${message}</p><p class="ref"><strong>Transaction reference:</strong> ${String(result.txnid).replace(/[&<>"']/g, "")}</p><p><a href="/">Return to RESMAGNA 2027</a></p></main></body></html>`);
  } catch (error) {
    console.error("PayU response verification error:", error.message);
    return res.status(400).send("Unable to verify this PayU response. Do not treat the transaction as paid. Contact the event organizers if money was debited.");
  }
};
