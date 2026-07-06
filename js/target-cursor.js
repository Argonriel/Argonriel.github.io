// Target cursor — vanilla JS + GSAP port of the React "TargetCursor" component.
// A small dot with four corner brackets follows the pointer; brackets idle in a
// slow spin, and snap to the bounding box of whatever `.cursor-target` element
// the pointer is over (nav Λ, nav links, CTAs, project nodes…).
//
// PORTING NOTE (kept from the original author's bugfix): a `position: fixed`
// element is NOT positioned against the viewport when any ancestor creates a
// containing block (transform / perspective / filter / backdrop-filter /
// will-change: transform / contain: paint). getContainingBlock() +
// getContainingBlockOffset() compensate for that, so the cursor stays glued to
// the pointer even if body ever gains such a style. Do not remove them.
//
// Desktop only: initializes solely for fine pointers with no reduced-motion
// preference; everywhere else the native cursor is left untouched.

const gsap = window.gsap;

const FINE_POINTER = window.matchMedia("(pointer: fine)").matches;
const MOTION_OK = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

if (gsap && FINE_POINTER && MOTION_OK) init();

function getContainingBlock(el) {
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    if (
      cs.transform !== "none" ||
      cs.perspective !== "none" ||
      cs.filter !== "none" ||
      (cs.backdropFilter && cs.backdropFilter !== "none") ||
      (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== "none") ||
      cs.willChange.includes("transform") ||
      cs.willChange.includes("perspective") ||
      (cs.contain && /paint|layout|strict|content/.test(cs.contain))
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function getContainingBlockOffset(el) {
  const cb = getContainingBlock(el);
  if (!cb) return { x: 0, y: 0 };
  const rect = cb.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

function init() {
  const TARGET_SELECTOR = ".cursor-target";
  const SPIN_DURATION = 2; // seconds per idle revolution
  const CORNER_SIZE = 12; // must match .target-cursor-corner in site.css
  const BORDER_WIDTH = 3;
  const PARALLAX = 0.06; // subtle bracket drift while roaming inside a target

  const wrapper = document.createElement("div");
  wrapper.className = "target-cursor-wrapper";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML =
    '<div class="target-cursor-dot"></div>' +
    '<div class="target-cursor-corner corner-tl"></div>' +
    '<div class="target-cursor-corner corner-tr"></div>' +
    '<div class="target-cursor-corner corner-br"></div>' +
    '<div class="target-cursor-corner corner-bl"></div>';
  document.body.appendChild(wrapper);
  document.body.classList.add("cursor-none");

  const dot = wrapper.querySelector(".target-cursor-dot");
  const corners = [
    wrapper.querySelector(".corner-tl"),
    wrapper.querySelector(".corner-tr"),
    wrapper.querySelector(".corner-br"),
    wrapper.querySelector(".corner-bl"),
  ];

  // Idle bracket layout: a small box centered on the dot.
  const HOME = [
    { x: -CORNER_SIZE * 1.5, y: -CORNER_SIZE * 1.5 },
    { x: CORNER_SIZE * 0.5, y: -CORNER_SIZE * 1.5 },
    { x: CORNER_SIZE * 0.5, y: CORNER_SIZE * 0.5 },
    { x: -CORNER_SIZE * 1.5, y: CORNER_SIZE * 0.5 },
  ];
  corners.forEach((c, i) => gsap.set(c, { x: HOME[i].x, y: HOME[i].y }));

  gsap.set(wrapper, { x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const spin = gsap
    .timeline({ repeat: -1 })
    .to(wrapper, { rotation: "+=360", duration: SPIN_DURATION, ease: "none" });

  let activeTarget = null;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let rafId = null;

  const moveCursor = (x, y) => {
    const off = getContainingBlockOffset(wrapper); // fixed-position compensation
    gsap.to(wrapper, { x: x - off.x, y: y - off.y, duration: 0.1, ease: "power3.out" });
  };

  // Snap the four brackets to the target's bounding box (viewport coords are
  // used on BOTH sides of the subtraction, so any containing-block shift of the
  // wrapper cancels out here — only moveCursor needs the explicit offset).
  const updateCorners = (target) => {
    const rect = target.getBoundingClientRect();
    const wr = wrapper.getBoundingClientRect();
    const cx = wr.left;
    const cy = wr.top;
    const px = gsap.utils.clamp(-10, 10, (mouseX - (rect.left + rect.width / 2)) * PARALLAX);
    const py = gsap.utils.clamp(-10, 10, (mouseY - (rect.top + rect.height / 2)) * PARALLAX);

    const pos = [
      { x: rect.left - cx - BORDER_WIDTH, y: rect.top - cy - BORDER_WIDTH },
      { x: rect.right - cx + BORDER_WIDTH - CORNER_SIZE, y: rect.top - cy - BORDER_WIDTH },
      { x: rect.right - cx + BORDER_WIDTH - CORNER_SIZE, y: rect.bottom - cy + BORDER_WIDTH - CORNER_SIZE },
      { x: rect.left - cx - BORDER_WIDTH, y: rect.bottom - cy + BORDER_WIDTH - CORNER_SIZE },
    ];
    corners.forEach((c, i) =>
      gsap.to(c, { x: pos[i].x + px, y: pos[i].y + py, duration: 0.2, ease: "power2.out" })
    );
  };

  const lockOn = (target) => {
    activeTarget = target;
    spin.pause();
    gsap.to(wrapper, { rotation: 0, duration: 0.3, ease: "power3.out" });
    updateCorners(target);
  };

  const release = () => {
    activeTarget = null;
    corners.forEach((c, i) =>
      gsap.to(c, { x: HOME[i].x, y: HOME[i].y, duration: 0.3, ease: "power3.out" })
    );
    gsap.set(wrapper, { rotation: 0 });
    spin.restart();
  };

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    moveCursor(mouseX, mouseY);
    if (activeTarget && !rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (activeTarget) updateCorners(activeTarget);
      });
    }
  });

  window.addEventListener("mouseover", (e) => {
    const target = e.target.closest?.(TARGET_SELECTOR);
    if (target && target !== activeTarget) lockOn(target);
  });

  window.addEventListener("mouseout", (e) => {
    if (!activeTarget) return;
    const still = e.relatedTarget?.closest?.(TARGET_SELECTOR);
    if (still !== activeTarget) release();
  });

  // The page scrolling under a stationary pointer changes what's hovered
  // (very much the case on the pinned index) — re-resolve the target.
  window.addEventListener(
    "scroll",
    () => {
      const under = document.elementFromPoint(mouseX, mouseY);
      const target = under?.closest?.(TARGET_SELECTOR) ?? null;
      if (target && target !== activeTarget) lockOn(target);
      else if (!target && activeTarget) release();
      else if (target && activeTarget) updateCorners(activeTarget);
    },
    { passive: true }
  );

  window.addEventListener("mousedown", () => {
    gsap.to(dot, { scale: 0.6, duration: 0.15 });
    gsap.to(wrapper, { scale: 0.92, duration: 0.15 });
  });
  window.addEventListener("mouseup", () => {
    gsap.to(dot, { scale: 1, duration: 0.15 });
    gsap.to(wrapper, { scale: 1, duration: 0.15 });
  });

  // Pointer leaves the window entirely → park the brackets.
  document.documentElement.addEventListener("mouseleave", () => {
    if (activeTarget) release();
  });
}
