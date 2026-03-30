# 🕵️ Dark Pattern Detector — Chrome Extension

An AI-powered Chrome extension that scans e-commerce pages and highlights manipulative UI dark patterns in real time.

---

## 🚀 Installation (Developer Mode)

1. **Download & unzip** this folder somewhere on your computer

2. Open Chrome and go to:
   ```
   chrome://extensions/
   ```

3. Toggle **"Developer mode"** ON (top-right corner)

4. Click **"Load unpacked"**

5. Select the `dark-pattern-detector` folder

6. The extension icon will appear in your Chrome toolbar 🎉

---

## 🔑 Setup

1. Click the extension icon in your toolbar
2. Enter your **Anthropic API key** (`sk-ant-...`)
   - Get one at: https://console.anthropic.com
3. Click **Save**

---

## 🔍 How to Use

1. Navigate to any e-commerce page (Amazon, Flipkart, Meesho, etc.)
2. Click the extension icon
3. Click **"Scan This Page"**
4. Wait ~5–10 seconds for AI analysis
5. Dark patterns get highlighted directly on the page with red/orange outlines
6. The popup shows a **manipulation score** and list of detected patterns
7. Click **"Clear Highlights"** to remove all highlights

---

## 🧠 What It Detects

| Pattern | Example |
|---|---|
| **Fake Urgency** | "Only 2 left!", fake countdown timers |
| **Hidden Costs** | Fees appearing only at checkout |
| **Trick Questions** | Pre-checked newsletter/subscription boxes |
| **Confirm Shaming** | "No thanks, I hate saving money" |
| **Misdirection** | Flashy banners hiding important info |
| **Social Proof Manipulation** | Inflated review counts, fake popularity |
| **Bait & Switch** | Advertised deal swapped for worse one |

---

## 📁 Project Structure

```
dark-pattern-detector/
├── manifest.json          # Chrome Extension config (Manifest V3)
├── popup.html             # Extension popup UI
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── content.js         # DOM scraper + highlight injector (runs on page)
    ├── background.js      # Service worker — calls Claude API
    └── popup.js           # Popup UI logic
```

---

## 🛠 How It Works (Technical)

1. **content.js** runs on every page — when triggered, it walks the DOM looking for timers, urgency text, pre-checked boxes, discount banners, and suspicious buttons
2. **popup.js** sends scraped elements to **background.js**
3. **background.js** calls `claude-sonnet` with a structured prompt asking it to classify each element as a dark pattern or not, with category + severity
4. Results are sent back to **content.js** which injects CSS highlights + labels onto matching elements

---

## ⚠️ Notes

- Your API key is stored locally in Chrome's storage — never sent anywhere except directly to Anthropic's API
- Works best on e-commerce and subscription pages
- AI analysis uses `claude-sonnet-4-20250514` for best accuracy
