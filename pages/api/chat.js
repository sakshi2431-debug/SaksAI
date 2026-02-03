export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { message } = req.body || {};
  return res.status(200).json({
    answer: `Working ✅ You asked: ${message || ""}`,
    sources: [],
  });
}
