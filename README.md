# Director AI V1

A one-day MVP for converting a **public YouTube video up to 2 minutes** into a
director-level prompt package.

## Included

- Luxury dark cinematic frontend
- Public YouTube URL input
- Gemini multimodal video + audio analysis
- Scene timestamps
- Visual prompt
- Camera/lens prompt
- Lighting/color prompt
- Sound design
- Voice-over direction
- Scene recreation prompt
- Master director prompt
- Copy + TXT download
- Left/right/mid/bottom sponsored placements
- 5 Smartlinks supplied for the project
- One rotating Smartlink opens when a **new URL** is analyzed

## Why YouTube-only in V1

The current Gemini Video Understanding API accepts public YouTube URLs directly.
That removes video downloading, FFmpeg and temporary storage from the first MVP.
Private and unlisted videos are not supported by the YouTube-URL method.

## 1. Gemini key

Create a Gemini API key in Google AI Studio.

Copy:

```bash
cp backend/.env.example backend/.env
```

Set:

```env
GEMINI_API_KEY=...
```

Never put the Gemini key in `frontend/config.js`.

## 2. Run backend locally for testing

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY="YOUR_KEY"
uvicorn main:app --reload --port 8000
```

Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:GEMINI_API_KEY="YOUR_KEY"
uvicorn main:app --reload --port 8000
```

## 3. Run frontend

Serve `frontend/` using any static web server.

Example:

```bash
python -m http.server 5500 --directory frontend
```

Open `http://localhost:5500`.

## 4. Deploy backend to Render

Use `render.yaml`, or create a Python Web Service:

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL=gemini-3.6-flash`
  - `ALLOWED_ORIGINS=https://YOUR-SITE.netlify.app`

After deployment, copy the backend URL.

## 5. Deploy frontend to Netlify

Before deploying, edit:

`frontend/config.js`

Change:

```js
apiBaseUrl: "http://localhost:8000"
```

to your deployed backend URL, for example:

```js
apiBaseUrl: "https://director-ai-api.example.com"
```

Deploy the `frontend` directory.

## Ads / Smartlinks

The five supplied Smartlinks are in `frontend/config.js`.

Current behavior:

- Left sponsored tile rotates through Smartlinks
- Right sponsored tile rotates through Smartlinks
- Mid sponsored tile rotates through Smartlinks
- Bottom sponsored tile rotates through Smartlinks
- A single rotating Smartlink opens in a new tab when the user analyzes a **new URL**
- Re-clicking Analyze on the same URL does not open another sponsored tab

This avoids firing multiple automatic popups from one user action. Replace these
tiles later with proper banner/native ad-unit scripts when the ad network provides them.

Always follow the ad network's current placement and traffic-quality rules.

## Gemini notes

`GEMINI_MODEL` is configurable so the model can be changed without editing code.

The default is:

```env
GEMINI_MODEL=gemini-3.6-flash
```

Gemini's YouTube URL input is a preview capability and Google may change its
availability or limits.

## Production hardening

Before public launch, add:

- rate limiting
- abuse protection / CAPTCHA
- request logging without storing private user content
- server-side quota controls
- ad-network policy review
- privacy + terms pages
