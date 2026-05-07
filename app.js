// =========================================
// SENTIMENTAI — Frontend App Logic
// Powered by Groq (llama-3.3-70b-versatile)
// =========================================

const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : "https://sentiment-tracker-backend.onrender.com"; // 🔁 Update with your Render backend URL

// --- DOM REFS ---
const inputText   = document.getElementById("inputText");
const charCount   = document.getElementById("charCount");
const analyzeBtn  = document.getElementById("analyzeBtn");
const clearBtn    = document.getElementById("clearBtn");
const loadingState = document.getElementById("loadingState");
const resultCard  = document.getElementById("resultCard");

// --- TABS ---
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    const tab = document.getElementById(`tab-${btn.dataset.tab}`);
    if (tab) tab.classList.add("active");
    if (btn.dataset.tab === "history") loadHistory();
    if (btn.dataset.tab === "stats") loadStats();
  });
});

// --- CHAR COUNTER ---
inputText.addEventListener("input", () => {
  charCount.textContent = inputText.value.length;
});

// --- SAMPLE PILLS ---
document.querySelectorAll(".sample-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    inputText.value = pill.dataset.text;
    charCount.textContent = inputText.value.length;
    inputText.focus();
  });
});

// --- CLEAR ---
clearBtn.addEventListener("click", () => {
  inputText.value = "";
  charCount.textContent = 0;
  resultCard.classList.add("hidden");
  loadingState.classList.add("hidden");
});

// --- ANALYZE ---
analyzeBtn.addEventListener("click", analyze);
inputText.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) analyze();
});

async function analyze() {
  const text = inputText.value.trim();
  if (!text) {
    shake(inputText);
    return;
  }

  analyzeBtn.disabled = true;
  resultCard.classList.add("hidden");
  loadingState.classList.remove("hidden");

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Server error");
    }

    const data = await res.json();
    renderResult(data);
  } catch (err) {
    alert("❌ " + err.message);
  } finally {
    analyzeBtn.disabled = false;
    loadingState.classList.add("hidden");
  }
}

// --- RENDER RESULT ---
function renderResult(data) {
  // Badge
  const badge = document.getElementById("sentimentBadge");
  badge.textContent = data.sentiment.charAt(0).toUpperCase() + data.sentiment.slice(1);
  badge.className = `sentiment-badge ${data.sentiment}`;

  // Scores
  document.getElementById("scoreValue").textContent = (data.score >= 0 ? "+" : "") + Number(data.score).toFixed(2);
  document.getElementById("confidenceValue").textContent = data.confidence + "%";

  // Score bar: map -1..1 to 0..100%
  const pct = ((data.score + 1) / 2) * 100;
  const bar = document.getElementById("scoreBar");
  bar.style.width = pct + "%";
  const colors = { positive: "#22d3a0", negative: "#ff5b6b", neutral: "#8b90a0", mixed: "#f5a623" };
  bar.style.background = colors[data.sentiment] || "#6c6eff";

  // Summary
  document.getElementById("summaryText").textContent = data.summary || "—";

  // Emotions
  const emotionContainer = document.getElementById("emotionTags");
  emotionContainer.innerHTML = (data.emotions || [])
    .map(e => `<span class="emotion-tag">${e}</span>`).join("");

  // Keywords
  const keywordContainer = document.getElementById("keywordTags");
  keywordContainer.innerHTML = (data.keywords || [])
    .map(k => `<span class="keyword-tag">${k}</span>`).join("");

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// --- HISTORY ---
async function loadHistory() {
  const list = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");
  list.innerHTML = `<div class="loading-state"><div class="pulse-ring"></div><p>Loading history...</p></div>`;
  empty.classList.add("hidden");

  try {
    const res = await fetch(`${API_BASE}/api/history`);
    const data = await res.json();
    list.innerHTML = "";

    if (!data.length) {
      empty.classList.remove("hidden");
      return;
    }

    data.forEach(item => {
      const div = document.createElement("div");
      div.className = "history-item";
      const time = new Date(item.timestamp).toLocaleString();
      const score = (item.score >= 0 ? "+" : "") + Number(item.score).toFixed(2);
      div.innerHTML = `
        <div class="history-header">
          <span class="history-badge ${item.sentiment}">${item.sentiment}</span>
          <span class="history-score">Score: ${score} · ${item.confidence}% confidence</span>
          <span class="history-time">${time}</span>
        </div>
        <div class="history-text">${escapeHtml(item.text)}</div>
        ${item.emotions?.length ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${item.emotions.map(e => `<span class="emotion-tag" style="font-size:11px">${e}</span>`).join("")}</div>` : ""}
      `;
      list.appendChild(div);
    });
  } catch {
    list.innerHTML = `<p style="color:var(--negative);text-align:center">Failed to load history.</p>`;
  }
}

// --- CLEAR HISTORY ---
document.getElementById("clearHistoryBtn").addEventListener("click", async () => {
  if (!confirm("Clear all analysis history?")) return;
  await fetch(`${API_BASE}/api/history`, { method: "DELETE" });
  loadHistory();
});

// --- STATS ---
async function loadStats() {
  const container = document.getElementById("statsContent");
  const empty = document.getElementById("statsEmpty");
  container.innerHTML = "";
  empty.classList.add("hidden");

  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    const data = await res.json();

    if (!data.total) {
      empty.classList.remove("hidden");
      return;
    }

    const colors = { positive: "#22d3a0", negative: "#ff5b6b", neutral: "#8b90a0", mixed: "#f5a623" };
    const avgLabel = data.avgScore >= 0
      ? `<span style="color:var(--positive)">+${data.avgScore} (generally positive)</span>`
      : `<span style="color:var(--negative)">${data.avgScore} (generally negative)</span>`;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Analyses</div>
        <div class="stat-value">${data.total}</div>
        <div class="stat-sub">entries in session</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Average Score</div>
        <div class="stat-value" style="font-size:36px">${data.avgScore >= 0 ? "+" : ""}${data.avgScore}</div>
        <div class="stat-sub">${avgLabel}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dominant Sentiment</div>
        <div class="stat-value" style="font-size:32px;color:${colors[data.dominantSentiment] || '#6c6eff'};text-transform:capitalize">${data.dominantSentiment}</div>
        <div class="stat-sub">${data.counts[data.dominantSentiment]} of ${data.total} analyses</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">AI Model</div>
        <div class="stat-value" style="font-size:18px;font-family:var(--font-mono);margin-top:8px">Llama 3.3 70B</div>
        <div class="stat-sub" style="color:var(--accent2)">via Groq — ultra-fast inference</div>
      </div>
      <div class="stat-card wide">
        <div class="stat-label">Sentiment Breakdown</div>
        <div class="sentiment-bars" style="margin-top:16px">
          ${["positive","negative","neutral","mixed"].map(s => {
            const count = data.counts[s] || 0;
            const pct = data.total ? Math.round((count / data.total) * 100) : 0;
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
  } catch {
    container.innerHTML = `<p style="color:var(--negative)">Failed to load stats.</p>`;
  }
}

// --- UTILS ---
function shake(el) {
  el.style.animation = "none";
  el.offsetHeight; // reflow
  el.style.animation = "shake 0.4s ease";
  el.addEventListener("animationend", () => el.style.animation = "", { once: true });
}

function escapeHtml(text) {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Inject shake keyframe
const style = document.createElement("style");
style.textContent = `@keyframes shake {
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-8px)}
  40%{transform:translateX(8px)}
  60%{transform:translateX(-6px)}
  80%{transform:translateX(6px)}
}`;
document.head.appendChild(style);
