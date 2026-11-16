# Arianit Xhafa — Portfolio

Personal portfolio built by hand with HTML, CSS and vanilla JavaScript, plus three.js for the 3D ID card. No build step — GitHub Pages serves the files as they are.

## Features
- Deep-space theme: a canvas starfield with twinkling stars, parallax and shooting stars
- A 3D ID card hanging from a lanyard (three.js + a small verlet simulation): drag it on desktop, tap it on a phone
- Floating glass navigation with a pill that follows the section in view
- Typing role line, count-up stats, scroll reveals
- Education timeline, certificates, tech stack and a Spotify playlist
- Project cards with live screenshots and links, contact form that opens the visitor's email app
- Fully responsive (320 px and up) and respects `prefers-reduced-motion`; a static card is shown without WebGL

## Files
- `index.html` — content
- `styles.css` — design
- `main.js` — starfield, navigation, reveals, typing, counters, contact form
- `lanyard.js` — the 3D ID card (ES module; three.js from jsDelivr via an import map)
- `cv.html` → `Arianit_Xhafa_CV.pdf` — the one-page CV

## Run locally
```bash
python -m http.server 5180
```
(Any static server works; opening `index.html` directly from disk won't load the ES modules.)

## Updating
- **Photo on the ID card:** add `assets/photo.webp` (portrait, about 600×800) and set `data-photo="assets/photo.webp"` on the `.lanyard` canvas in `index.html`.
- **Spotify:** replace the playlist ID in the `.music` iframe and link with your own playlist.
- **New project:** copy an `<article class="project card">` block in `#projects`, add a screenshot in `assets/`, update `cv.html`, regenerate the PDF, then commit and push — GitHub Pages redeploys in about a minute.

Live at **https://arianitxhafa.vercel.app**
