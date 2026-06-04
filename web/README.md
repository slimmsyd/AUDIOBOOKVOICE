# PDF to Audiobook — Web App

Next.js (App Router) port of the PDF → M4B audiobook tool. Upload a PDF, review the
auto-detected chapters, then generate an audiobook with **your own ElevenLabs API key**.
Generation streams live progress (Server-Sent Events) and ends with a download button.

## Requirements (important)

This app shells out to system binaries and writes files to disk. The machine running it
**must** have:

- **`pdftotext`** (from Poppler) — PDF text extraction
- **`ffmpeg`** + **`ffprobe`** — audio assembly into M4B with chapter markers
- A **writable, persistent disk** — projects/audio are stored under `web/data/`

`/api/health` reports whether `pdftotext` and `ffmpeg` are found on `PATH`.

macOS: `brew install poppler ffmpeg` · Debian/Ubuntu: `apt-get install poppler-utils ffmpeg`

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

## Deployment

> **⚠️ Vercel (and other pure-serverless hosts) will not run this app's core.**
> Vercel serverless functions do **not** include the `pdftotext`/`ffmpeg` binaries, have an
> **ephemeral, read-only filesystem** (no persistent `data/`), and cap function duration at
> **300s on Hobby** — too short for long books. The site will build and the UI will load, but
> **PDF import and audiobook generation will fail at runtime.**

Deploy to a host that runs a **long-lived Node server with system packages and a persistent
disk**, for example:

- **Docker** on any VPS (install `poppler-utils` + `ffmpeg` in the image) — recommended
- **Render** / **Railway** / **Fly.io** (Docker or a build step that installs the binaries)
- A plain VPS running `npm run build && npm run start` behind a reverse proxy

A persistent volume should back `web/data/` so projects and exports survive restarts. Override
the data location with the `AUDIOBOOK_DATA_DIR` env var if needed.

### Minimal Dockerfile sketch

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y poppler-utils ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build
EXPOSE 5177
CMD ["npm", "run", "start"]
```

## How a finished audiobook is downloaded

When generation completes, the live progress card flips to a **"Audiobook ready"** state with a
**Download M4B** button (the generation panel also shows a download link). It hits
`GET /api/projects/:id/download`, which streams the `.m4b` as a file attachment.

## Notes

- **BYO key:** your ElevenLabs key is sent only with the generate request and is never stored on disk.
- **Resumable:** generated voice chunks are cached on disk, so re-running a generation skips work already done.
- Generation is one long streaming request (progress via SSE); there is no background queue in this version.
