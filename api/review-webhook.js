// api/review-webhook.js

export default async function handler(req, res) {
  return res.status(200).json({ message: "Hello from Stamped Review Webhook!" });
}
