// Hobbies page — knight's tour animation.
// knightTour() (js/curves.js) computes the visiting order with Warnsdorff's
// rule; this controller builds the board, then traces the route move by move:
// the path strokes on segment-by-segment (every knight move has the same
// length, so dashoffset progress maps linearly onto move count) while a marker
// hops square to square and visited squares collect a dot.
//
// Fallbacks: reduced motion (or a failed GSAP CDN) shows the finished tour as
// a static drawing; without JS the whole stage is hidden (CSS) with a note.

import { knightTour, knightTourPath } from "./curves.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CELL = 64; // 8 × 64 = 512 viewBox
const SIZE = 8;

const gsap = window.gsap;
const svg = document.getElementById("board-svg");
const replayBtn = document.getElementById("tour-replay");
const status = document.getElementById("tour-status");

if (svg) boot();

function boot() {
  // board squares
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const sq = document.createElementNS(SVG_NS, "rect");
      sq.setAttribute("x", c * CELL);
      sq.setAttribute("y", r * CELL);
      sq.setAttribute("width", CELL);
      sq.setAttribute("height", CELL);
      sq.setAttribute("class", (r + c) % 2 === 0 ? "sq-light" : "sq-dark");
      svg.appendChild(sq);
    }
  }

  const tour = knightTour(SIZE, { startCol: 0, startRow: 7 }); // from the bottom-left corner
  if (!tour) {
    status.textContent = "No tour found from this square — which would be news to Warnsdorff.";
    return;
  }
  const center = ([c, r]) => [(c + 0.5) * CELL, (r + 0.5) * CELL];

  // trail dots (one per square, revealed as the knight passes through)
  const dots = tour.map((cell) => {
    const [x, y] = center(cell);
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", 5);
    dot.setAttribute("class", "visited-dot");
    svg.appendChild(dot);
    return dot;
  });

  // the route
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", knightTourPath(tour, { cell: CELL }));
  path.setAttribute("class", "tour-path");
  svg.appendChild(path);

  // the knight
  const [x0, y0] = center(tour[0]);
  const marker = document.createElementNS(SVG_NS, "circle");
  marker.setAttribute("cx", x0);
  marker.setAttribute("cy", y0);
  marker.setAttribute("r", 13);
  marker.setAttribute("class", "knight-marker");
  svg.appendChild(marker);

  const finished = () => {
    status.textContent = `Tour complete — ${tour.length} squares, ${tour.length - 1} moves, none repeated.`;
  };

  const animate = gsap && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  if (!animate) {
    // static fallback: the whole tour, already drawn
    dots.forEach((d) => d.classList.add("on"));
    const [xe, ye] = center(tour[tour.length - 1]);
    marker.setAttribute("cx", xe);
    marker.setAttribute("cy", ye);
    finished();
    if (replayBtn) replayBtn.hidden = true;
    return;
  }

  const len = path.getTotalLength();
  const seg = len / (tour.length - 1); // uniform: every knight move is √5·CELL
  const HOP = 0.22; // seconds per move

  const buildTimeline = () => {
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    gsap.set(dots, { autoAlpha: 0 });
    gsap.set(marker, { attr: { cx: x0, cy: y0 } });

    const tl = gsap.timeline({ onComplete: finished });
    tl.set(dots[0], { autoAlpha: 1 }, 0);
    for (let i = 1; i < tour.length; i++) {
      const [x, y] = center(tour[i]);
      const at = (i - 1) * HOP;
      tl.to(marker, { attr: { cx: x, cy: y }, duration: HOP, ease: "power1.inOut" }, at);
      tl.to(path, { strokeDashoffset: len - seg * i, duration: HOP, ease: "power1.inOut" }, at);
      tl.set(dots[i], { autoAlpha: 1 }, at + HOP * 0.6);
      tl.call(() => { status.textContent = `Move ${i} of ${tour.length - 1}`; }, [], at);
    }
    return tl;
  };

  let tl = buildTimeline();
  replayBtn?.addEventListener("click", () => {
    tl.kill();
    tl = buildTimeline();
  });
}
