// Projects page — L-system tree controller.
// Grows the tree from lSystemPath() (js/curves.js), then hangs one node button
// on a well-separated branch tip per project card in #project-list. Hover/click
// on a node opens a glass popover with that project's card content.
//
// The tree is a decorative duplicate of the list below (which stays the
// canonical, accessible content): the stage is aria-hidden and its buttons are
// removed from the tab order. Mobile hides the stage via CSS; reduced motion
// renders the fully-drawn tree with no grow animation.

import { lSystemPath } from "./curves.js";

const gsap = window.gsap;
const stage = document.getElementById("tree-stage");
const svg = document.getElementById("tree-svg");
const treePath = document.getElementById("tree-path");
const popover = document.getElementById("tree-popover");
const projects = [...document.querySelectorAll("#project-list [data-project]")];

if (stage && projects.length) boot();

function boot() {
  const { d, tips } = lSystemPath(4, { angle: 27 });
  treePath.setAttribute("d", d);

  // Crop the viewBox to the tree with a little air, and give the stage box the
  // matching aspect ratio so %-positioned nodes line up exactly with the SVG.
  const xs = tips.map((t) => t.x);
  const ys = tips.map((t) => t.y);
  const PAD = 36;
  const vb = {
    x: Math.min(...xs) - PAD,
    y: Math.min(...ys) - PAD,
    w: Math.max(...xs) - Math.min(...xs) + PAD * 2,
    h: 745 - Math.min(...ys) + PAD * 2, // down to the root at y=745
  };
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  stage.style.aspectRatio = `${vb.w} / ${vb.h}`;

  // One node per project, on tips spread far apart across the upper crown.
  const spots = pickSpread(tips, projects.length);
  const nodes = spots.map((tip, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tree-node cursor-target";
    btn.tabIndex = -1; // keyboard users read the canonical list instead
    btn.style.left = (((tip.x - vb.x) / vb.w) * 100).toFixed(2) + "%";
    btn.style.top = (((tip.y - vb.y) / vb.h) * 100).toFixed(2) + "%";
    btn.addEventListener("mouseenter", () => showPopover(i, btn));
    btn.addEventListener("click", () => showPopover(i, btn));
    btn.addEventListener("mouseleave", scheduleHide);
    stage.appendChild(btn);
    return btn;
  });

  popover.addEventListener("mouseenter", cancelHide);
  popover.addEventListener("mouseleave", scheduleHide);

  // Grow animation (skip under reduced motion or if the CDN failed).
  const animate = gsap && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  if (animate) {
    const len = treePath.getTotalLength();
    gsap.set(treePath, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(treePath, { strokeDashoffset: 0, duration: 2.6, ease: "power1.inOut" });
    gsap.from(nodes, { autoAlpha: 0, scale: 0.4, duration: 0.5, stagger: 0.12, delay: 2.2 });
  }

  let hideTimer = null;

  function showPopover(i, btn) {
    cancelHide();
    const src = projects[i];
    popover.innerHTML = src.innerHTML; // titles/badges/copy come from the real list
    popover.hidden = false;

    // Place beside the node, clamped inside the stage.
    const sr = stage.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const px = br.left - sr.left + br.width / 2;
    const py = br.top - sr.top + br.height / 2;
    const onLeft = px > sr.width / 2;
    popover.style.left = Math.max(0, Math.min(sr.width - popover.offsetWidth, onLeft ? px - popover.offsetWidth - 18 : px + 18)) + "px";
    popover.style.top = Math.max(0, Math.min(sr.height - popover.offsetHeight, py - popover.offsetHeight / 2)) + "px";
    if (gsap) gsap.fromTo(popover, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.25 });
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(() => {
      popover.hidden = true;
    }, 200);
  }

  function cancelHide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
  }
}

// Greedy max-min selection over the upper crown: start from the topmost tip,
// then repeatedly take the candidate farthest from everything chosen so far.
function pickSpread(tips, n) {
  const ys = tips.map((t) => t.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const cands = tips.filter((t) => t.y < yMin + (yMax - yMin) * 0.55);
  const picked = [cands.reduce((a, b) => (a.y < b.y ? a : b))];
  while (picked.length < Math.min(n, cands.length)) {
    let best = null;
    let bestD = -1;
    for (const c of cands) {
      const dist = Math.min(...picked.map((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2));
      if (dist > bestD) {
        bestD = dist;
        best = c;
      }
    }
    picked.push(best);
  }
  return picked;
}
