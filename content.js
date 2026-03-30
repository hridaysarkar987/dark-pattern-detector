// content.js - Runs on every page, extracts UI elements and injects highlights

(function () {
  // Avoid double injection
  if (window.__darkPatternDetectorInjected) return;
  window.__darkPatternDetectorInjected = true;

  // ─── Utility ────────────────────────────────────────────────────────────────

  function getVisibleText(el) {
    return (el.innerText || el.textContent || "").trim().slice(0, 300);
  }

  function getElementSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === "string") {
      return `${el.tagName.toLowerCase()}.${el.className.trim().split(/\s+/).join(".")}`;
    }
    return el.tagName.toLowerCase();
  }

  // ─── DOM Scraper ─────────────────────────────────────────────────────────────

  function scrapePageElements() {
    const candidates = [];

    // 1. Countdown timers
    document.querySelectorAll("[class*='timer'], [class*='countdown'], [id*='timer'], [id*='countdown']").forEach(el => {
      const text = getVisibleText(el);
      if (text) candidates.push({ type: "timer", text, selector: getElementSelector(el), el });
    });

    // 2. Stock / urgency text
    document.querySelectorAll("[class*='stock'], [class*='urgency'], [class*='scarcity'], [class*='limited']").forEach(el => {
      const text = getVisibleText(el);
      if (text) candidates.push({ type: "urgency", text, selector: getElementSelector(el), el });
    });

    // 3. Pre-checked checkboxes
    document.querySelectorAll("input[type='checkbox']").forEach(el => {
      if (el.checked) {
        const label = el.closest("label") || el.parentElement;
        const text = label ? getVisibleText(label) : "Pre-checked checkbox";
        candidates.push({ type: "pre-checked", text, selector: getElementSelector(el), el });
      }
    });

    // 4. Price / discount banners
    document.querySelectorAll("[class*='discount'], [class*='deal'], [class*='save'], [class*='off'], [class*='sale']").forEach(el => {
      const text = getVisibleText(el);
      if (text && text.length > 2) candidates.push({ type: "price", text, selector: getElementSelector(el), el });
    });

    // 5. Buttons with sneaky text
    document.querySelectorAll("button, [role='button'], a.btn, a.button").forEach(el => {
      const text = getVisibleText(el);
      if (text && text.length > 1) candidates.push({ type: "button", text, selector: getElementSelector(el), el });
    });

    // 6. Notification / cookie banners
    document.querySelectorAll("[class*='banner'], [class*='notify'], [class*='cookie'], [class*='gdpr'], [role='dialog']").forEach(el => {
      const text = getVisibleText(el);
      if (text && text.length > 10) candidates.push({ type: "banner", text: text.slice(0, 200), selector: getElementSelector(el), el });
    });

    // 7. Any text mentioning urgency-like words
    const allText = document.querySelectorAll("p, span, div, h1, h2, h3, h4, li");
    const urgencyWords = /only \d+ left|hurry|selling fast|limited time|expires|ends in|act now|don't miss|last chance|almost gone|order now|just \d+ left/i;
    allText.forEach(el => {
      const text = getVisibleText(el);
      if (urgencyWords.test(text) && text.length < 200) {
        candidates.push({ type: "urgency-text", text, selector: getElementSelector(el), el });
      }
    });

    // Deduplicate by text content
    const seen = new Set();
    return candidates.filter(c => {
      if (seen.has(c.text)) return false;
      seen.add(c.text);
      return true;
    }).slice(0, 30); // cap at 30 elements to stay within token limits
  }

  // ─── Highlight Injection ──────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById("dpd-styles")) return;
    const style = document.createElement("style");
    style.id = "dpd-styles";
    style.textContent = `
      .dpd-highlight {
        outline: 3px solid #ff3b3b !important;
        outline-offset: 2px !important;
        position: relative !important;
        z-index: 9998 !important;
        animation: dpd-pulse 2s infinite !important;
      }
      .dpd-highlight-warn {
        outline: 3px solid #ffaa00 !important;
        outline-offset: 2px !important;
        position: relative !important;
        z-index: 9998 !important;
        animation: dpd-pulse-warn 2s infinite !important;
      }
      @keyframes dpd-pulse {
        0%, 100% { outline-color: #ff3b3b; box-shadow: 0 0 0 0 rgba(255,59,59,0.4); }
        50% { outline-color: #ff6b6b; box-shadow: 0 0 0 6px rgba(255,59,59,0); }
      }
      @keyframes dpd-pulse-warn {
        0%, 100% { outline-color: #ffaa00; box-shadow: 0 0 0 0 rgba(255,170,0,0.4); }
        50% { outline-color: #ffc84d; box-shadow: 0 0 0 6px rgba(255,170,0,0); }
      }
      .dpd-badge {
        position: absolute !important;
        top: -10px !important;
        right: -10px !important;
        background: #ff3b3b !important;
        color: white !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        padding: 2px 6px !important;
        border-radius: 10px !important;
        z-index: 9999 !important;
        pointer-events: none !important;
        white-space: nowrap !important;
        font-family: monospace !important;
        letter-spacing: 0.5px !important;
      }
      .dpd-badge-warn {
        background: #ffaa00 !important;
        color: #1a1a1a !important;
      }
    `;
    document.head.appendChild(style);
  }

  function highlightElement(el, label, severity) {
    injectStyles();
    const cls = severity === "high" ? "dpd-highlight" : "dpd-highlight-warn";
    el.classList.add(cls);

    // Make sure parent is relative for badge positioning
    const computedPos = window.getComputedStyle(el).position;
    if (computedPos === "static") el.style.position = "relative";

    const badge = document.createElement("span");
    badge.className = severity === "high" ? "dpd-badge" : "dpd-badge dpd-badge-warn";
    badge.textContent = `⚠ ${label}`;
    el.appendChild(badge);
  }

  function clearHighlights() {
    document.querySelectorAll(".dpd-highlight, .dpd-highlight-warn").forEach(el => {
      el.classList.remove("dpd-highlight", "dpd-highlight-warn");
    });
    document.querySelectorAll(".dpd-badge").forEach(el => el.remove());
  }

  // ─── Message Listener ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "SCRAPE") {
      const elements = scrapePageElements();
      const payload = elements.map(({ type, text, selector }) => ({ type, text, selector }));
      sendResponse({ elements: payload, url: window.location.href, title: document.title });
    }

    if (msg.action === "HIGHLIGHT") {
      clearHighlights();
      injectStyles();

      const results = msg.results; // array of { selector, label, severity }
      results.forEach(({ selector, label, severity }) => {
        try {
          const el = document.querySelector(selector);
          if (el) highlightElement(el, label, severity);
        } catch (e) {
          // selector might be invalid, skip
        }
      });
      sendResponse({ ok: true });
    }

    if (msg.action === "CLEAR") {
      clearHighlights();
      sendResponse({ ok: true });
    }

    return true; // keep message channel open for async
  });
})();
