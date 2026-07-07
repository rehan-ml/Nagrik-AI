# 🇮🇳 Nagrik AI — Smart Bharat Civic Companion

> A single smart input box that understands what a citizen needs — a question, a service, a document checklist, or a complaint — and responds with structured, actionable, multilingual guidance.

Built for **Devengers PromptWars 2026** (Hack2skill × Google for Developers) — Problem Statement: *"Smart Bharat – AI-Powered Civic Companion."*

**🔗 Live Demo:** [Add your Render URL here]

---

## 📖 Problem Statement

Indian citizens routinely struggle with three things when dealing with government services:

1. **Not knowing which scheme or service applies to their situation** (Ayushman Bharat? PDS? PM Awas Yojana? RTI?)
2. **Not knowing what documents are required**, leading to repeated trips to offices
3. **Not having a simple channel to report civic issues** (garbage, potholes, water supply, etc.) and track them

Government portals exist for all of this — but they're fragmented, jargon-heavy, and assume the citizen already knows which department or scheme to look for. Nagrik AI removes that burden: the citizen just describes their situation in plain language (typed or spoken, in their own language), and the AI figures out the rest.

## ✨ Features

- **Single smart input, zero manual mode-picking** — one text/voice input box handles questions, service lookups, document checklists, and complaints. Gemini classifies intent automatically.
- **Structured, enforced JSON output** — uses Gemini's `response_json_schema` to guarantee a consistent, renderable response shape every time (no prompt-parsing guesswork).
- **Multilingual by design** — citizen picks Auto / English / Hindi / Tamil / Bengali / Marathi / Telugu; Gemini replies fully in that language, matching both input and output.
- **Voice input** — Web Speech API lets citizens speak instead of type (works in Chrome; Brave blocks this API by default, which is a browser limitation, not an app bug).
- **Read-aloud responses** — Web Speech Synthesis reads the explanation back to the citizen, useful for low-literacy or accessibility contexts.
- **Accessibility mode** — larger text + higher contrast toggle.
- **Live complaint tracker** — every complaint is logged in-memory with an ID, priority level (low/medium/high), and timestamp, and displayed in a running list on the page.
- **Glassmorphism / HUD-styled UI** — looping video background, responsive layout that simplifies down for mobile.

## 🧠 How It Works (Architecture)

```
Citizen input (text or voice)
        │
        ▼
Flask route: POST /process
        │
        ▼
Single Gemini API call
  • system_instruction → defines Nagrik AI's persona + rules
  • few-shot examples   → shows expected input/output pairs
  • response_json_schema → enforces structured output shape
        │
        ▼
Gemini classifies intent + generates response in one shot:
  intent ∈ {query, service_recommendation, document_help, complaint}
        │
        ▼
If intent == "complaint" → logged to in-memory tracker (id, priority, timestamp)
        │
        ▼
JSON response rendered client-side into the matching UI section
```

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| AI | Google Gemini API (`google-genai` SDK), model `gemini-3.1-flash-lite` |
| Structured output | `response_json_schema` (enforced JSON, no manual parsing) |
| Frontend | Single Jinja template, Tailwind CSS (CDN), vanilla JS — no framework/build step |
| Voice | Web Speech API (recognition) + Web Speech Synthesis API (read-aloud) |
| Storage | In-memory (no database — per hackathon constraint) |
| Deployment | Docker + Render.com |

## 📁 Project Structure

```
project-root/
├── app.py                 # Flask app — routes, Gemini call, schema, in-memory complaint store
├── requirements.txt
├── Dockerfile
├── .env.example            # Template for required env vars (no real key)
├── .gitignore
├── .dockerignore
├── templates/
│   └── index.html          # Frontend markup
└── static/
    └── res/
        ├── style.css        # All UI styling (glassmorphism, HUD corners, animations)
        ├── main.js          # Voice input, read-aloud, form handling, result rendering
        ├── bg.png            # Poster/fallback image
        └── veo3bgvid.mp4    # Background video
```

## ⚙️ Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key (new format starts with `AQ.`) |
| `GEMINI_MODEL` | Model name — defaults to `gemini-3.1-flash-lite` if unset |
| `PORT` | Set automatically by Render — no manual configuration needed |

## 🚀 Running Locally

```bash
# Clone the repo
git clone https://https://github.com/rehan-ml/Nagrik-AI
cd YOUR_REPO

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# then edit .env and add your real GEMINI_API_KEY

# Run
python app.py
```
Visit `http://localhost:8080`.

## ☁️ Deployment

Deployed on **Render.com** as a Docker web service:
1. Repo connected directly from GitHub
2. Render builds from the included `Dockerfile`
3. `GEMINI_API_KEY` and `GEMINI_MODEL` set as environment variables in the Render dashboard (never committed to the repo)
4. Gunicorn serves the app in production: `gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 120 app:app`

## ⚠️ Known Limitations (Hackathon Scope)

- No database — complaint tracker resets on server restart (by design, per hackathon rules)
- No authentication (by design, per hackathon rules)
- Voice input requires a browser that supports the Web Speech API (Chrome supported; Brave blocks it by default)
- Free-tier Render hosting spins down after inactivity — first request after idle may take 30–50 seconds to respond

## 👤 Author

[Rehan Raza]

---

*Built in a 4-hour hackathon sprint for Devengers PromptWars 2026.*
