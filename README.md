# Arianit Xhafa — Portfolio

Personal portfolio built by hand with HTML, CSS and vanilla JavaScript, animated with GSAP + ScrollTrigger and Lenis smooth scrolling.

## Features
- Preloader with counter and curtain reveal
- Interactive dot-field hero that reacts to the cursor
- Letter-by-letter name reveal and rotating role line
- Scroll-velocity marquee of the tech stack
- Word-by-word highlighted about statement and typing terminal
- Stacked, sticky project cards with 3D tilt and CSS-built mockups
- Custom cursor, magnetic buttons, dark & light themes
- Fully responsive and respects `prefers-reduced-motion`

## Run locally
```bash
npx http-server . -p 5173
```

## Deploy (GitHub Pages)
1. Create a public repository named `Arianitxhafa.github.io`.
2. Push the contents of this folder to the `main` branch.
3. The site goes live at `https://arianitxhafa.github.io`.

Live at **https://arianitxhafa.github.io**

## Updating
Add a new `<article class="project">` card inside `.stack` in `index.html`, update `cv.html`, regenerate `Arianit_Xhafa_CV.pdf`, then commit and push — GitHub Pages redeploys in about a minute.
