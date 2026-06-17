# Argonriel.github.io

Personal site — a **Mathematical Garden**. Scrolling drives a five-stage SVG narrative:
**seed → stem → flower → wither → fruit**, with free scroll that snaps to the nearest stage.

Built with [GSAP](https://gsap.com/) + ScrollTrigger (CDN, no build step).

## Architecture

| Path | Responsibility |
|------|----------------|
| `index.html` | Five semantic `<section>` scenes (real, no-JS-readable content) + one responsive inline `<svg>`. |
| `css/tokens.css` | Design tokens — the single source of truth for color (`#FAF9F5`, `#D97757`, …), type, spacing. |
| `css/` → `style.css` | Layout (pinned stage / scenes), components, reduced-motion + mobile + no-JS fallbacks. |
| `js/curves.js` | Pure curve math (no DOM/GSAP): `rosePath`, `superellipsePath`, `logSpiralPath`. |
| `js/garden.js` | Animation controller — `gsap.matchMedia`: desktop scrub+snap timeline, mobile fades, reduced static. |
| `CNAME` | Custom domain (`argonriel.com`). |

## Develop

No build needed — serve statically:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Honors `prefers-reduced-motion` (static fruit + all content) and simplifies to fade-ins on
small screens. With JavaScript disabled the five sections render as a normal readable document.
