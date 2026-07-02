# xDisputer DOCX Converter Service

This service gives the Vercel app a real LibreOffice DOCX-to-PDF engine.

## Why this exists

Vercel runs the Next.js website, but normal Vercel functions do not include the system `soffice`/LibreOffice binary. This service runs in a Docker host that installs LibreOffice and exposes one endpoint:

```txt
POST /convert
```

The Vercel app calls this endpoint when `DOCX_CONVERTER_URL` is configured.

## Render/Railway/Fly/Cloud Run setup

Create a new Docker web service from this repository and use this directory as the root:

```txt
services/docx-converter
```

Use Dockerfile deployment.

## Environment variables

Optional but recommended:

```env
CONVERTER_TOKEN=make-a-long-random-secret
CONVERTER_TIMEOUT_MS=60000
MAX_UPLOAD_BYTES=26214400
```

## Health check

```txt
/health
```

Expected response:

```json
{"ok":true,"service":"xdisputer-docx-converter","engine":"libreoffice"}
```

## Connect Vercel to this service

In the Vercel project environment variables, add:

```env
DOCX_CONVERTER_URL=https://YOUR-CONVERTER-SERVICE/convert
DOCX_CONVERTER_TOKEN=make-a-long-random-secret
```

Then redeploy the Vercel production app.

## Expected Vercel conversion response

When the converter is used successfully, `/api/convert/docx-to-pdf` on the Vercel app returns:

```txt
X-Conversion-Engine: external-libreoffice:libreoffice-service:...
```
