# 🍣 NAMI 波 — Sushi Bar Website

A modern demo website for a fictional sushi bar in Baku. Every dish on the page is an interactive 3D model, with no photos at all.

**[Live demo →](https://boss-ui24.github.io/SUSHI/)**

## Features

- **3D hero:** drag the salmon nigiri to spin it
- **Roll anatomy:** scroll to take a Philadelphia roll apart, layer by layer
- **Interactive menu:** 12 dishes with live 3D models, category filters and animated transitions
- **Kaiten conveyor:** tap a plate on the moving belt to add it to your order
- **Roll builder:** pick the coating and fillings, watch the roll change and see the price update
- **Shopping cart:** quantities, a free delivery progress bar and a saved order
- **Three languages:** Azerbaijani, Russian and English
- **Responsive design:** built for both desktop and phones

## Built with

- [Three.js](https://threejs.org/) — 3D scenes, all models generated in code
- [GSAP](https://gsap.com/) — ScrollTrigger, SplitText, Flip, DrawSVG, MotionPath, ScrambleText
- [Lenis](https://lenis.darkroom.engineering/) — smooth scrolling
- [Swiper](https://swiperjs.com/) — reviews carousel
- [Vanilla-Tilt](https://micku7zu.github.io/vanilla-tilt.js/) — card tilt
- [canvas-confetti](https://github.com/catdad/canvas-confetti) — sesame confetti
- Plain HTML, CSS and JavaScript, no build step

## Run locally

```bash
git clone https://github.com/boss-ui24/SUSHI.git
cd SUSHI
python3 -m http.server 8000
```

Then open http://localhost:8000. You can also just double-click `index.html`. An internet connection is required because the libraries load from a CDN.

## Project structure

```text
├── index.html       page markup
├── css/style.css    styles
└── js/
    ├── app.js       interface, animations, cart, roll builder
    ├── scene.js     3D scenes
    ├── models.js    procedural sushi models
    ├── data.js      menu, prices, builder options
    └── i18n.js      translations
```

---

This is a demo project: the restaurant, prices and reviews are fictional.
