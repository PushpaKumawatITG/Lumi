# Lumi ✨

Your AI companion — built with React, Node, and Groq's Llama models. Single-service deployment, no external database needed.

## Features

- 💬 Streaming chat responses (Server-Sent Events)
- 🖼️ Image upload + paste-from-clipboard support (vision model)
- 📄 Text/code file attachments (.py, .js, .md, etc.)
- 🎨 Three themes: Dark, Light, Sunset (gradient)
- 🔐 Email/password auth with bcrypt + sessions
- 💾 Multi-conversation history with date grouping
- ⚡ Markdown + syntax-highlighted code blocks

## Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS
- **Backend:** Node.js + Express + session auth
- **AI:** Groq API (Llama 3.3 70B for text, Llama 4 Scout for vision)
- **Storage:** JSON file (zero-setup, no DB needed for personal use)

## Run Locally

```bash
# 1. Install dependencies
npm run install:all

# 2. Add your Groq API key
echo "GROQ_API_KEY=your-key-here" > server/.env
echo "SESSION_SECRET=any-random-string" >> server/.env

# 3. Start the dev servers (in two terminals)
npm run dev:server     # backend on :5000
npm run dev:client     # frontend on :5173

# 4. Open http://localhost:5173
```

Get a free Groq key at https://console.groq.com/keys.

## Deploy to Render (Free)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/lumi.git
git push -u origin main
```

### Step 2 — Connect to Render

1. Go to https://render.com → sign up (use GitHub)
2. Click **New +** → **Blueprint**
3. Select your `lumi` repo
4. Render auto-detects `render.yaml` and configures everything

### Step 3 — Add your Groq API key

In the Render dashboard:
1. Go to your service → **Environment**
2. Find `GROQ_API_KEY` and paste your real key
3. Click **Save Changes** — Render auto-redeploys

### Step 4 — You're live!

Your app is at `https://lumi-xxxx.onrender.com` (Render gives you the exact URL).

### Notes about Render free tier

- ⏰ Service sleeps after 15 min of inactivity. First request takes ~30s to wake up.
- 💾 Free tier filesystem is ephemeral — `db.json` resets when the service restarts. Users will need to re-register if you redeploy or after long idle periods.
- 🚀 To get persistent storage, upgrade to a paid plan ($7/mo) for a persistent disk, or swap the JSON store for a hosted SQLite (e.g. Turso, free).

## Project Structure

```
lumi/
├── render.yaml              # Render auto-deployment config
├── package.json             # Root scripts
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # auth/, chat/, sidebar/
│   │   ├── context/         # AuthContext, ThemeContext
│   │   ├── api/             # API helpers
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── server/                  # Express backend
    ├── routes/              # auth, conversation, message
    ├── middleware/          # auth, errorHandler
    ├── db.js                # JSON file store
    └── index.js             # Express app + serves React build in prod
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | yes | Get from https://console.groq.com/keys |
| `SESSION_SECRET` | yes | Random string for cookie signing |
| `NODE_ENV` | (auto) | Set to `production` on Render |
| `PORT` | (auto) | Render sets this automatically |
| `CLIENT_URL` | dev only | Vite dev server URL (default `http://localhost:5173`) |

## License

MIT
