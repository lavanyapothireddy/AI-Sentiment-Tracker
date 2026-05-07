// =========================================
// SENTIMENTAI — 100% Frontend Only
// Calls Groq API directly from the browser
// No backend needed — deploy as Static Site
// =========================================

// ── Groq API Key ──────────────────────────────────────────────
const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE"; // 🔁 Replace with your key from console.groq.com

const inputText    = document.getElementById("inputText");
const charCount    = document.getElementById("charCount");
const analyzeBtn   = document.getElementById("analyzeBtn");
const clearBtn     = document.getElementById("clearBtn");
const loadingState = document.getElementById("loadingState");
const resultCard   = document.getElementById("resultCard");

// ── Tab navigation ────────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "history") loadHistory();
    if (btn.dataset.tab === "stats")   loadStats();
  });
});

// ── Char counter ──────────────────────────────────────────────
inputText.addEventListener("input", () => {
  charCount.textContent = inputText.value.length;
});

// ── Sample pills ──────────────────────────────────────────────
document.querySelectorAll(".sample-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    inputText.value = pill.dataset.text;
    charCount.textContent = inputText.value.length;
    inputText.focus();
  });
});

// ── Clear ─────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  inputText.value = "";
  charCount.textContent = 0;
  resultCard.classList.add("hidden");
  loadingState.classList.add("hidden");
});

// ── Keyboard shortcut ─────────────────────────────────────────
inputText.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) analyze();
});
analyzeBtn.addEventListener("click", analyze);

// ── Analyze via Groq API directly ────────────────────────────
async function analyze() {
  const text = inputText.value.trim();
  if (!text) { shake(inputText); return; }

  analyzeBtn.disabled = true;
  resultCard.classList.add("hidden");
  loadingState.classList.remove("hidden");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
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
            content: `Analyze the sentiment of the following text and return ONLY this JSON:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": <number -1.0 to 1.0>,
  "confidence": <integer 0 to 100>,
  "emotions": [<up to 4 dominant emotions>],
  "summary": "<one concise sentence>",
  "keywords": [<up to 5 key sentiment words>]
}
Text: "${text.replace(/"/g, "'")}"`,
          },
        ],
      }),
    });

    if (res.status === 401) throw new Error("Invalid API key. Check your GROQ_API_KEY in app.js");

    const data = await res.json();
    const raw   = data.choices[0].message.content.trim();
    const clean = raw.replace(/```json|```/gi, "").trim();
    const result = JSON.parse(clean);

    const entry = {
      id: Date.now(),
      text,
      sentiment:  result.sentiment,
      score:      result.score,
      confidence: result.confidence,
      emotions:   result.emotions || [],
      summary:    result.summary  || "",
      keywords:   result.keywords || [],
      timestamp:  new Date().toISOString(),
    };

    saveToHistory(entry);
    renderResult(entry);

  } catch (err) {
    showToast("❌ " + err.message, "error");
  } finally {
    analyzeBtn.disabled = false;
    loadingState.classList.add("hidden");
  }
}

// ── Render result ─────────────────────────────────────────────
function renderResult(data) {
  const badge = document.getElementById("sentimentBadge");
  badge.textContent = data.sentiment.charAt(0).toUpperCase() + data.sentiment.slice(1);
  badge.className = `sentiment-badge ${data.sentiment}`;

  document.getElementById("scoreValue").textContent =
    (data.score >= 0 ? "+" : "") + Number(data.score).toFixed(2);
  document.getElementById("confidenceValue").textContent = data.confidence + "%";

  const pct = ((data.score + 1) / 2) * 100;
  const bar = document.getElementById("scoreBar");
  bar.style.width = pct + "%";
  const colors = { positive: "#22d3a0", negative: "#ff5b6b", neutral: "#8b90a0", mixed: "#f5a623" };
  bar.style.background = colors[data.sentiment] || "#6c6eff";

  document.getElementById("summaryText").textContent = data.summary || "—";
  document.getElementById("emotionTags").innerHTML =
    (data.emotions || []).map(e => `<span class="emotion-tag">${e}</span>`).join("");
  document.getElementById("keywordTags").innerHTML =
    (data.keywords || []).map(k => `<span class="keyword-tag">${k}</span>`).join("");

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── History (localStorage) ────────────────────────────────────
function saveToHistory(entry) {
  let history = getHistory();
  history.unshift(entry);
  if (history.length > 50) history = history.slice(0, 50);
  localStorage.setItem("sentiment_history", JSON.stringify(history));
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem("sentiment_history") || "[]"); }
  catch { return []; }
}

function loadHistory() {
  const list  = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");
  const data  = getHistory();
  list.innerHTML = "";
  empty.classList.add("hidden");

  if (!data.length) { empty.classList.remove("hidden"); return; }

  data.forEach(item => {
    const div  = document.createElement("div");
    div.className = "history-item";
    const score = (item.score >= 0 ? "+" : "") + Number(item.score).toFixed(2);
    const time  = new Date(item.timestamp).toLocaleString();
    div.innerHTML = `
      <div class="history-header">
        <span class="history-badge ${item.sentiment}">${item.sentiment}</span>
        <span class="history-score">Score: ${score} · ${item.confidence}% confidence</span>
        <span class="history-time">${time}</span>
      </div>
      <div class="history-text">${escapeHtml(item.text)}</div>
      ${item.emotions?.length
        ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
             ${item.emotions.map(e => `<span class="emotion-tag" style="font-size:11px">${e}</span>`).join("")}
           </div>`
        : ""}
    `;
    list.appendChild(div);
  });
}

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (!confirm("Clear all history?")) return;
  localStorage.removeItem("sentiment_history");
  loadHistory();
});

// ── Stats (from localStorage) ─────────────────────────────────
function loadStats() {
  const container = document.getElementById("statsContent");
  const empty     = document.getElementById("statsEmpty");
  container.innerHTML = "";
  empty.classList.add("hidden");

  const history = getHistory();
  if (!history.length) { empty.classList.remove("hidden"); return; }

  const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  let scoreSum = 0;
  history.forEach(e => {
    counts[e.sentiment] = (counts[e.sentiment] || 0) + 1;
    scoreSum += e.score || 0;
  });
  const total   = history.length;
  const avgScore = parseFloat((scoreSum / total).toFixed(2));
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const colors   = { positive: "#22d3a0", negative: "#ff5b6b", neutral: "#8b90a0", mixed: "#f5a623" };

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Analyses</div>
      <div class="stat-value">${total}</div>
      <div class="stat-sub">saved in your browser</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Average Score</div>
      <div class="stat-value" style="font-size:36px">${avgScore >= 0 ? "+" : ""}${avgScore}</div>
      <div class="stat-sub" style="color:${avgScore >= 0 ? "var(--positive)" : "var(--negative)"}">
        ${avgScore >= 0 ? "Generally positive" : "Generally negative"}
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Dominant Sentiment</div>
      <div class="stat-value" style="font-size:28px;color:${colors[dominant]};text-transform:capitalize;margin-top:4px">${dominant}</div>
      <div class="stat-sub">${counts[dominant]} of ${total} analyses</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">AI Model</div>
      <div class="stat-value" style="font-size:16px;font-family:var(--font-mono);margin-top:8px">Llama 3.3 70B</div>
      <div class="stat-sub" style="color:var(--accent2)">via Groq — ultra-fast inference</div>
    </div>
    <div class="stat-card wide">
      <div class="stat-label">Sentiment Breakdown</div>
      <div class="sentiment-bars" style="margin-top:16px">
        ${["positive","negative","neutral","mixed"].map(s => {
          const count = counts[s] || 0;
          const pct   = Math.round((count / total) * 100);
          return `
            <div class="sent-bar-item">
              <span class="sent-bar-label" style="color:${colors[s]}">${s}</span>
              <div class="sent-bar-track">
                <div class="sent-bar-fill" style="width:${pct}%;background:${colors[s]}"></div>
              </div>
              <span class="sent-bar-count">${count}</span>
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--text3);width:36px">${pct}%</span>
            </div>`;
        }).join("")}
      </div>
    </div>
  `;
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement("div");
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:var(--surface2);border:1px solid var(--border2);
    border-radius:10px;padding:14px 20px;
    font-family:var(--font-mono);font-size:13px;color:var(--text);
    box-shadow:0 8px 30px rgba(0,0,0,0.4);animation:fadeIn 0.3s ease;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function shake(el) {
  el.style.animation = "none"; el.offsetHeight;
  el.style.animation = "shake 0.4s ease";
  el.addEventListener("animationend", () => (el.style.animation = ""), { once: true });
}

function escapeHtml(t) {
  return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

const s = document.createElement("style");
s.textContent = `@keyframes shake {
  0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)}
  40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
}`;
document.head.appendChild(s);
