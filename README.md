# Fitcheck

A clothing size recommendation app that compares body measurements with brand size charts and displays an estimated fit score.

## Run locally

Requires Node.js 22 or newer. No API key or npm dependencies are required by the server.

```sh
npm start
```

Open http://localhost:3000. On Windows PowerShell, use `npm.cmd start` if script execution is disabled. To use port 3001:

```powershell
$env:PORT="3001"
npm.cmd start
```

## Features

- Body measurements saved in browser local storage.
- Tops/bottoms and gender filters, with close, regular and relaxed fit preferences.
- Product link import for accessible HTML size tables.
- Size chart photo recognition with image enhancement, positional row reconstruction and targeted number rereading.
- Automatic inches/centimetres detection, with a unit choice when uncertain.
- Remove uploaded photos and see the fit score before detailed results.

## Tests

```sh
npm test
```

## Architecture

- `server.mjs`: local HTTP server and import, parse and comparison endpoints.
- `extract.mjs`: product metadata and chart parsing.
- `fit.mjs`: rule-based fit scoring.
- `public/`: browser interface and photo recognition.
- `test/`: scoring, parsing, OCR reconstruction and server regression checks.

## Limitations and privacy

The score is a heuristic, not a probability or a guarantee of fit. OCR can misread poor images. Missing measurements, fabric stretch and garment cuts affect accuracy. This app does not train a machine-learning model from uploads.

Photo recognition runs in the browser using Tesseract.js loaded from a CDN; internet access is needed for the reader and language assets. Chart parsing and fit comparison run in the browser using the same modules as the server, so they do not require API requests. Product links still require the Node server; retailer imports can fail for blocked or JavaScript-only pages. The visible chart editor provides a manual fallback when a photo or product cannot be read.

The server binds to loopback. This is a local application, not a production multi-user service. GitHub Pages alone cannot run the Node API.

## Interface

The fitting studio uses warm ivory, ink and acid-lime accents, an open measurement sheet, and a lightweight SVG/CSS garment with rotation controls and measurement guides. Keyboard focus and reduced-motion preferences are supported. The garment is illustrative; it does not simulate cloth or body shape.

## Font attribution

The current interface references system fonts (Impact, Arial and Courier New) with fallbacks; it does not download or redistribute them. The retained Scota font is an unused demo by Limitype. See `public/fonts/Scota-Readme.txt`. A commercial license is not included; check the vendor terms before commercial use.


