# Bible-Ai.project
✝️

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Gemini Powered](https://img.shields.io/badge/Powered%20by-Gemini-4285F4.svg)](https://ai.google.dev)

A full-stack web application that provides AI-generated summaries and citations for Bible chapters.


## Features ✨

- 📖 Select any book and chapter from the Bible (grouped by Old/New Testament)
- 🤖 AI-powered chapter summaries (Gemini 1.5 Flash)
- 🌐 Optional Urdu translation of summaries
- 📱 Responsive design for all devices

## Tech Stack 🛠️

**Frontend:**
- HTML5, CSS3, JavaScript (using native `fetch` API)

**Backend:**
- Node.js
- Express.js
- Google Gemini API (via REST)

## Project Structure 📂

```
.
├─ client/
│  └─ public/           # Static SPA assets (index.html, script.js, style.css)
├─ server/
│  └─ index.js          # Express app (also exported for Vercel serverless)
├─ vercel.json          # Vercel builds + routes
├─ package.json         # Root scripts and deps (Node 18)
└─ README.md
```

## Setup Instructions 🚀

### Prerequisites
- Node.js (v18+)
- Google AI Studio API key (Gemini) — create one at https://aistudio.google.com/app/apikey
- Git

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/artasyaskar/Project.Bible-Ai
   cd Project.Bible-Ai
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables. Create `server/.env` (not committed):
   ```env
   GEMINI_API_KEY=your_api_key_here
   NODE_ENV=development
   # Optional: skip Urdu translation to save quota
   # DISABLE_URDU_TRANSLATIONS=true
   ```
4. Start the server locally:
   ```bash
   npm start
   ```
   - Server: http://localhost:3000
   - Frontend is served from `client/public/`

### Vercel Deployment
- `vercel.json` configures:
  - Node serverless function from `server/index.js` for `/api/*`
  - Static assets from `client/public/`
  - SPA fallback to `client/public/index.html`
- In Vercel Project → Settings → Environment Variables, add:
  - `GEMINI_API_KEY` = your API key
  - `DISABLE_URDU_TRANSLATIONS` = `true` (optional)
- Ensure Node.js version is 18 (Project → Settings → General) or keep default.
- Deploy via dashboard or CLI (`vercel && vercel --prod`).


## Notes
- The project uses Gemini 1.5 Flash via REST; no OpenAI dependencies.
- Built-in rate limiting: 100 requests per 15 minutes per IP (Express Rate Limit). HTTP 429 indicates throttling.
- Do not commit `server/.env`. Keep your `GEMINI_API_KEY` secret.

## License

MIT License. See `LICENSE`.
