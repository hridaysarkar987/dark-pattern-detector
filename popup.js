// popup.js - UI logic for the extension popup

// ─── DOM refs ────────────────────────────────────────────────────────────────
const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKey");
const scanBtn = document.getElementById("scanBtn");
const clearBtn = document.getElementById("clearBtn");
const scanIcon = document.getElementById("scanIcon");
const scanText = document.getElementById("scanText");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const spinner = document.getElementById("spinner");
const scoreSection = document.getElementById("scoreSection");
const scoreCircle = document.getElementById("scoreCircle");
const scoreNum = document.getElementById("scoreNum");
const scoreTitle = document.getElementById("scoreTitle");
const scoreDesc = document.getElementById("scoreDesc");
const resultsSection = document.getElementById("resultsSection");
const resultsList = document.getElementById("resultsList");
const cleanMsg = document.getElementById("cleanMsg");

// ─── Load saved API key ───────────────────────────────────────────────────────
chrome.storage.local.get(["apiKey"], ({ apiKey }) => {
  if (apiKey) {
    apiKeyInput.value = apiKey;
    saveKeyBtn.classList.add("saved");
    saveKeyBtn.textContent = "Saved ✓";
  }
});

// ─── Save API key ─────────────────────────────────────────────────────────────
saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  chrome.storage.local.set({ apiKey: key }, () => {
    saveKeyBtn.textContent = "Saved ✓";
    saveKeyBtn.classList.add("saved");
    setTimeout(() => {
      saveKeyBtn.textContent = "Save";
      saveKeyBtn.classList.remove("saved");
    }, 2000);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setStatus(msg, type = "") {
  statusEl.className = "status visible " + type;
  statusText.textContent = msg;
  spinner.style.display = type === "loading" ? "block" : "none";
}

function hideStatus() {
  statusEl.className = "status";
}

function setScanningState(active) {
  scanBtn.disabled = active;
  if (active) {
    scanBtn.classList.add("scanning");
    scanIcon.textContent = "⏳";
    scanText.textContent = "Analyzing...";
  } else {
    scanBtn.classList.remove("scanning");
    scanIcon.textContent = "🔍";
    scanText.textContent = "Scan This Page";
  }
}

function getScoreInfo(count, highCount) {
  if (count === 0) return { cls: "clean", title: "Page is Clean", desc: "No manipulation detected" };
  if (highCount >= 3) return { cls: "danger", title: "Highly Manipulative", desc: `${highCount} high-severity pattern${highCount > 1 ? "s" : ""} found` };
  if (count >= 3 || highCount >= 1) return { cls: "warn", title: "Suspicious Page", desc: `${count} dark pattern${count > 1 ? "s" : ""} detected` };
  return { cls: "warn", title: "Minor Issues Found", desc: `${count} low-risk pattern${count > 1 ? "s" : ""} detected` };
}

function renderResults(darkPatterns) {
  resultsList.innerHTML = "";
  resultsList.innerHTML = darkPatterns.map(p => `
    <div class="result-item ${p.severity}">
      <div class="result-top">
        <span class="result-label">${escapeHtml(p.label || p.category || "Dark Pattern")}</span>
        <span class="result-sev">${p.severity === "high" ? "HIGH" : "MEDIUM"}</span>
      </div>
      <div class="result-text">"${escapeHtml(truncate(p.text, 80))}"</div>
      ${p.explanation ? `<div class="result-explanation">${escapeHtml(p.explanation)}</div>` : ""}
    </div>
  `).join("");
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ─── Clear highlights ─────────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, { action: "CLEAR" });
    clearBtn.style.display = "none";
    scoreSection.className = "score-section";
    resultsSection.className = "results-section";
    cleanMsg.className = "clean-msg";
    hideStatus();
  });
});

// ─── Main scan flow ───────────────────────────────────────────────────────────
scanBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    setStatus("Please enter your Anthropic API key first", "error");
    return;
  }

  setScanningState(true);
  setStatus("Scraping page elements...", "loading");
  scoreSection.className = "score-section";
  resultsSection.className = "results-section";
  cleanMsg.className = "clean-msg";
  clearBtn.style.display = "none";

  try {
    // Step 1: Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Step 2: Ensure content script is injected (fallback)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    }).catch(() => {}); // already injected is fine

    // Step 3: Scrape DOM
    const scrapeResult = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "SCRAPE" }, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res);
      });
    });

    if (!scrapeResult?.elements?.length) {
      setStatus("No scannable elements found on this page", "error");
      setScanningState(false);
      return;
    }

    setStatus(`Found ${scrapeResult.elements.length} elements — analyzing with AI...`, "loading");

    // Step 4: Send to background for AI analysis
    const analyzeResult = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "ANALYZE", elements: scrapeResult.elements, tabId: tab.id, apiKey },
        (res) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(res);
        }
      );
    });

    if (!analyzeResult.ok) {
      throw new Error(analyzeResult.error || "Unknown API error");
    }

    // Step 5: Filter dark patterns
    const allResults = analyzeResult.results;
    const darkPatterns = allResults.filter(r => r.isDarkPattern);

    // Attach selector info from original elements
    darkPatterns.forEach(p => {
      const original = scrapeResult.elements[p.index];
      if (original) {
        p.selector = original.selector;
        p.text = original.text;
      }
    });

    // Step 6: Highlight on page
    if (darkPatterns.length > 0) {
      await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, {
          action: "HIGHLIGHT",
          results: darkPatterns.map(p => ({
            selector: p.selector,
            label: p.label || p.category,
            severity: p.severity
          }))
        }, resolve);
      });
    }

    // Step 7: Update UI
    hideStatus();
    setScanningState(false);
    clearBtn.style.display = "block";

    const highCount = darkPatterns.filter(p => p.severity === "high").length;
    const { cls, title, desc } = getScoreInfo(darkPatterns.length, highCount);

    scoreNum.textContent = darkPatterns.length;
    scoreCircle.className = `score-circle ${cls}`;
    scoreTitle.textContent = title;
    scoreDesc.textContent = desc;
    scoreSection.className = "score-section visible";

    if (darkPatterns.length === 0) {
      cleanMsg.className = "clean-msg visible";
    } else {
      renderResults(darkPatterns);
      resultsSection.className = "results-section visible";
    }

  } catch (err) {
    setStatus("Error: " + err.message, "error");
    setScanningState(false);
    console.error("[DPD]", err);
  }
});
