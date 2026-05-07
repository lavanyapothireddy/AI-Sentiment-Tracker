const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// In-memory history (use a DB like MongoDB/Postgres in production)
let analysisHistory = [];

app.post("/api/analyze", async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 512,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a sentiment analysis engine. Always respond with ONLY a valid JSON object — no markdown, no backticks, no explanation.",
        },
        {
          role: "user",
          content: `Analyze the sentiment of the following text and return ONLY this JSON structure:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": <number from -1.0 to 1.0>,
  "confidence": <integer from 0 to 100>,
  "emotions": [<up to 4 dominant emotions as short strings>],
  "summary": "<one concise sentence describing the sentiment>",
  "keywords": [<up to 5 key sentiment-bearing words from the text>]
}

Text: "${text.replace(/"/g, "'")}"`,
        },
      ],
    });

    const raw = completion.choices[0].message.content.trim();
    const clean = raw.replace(/```json|```/gi, "").trim();
    const result = JSON.parse(clean);

    const entry = {
      id: Date.now(),
      text,
      ...result,
      timestamp: new Date().toISOString(),
    };

    analysisHistory.unshift(entry);
    if (analysisHistory.length > 50) analysisHistory = analysisHistory.slice(0, 50);

    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed. Check your GROQ_API_KEY." });
  }
});

app.get("/api/history", (req, res) => {
  res.json(analysisHistory);
});

app.delete("/api/history", (req, res) => {
  analysisHistory = [];
  res.json({ message: "History cleared" });
});

app.get("/api/stats", (req, res) => {
  const total = analysisHistory.length;
  if (total === 0) return res.json({ total: 0 });

  const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  let scoreSum = 0;

  analysisHistory.forEach((e) => {
    counts[e.sentiment] = (counts[e.sentiment] || 0) + 1;
    scoreSum += e.score || 0;
  });

  res.json({
    total,
    counts,
    avgScore: (scoreSum / total).toFixed(2),
    dominantSentiment: Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0],
  });
});

app.get("/health", (req, res) => res.json({ status: "ok", provider: "Groq", model: "llama-3.3-70b-versatile" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server on port ${PORT} — powered by Groq`));
