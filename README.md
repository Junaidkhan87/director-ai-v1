# Director AI V2

Updated version matching the current flat GitHub repository structure.

## Changes

- Left desktop ad: 300x250
- Right desktop ad: 300x250
- Mid ad: Native 4:1
- Bottom ad: 320x50
- Popunder integrated
- Social Bar integrated
- Per-field Copy buttons removed
- One Copy Scene button per timeframe
- Copy All + TXT download retained
- Output sequence per timeframe:
  1. Detailed Image Prompt
  2. Detailed Visual Direction
  3. Camera & Lens
  4. Lighting & Color
  5. Sound Design
  6. Voice Over / Dialogue
  7. Scene Recreation Prompt
- Gemini prompt upgraded for substantially more detailed scene recreation

## Current backend URL

`config.js` is already configured for:

`https://director-ai-api-production.up.railway.app`

## Updating the live site

Replace the existing root files in the GitHub repository with these files and commit.

Because Railway and Netlify are connected to the GitHub repository, both should
redeploy automatically.

Check Railway first because `main.py` changed. Then check Netlify.

## Environment variables on Railway

Keep:

```env
GEMINI_API_KEY=YOUR_SECRET_KEY
GEMINI_MODEL=gemini-3.6-flash
ALLOWED_ORIGINS=*
```

## Ad note

The supplied "350x50" code declares `width: 320`, so the actual integrated unit
is 320x50.

The 300x250 units are isolated inside iframes so the ad network's global
`atOptions` variable does not collide between left and right placements.

Ad delivery is ultimately controlled by the ad network, browser privacy
settings, extensions/ad blockers, geography, inventory and account approval.
