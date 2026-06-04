# PDF to Audiobook — Web App

Turn a PDF into an M4B audiobook with **your own ElevenLabs API key**. Upload a PDF,
review the auto-detected chapters, then generate — with live progress and a download
when it's done.

## Architecture (serverless-friendly / Vercel-ready)

Everything heavy runs **in the browser**, so the app deploys to Vercel (or any host) with
no binaries, no database, and no persistent disk:

- **PDF text extraction** — [`unpdf`](https://github.com/unjs/unpdf) (pure-JS PDF.js) runs
  client-side. The PDF never leaves the browser.
- **Chapter detection** — the original clean + split logic, reused on the client.
- **Voice generation** — the browser calls a tiny stateless API route **`/api/tts`** once
  per text chunk (BYO key, used per-request, never stored). Looping short requests sidesteps
  serverless time limits.
- **M4B assembly** — [`ffmpeg.wasm`](https://ffmpegwasm.netlify.app/) (single-threaded core,
  no COOP/COEP headers needed) muxes the MP3 chunks into an M4B with chapter markers, entirely
  in the browser, then triggers the download.
- **History** — recent projects (text + chapters, not audio) are saved in `localStorage`.

The only server code is `app/api/tts/route.ts`. No `pdftotext`, no `ffmpeg` binary, no storage.

## Local development

```bash
cd web
npm install
npm run dev      # http://localhost:5177
```

Build / run production:

```bash
npm run build
npm run start    # http://localhost:5177
```

## Deploy to Vercel

Set the project **root directory** to `web/` and deploy — no extra services or env vars
required. (`/api/tts` `maxDuration` is 60s, within the Hobby limit.) Users bring their own
ElevenLabs key in the UI.

## How a finished audiobook is downloaded

When generation completes, the live progress card flips to an **"Audiobook ready"** state with
a **Download M4B** button, and the file downloads automatically. The M4B is built in your
browser; nothing is uploaded or stored on the server.

## Notes & limits

- **BYO key:** your ElevenLabs key is sent only with each `/api/tts` request and never stored.
- **Browser-bound work:** very long books mean a long browser session and significant memory
  for in-browser AAC encoding. Keep the tab open during generation.
- **No resume:** closing the tab mid-generation loses progress (audio isn't persisted; the
  text/chapters are kept in `localStorage`).
- Voice chunks are generated sequentially with a live progress bar + ETA.
