// =====================================================
// SENTIMENTAI — app.js
// API key injected at build time via build.sh
// No banner shown to users — key is pre-configured.
// =====================================================

// ── API Key (injected by build.sh at deploy time) ──
// During build, __GROQ_API_KEY__ is replaced with the
// real key from the Render environment variable.
const GROQ_API_KEY = "__GROQ_API_KEY__";

// ── DOM Refs ───────────────────────────────────────
const inputText    = document.getElementById("inputText");
const charCount    = document.getElementById("charCount");
const analyzeBtn   = document.getElementById("analyzeBtn");
const clearBtn     = document.getElementById("clearBtn");
const loadingState = document.getElementById("loadingState");
const resultCard   = document.getElementById("resultCard");

// ── Tab navigation ─────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "history") renderHistory();
    if (btn.dataset.tab === "stats")   renderStats();
  });
});

// ── Char counter ───────────────────────────────────
inputText.addEventListener("input", () => {
  charCount.textContent = inputText.value.length;
});

// ── Sample pills ───────────────────────────────────
document.querySelectorAll(".sample-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    inputText.value = pill.dataset.text;
    charCount.textContent = inputText.value.length;
    inputText.focus();
  });
});

// ── Clear ──────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  inputText.value = "";
  charCount.textContent = 0;
  resultCard.classList.add("hidden");
  loadingState.classList.add("hidden");
});

// ── Keyboard shortcut ──────────────────────────────
inputText.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) analyze();
});
analyzeBtn.addEventListener("click", analyze);

// ── Core: Call Groq API ────────────────────────────
async function analyze() {
  const text = inputText.value.trim();
  if (!text) { shake(inputText); return; }

  // Guard: if build script didn't run (local dev without key)
  if (!GROQ_API_KEY || GROQ_API_KEY === "__GROQ_API_KEY__") {
    showToast("⚠️ No API key configured. Set GROQ_API_KEY in Render environment and redeploy.");
    return;
  }

  analyzeBtn.disabled = true;
  resultCard.classList.add("hidden");
  loadingState.classList.remove("hidden");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  512,
        temperature: 0.2,
        messages: [
          {
            role:    "system",
            content: "You are a precise sentiment analysis engine. Always respond with ONLY a valid JSON object — no markdown fences, no explanation, no extra text.",
          },
          {
            role: "user",
            content: `Analyze the sentiment of the following text. Return ONLY this exact JSON:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": <float -1.0 to +1.0>,
  "confidence": <integer 0 to 100>,
  "emotions": [<up to 4 dominant emotion strings>],
  "summary": "<one concise sentence describing the overall sentiment>",
  "keywords": [<up to 5 key sentiment-bearing words from the text>]
}

Text:
"""
${text.replace(/"/g, "'")}
"""`,
          },
        ],
      }),
    });

    if (res.status === 401) {
      throw new Error("Invalid API key — update GROQ_API_KEY in Render and redeploy");
    }
    if (res.status === 429) {
      throw new Error("Rate limit hit — please wait a moment and try again");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Groq API error ${res.status}`);
    }

    const data   = await res.json();
    const raw    = data.choices?.[0]?.message?.content?.trim() || "";
    const clean  = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let result;
    try { result = JSON.parse(clean); }
    catch { throw new Error("Could not parse AI response — please try again"); }

    if (!result.sentiment || result.score === undefined) {
      throw new Error("Incomplete AI response — please try again");
    }

    const entry = {
      id:         Date.now(),
      text,
      sentiment:  result.sentiment,
      score:      Number(result.score) || 0,
      confidence: Number(result.confidence) || 50,
      emotions:   Array.isArray(result.emotions) ? result.emotions : [],
      summary:    result.summary  || "",
      keywords:   Array.isArray(result.keywords) ? result.keywords : [],
      timestamp:  new Date().toISOString(),
    };

    saveEntry(entry);
    renderResult(entry);

  } catch (err) {
    console.error("Groq error:", err);
    showToast("❌ " + err.message);
  } finally {
    analyzeBtn.disabled = false;
    loadingState.classList.add("hidden");
  }
}

// ── Render result ──────────────────────────────────
function renderResult(data) {
  const badge = document.getElementById("sentimentBadge");
  badge.textContent = cap(data.sentiment);
  badge.className   = `sentiment-badge ${data.sentiment}`;

  document.getElementById("scoreValue").textContent =
    (data.score >= 0 ? "+" : "") + Number(data.score).toFixed(2);
  document.getElementById("confidenceValue").textContent =
    data.confidence + "%";

  const pct    = Math.round(((Number(data.score) + 1) / 2) * 100);
  const colors = { positive:"#22d3a0", negative:"#ff5b6b", neutral:"#8b90a0", mixed:"#f5a623" };
  const bar    = document.getElementById("scoreBar");
  bar.style.width      = pct + "%";
  bar.style.background = colors[data.sentiment] || "#6c6eff";

  document.getElementById("summaryText").textContent = data.summary || "—";

  document.getElementById("emotionTags").innerHTML =
    (data.emotions || []).map(e => `<span class="emotion-tag">${escHtml(e)}</span>`).join("")
    || `<span style="color:var(--text3);font-size:13px">None detected</span>`;

  document.getElementById("keywordTags").innerHTML =
    (data.keywords || []).map(k => `<span class="keyword-tag">${escHtml(k)}</span>`).join("")
    || `<span style="color:var(--text3);font-size:13px">None detected</span>`;

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── localStorage helpers ───────────────────────────
function getEntries() {
  try { return JSON.parse(localStorage.getItem("sentiment_history") || "[]"); }
  catch { return []; }
}
function saveEntry(entry) {
  let list = getEntries();
  list.unshift(entry);
  if (list.length > 50) list = list.slice(0, 50);
  localStorage.setItem("sentiment_history", JSON.stringify(list));
}

// ── History tab ────────────────────────────────────
function renderHistory() {
  const list  = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");
  const data  = getEntries();
  list.innerHTML = "";
  empty.classList.add("hidden");
  if (!data.length) { empty.classList.remove("hidden"); return; }

  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    const score = fmtScore(item.score);
    const time  = new Date(item.timestamp).toLocaleString();
    div.innerHTML = `
      <div class="history-header">
        <span class="history-badge ${item.sentiment}">${item.sentiment}</span>
        <span class="history-score">Score: ${score} &middot; ${item.confidence}% confidence</span>
        <span class="history-time">${time}</span>
      </div>
      <div class="history-text">${escHtml(item.text)}</div>
      ${item.emotions?.length
        ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
             ${item.emotions.map(e => `<span class="emotion-tag" style="font-size:11px">${escHtml(e)}</span>`).join("")}
           </div>` : ""}
    `;
    list.appendChild(div);
  });
}

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (!confirm("Clear all history? This cannot be undone.")) return;
  localStorage.removeItem("sentiment_history");
  renderHistory();
});

// ── Stats tab ──────────────────────────────────────
function renderStats() {
  const wrap  = document.getElementById("statsContent");
  const empty = document.getElementById("statsEmpty");
  wrap.innerHTML = "";
  empty.classList.add("hidden");

  const entries = getEntries();
  if (!entries.length) { empty.classList.remove("hidden"); return; }

  const counts = { positive:0, negative:0, neutral:0, mixed:0 };
  let scoreSum = 0;
  entries.forEach(e => {
    counts[e.sentiment] = (counts[e.sentiment] || 0) + 1;
    scoreSum += Number(e.score) || 0;
  });

  const total    = entries.length;
  const avgScore = parseFloat((scoreSum / total).toFixed(2));
  const dominant = Object.entries(counts).sort((a,b) => b[1]-a[1])[0][0];
  const colors   = { positive:"#22d3a0", negative:"#ff5b6b", neutral:"#8b90a0", mixed:"#f5a623" };

  wrap.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Analyses</div>
      <div class="stat-value">${total}</div>
      <div class="stat-sub">saved in your browser</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Average Score</div>
      <div class="stat-value" style="font-size:40px">${avgScore >= 0 ? "+" : ""}${avgScore}</div>
      <div class="stat-sub" style="color:${avgScore >= 0 ? "var(--positive)" : "var(--negative)"}">
        ${avgScore >= 0 ? "Generally positive" : "Generally negative"}
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Dominant Sentiment</div>
      <div class="stat-value" style="font-size:30px;text-transform:capitalize;margin-top:6px;color:${colors[dominant]}">${dominant}</div>
      <div class="stat-sub">${counts[dominant]} of ${total} analyses</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">AI Model</div>
      <div class="stat-value" style="font-size:15px;font-family:var(--font-mono);margin-top:6px;line-height:1.5">
        Llama 3.3<br/>70B Versatile
      </div>
      <div class="stat-sub" style="color:var(--accent2);margin-top:4px">via Groq — ultra-fast inference</div>
    </div>
    <div class="stat-card wide">
      <div class="stat-label">Sentiment Breakdown</div>
      <div class="sentiment-bars" style="margin-top:18px">
        ${["positive","negative","neutral","mixed"].map(s => {
          const n   = counts[s] || 0;
          const pct = Math.round((n / total) * 100);
          return `
            <div class="sent-bar-item">
              <span class="sent-bar-label" style="color:${colors[s]}">${s}</span>
              <div class="sent-bar-track">
                <div class="sent-bar-fill" style="width:${pct}%;background:${colors[s]}"></div>
              </div>
              <span class="sent-bar-count">${n}</span>
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--text3);width:38px;text-align:right">${pct}%</span>
            </div>`;
        }).join("")}
      </div>
    </div>
  `;
}

// ── Toast ──────────────────────────────────────────
function showToast(msg) {
  document.getElementById("_toast")?.remove();
  const t = document.createElement("div");
  t.id = "_toast";
  Object.assign(t.style, {
    position:"fixed", bottom:"28px", right:"28px", zIndex:"99999",
    background:"#141720", border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:"12px", padding:"14px 20px", maxWidth:"380px",
    fontFamily:"'Geist Mono',monospace", fontSize:"13px", color:"#e8eaf0",
    boxShadow:"0 10px 40px rgba(0,0,0,0.6)", lineHeight:"1.55",
  });
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ── Utils ──────────────────────────────────────────
function shake(el) {
  el.style.animation = "none"; el.offsetHeight;
  el.style.animation = "shake 0.4s ease";
  el.addEventListener("animationend", () => (el.style.animation = ""), { once: true });
}
const cap      = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
const fmtScore = s => (Number(s) >= 0 ? "+" : "") + Number(s).toFixed(2);
const escHtml  = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

const _style = document.createElement("style");
_style.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}   20%{transform:translateX(-8px)}
    40%{transform:translateX(8px)}     60%{transform:translateX(-5px)}
    80%{transform:translateX(5px)}
  }
  @keyframes fadeUp {
    from{opacity:0;transform:translateY(10px)}
    to{opacity:1;transform:translateY(0)}
  }
`;
document.head.appendChild(_style);
