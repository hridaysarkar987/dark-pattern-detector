// background.js - Service worker: calls Gemini API (FREE)

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Extract JSON array from messy AI response ───────────────────────────────

function extractJSON(text) {
  // Try parsing directly first
  try { return JSON.parse(text.trim()); } catch (_) {}

  // Strip markdown code fences
  const stripped = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(stripped); } catch (_) {}

  // Find first [ ... ] block
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch (_) {}
  }

  // Nothing worked — return empty
  return [];
}

// ─── Dark Pattern Classification ────────────────────────────────────────────

async function classifyDarkPatterns(elements, apiKey) {
  const elementList = elements
    .map((e, i) => `[${i}] type=${e.type} | text="${e.text}"`)
    .join("\n");

  const prompt = `You are a dark pattern expert. Analyze these UI elements from a webpage.

Elements to analyze:
${elementList}

Return a JSON array. Each object must have exactly these fields:
- "index": the number from brackets above
- "isDarkPattern": true or false
- "category": one of FAKE_URGENCY, HIDDEN_COSTS, TRICK_QUESTION, CONFIRM_SHAMING, MISDIRECTION, SOCIAL_PROOF_MANIPULATION, ROACH_MOTEL, BAIT_AND_SWITCH, or null
- "label": a short 2-4 word label, or null
- "severity": "high" or "medium" if isDarkPattern is true, otherwise null
- "explanation": one short sentence, or null

Rules:
- Only flag CLEARLY manipulative elements
- Return ONLY the JSON array, nothing else
- Do NOT include markdown, backticks, or explanation outside the array`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  return extractJSON(rawText);
}

// ─── Message Handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "ANALYZE") {
    const { elements, apiKey } = msg;
    classifyDarkPatterns(elements, apiKey)
      .then(results => sendResponse({ ok: true, results }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async
  }
});
