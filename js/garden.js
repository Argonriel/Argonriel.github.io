// ── ANIMATION CONTRACT ──────────────────────────────
// SEED   : transform 只允许 translateY + scaleY；translateX 恒 = 0
//          transform-origin: center bottom
//          落点 y = 茎根部 y；落地后圆心 y 不再变化（禁止继续下移）
// STEM   : 从种子落点向上生长，用 stroke-dashoffset
// FLOWER : rosePath(k)，k: 1→5；整体锚定花心，x/y 不位移
// CORE   : 花心原地出现，仅 opacity 0→1 + scale 0.8→1；translateX/Y 恒 = 0
// FRUIT  : 单一 superellipse 元素，由 CORE 原地长大而来
//          全程无位移；禁止存在第二个圆/椭圆元素
//          颜色：CORE 色 → #A8503C（成熟深赤陶），绑定在该元素上
//          成形后内部画对数螺旋（stroke-dashoffset），呼应种子
// SNAP   : [0, s2, s3, 0.86, 1]
//          0 =种子落定 / s2=花刚开 / s3=花快开完 / 0.86=花蕊出现 / 1=果实成形
//          s2、s3 由你按时间线校准并回报具体值
// ────────────────────────────────────────────────────
// CALIBRATED SNAP (this build): [0.08, 0.272, 0.4853, 0.7787, 1.00]   (pin scroll = +=7500)
//   0.08 种子落定 · 0.272 花刚开 (k≈2.5) · 0.4853 花快开完 (k≈4.5) ·
//   0.7787 花蕊出现 (young fruit) · 1.00 果实成形 (+spiral)
// ABSOLUTE px per segment (per the requested table; total = 7500):
//   seed 600 · →花刚开 1440 · →花快开完 1600 · →花蕊 2200 · 花蕊→果实 1660
// Segments 1–2 unchanged; segments 3–5 internal tweens rescaled to fit the new spans
// (SEG3 ×1.4815, SEG4 ×1.3095, SEG5 ×0.6148) so snaps still land on completion frames.
// SEED: fades in at mid-screen (no move), then translateY-only slow sink (power2.out);
//   transform-origin center bottom; translateX ≡ 0; no squash.
// NOTE: CORE and FRUIT are the SAME single #fruit element — it appears as a small
//   circle (n=2) then ripens in place (n→2.5, plumps, color deepens). There is no
//   separate core circle, satisfying "有且仅有一个果实图形元素".

import { rosePath, superellipsePath, logSpiralPath } from "./curves.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

document.body.classList.add("js");

if (!gsap || !ScrollTrigger) {
  document.body.classList.remove("js"); // CDN down → readable stacked fallback
} else {
  gsap.registerPlugin(ScrollTrigger);
  boot();
}

function boot() {
  const el = {
    groundL: document.getElementById("ground-l"),
    groundR: document.getElementById("ground-r"),
    ground: document.getElementById("ground"),
    seed: document.getElementById("seed"),
    stem: document.getElementById("stem"),
    flower: document.getElementById("flower"),
    petals: document.getElementById("petals"),
    fruit: document.getElementById("fruit"),
    spiral: document.getElementById("spiral"),
  };

  const scene = (name) => document.querySelector(`[data-scene="${name}"]`);
  const scenes = {
    seed: scene("seed"),
    stem: scene("stem"),
    flower: scene("flower"),
    wither: scene("wither"),
    fruit: scene("fruit"),
  };
  const cards = gsap.utils.toArray(".card");

  // Token colors — JS never hardcodes hex.
  const css = getComputedStyle(document.documentElement);
  const FRUIT_YOUNG = css.getPropertyValue("--fruit-young").trim();
  const FRUIT_RIPE = css.getPropertyValue("--fruit-ripe").trim(); // #A8503C

  const primeStroke = (path) => {
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    return len;
  };

  // Tweenable curve state; setters rebuild path "d" each frame.
  const rose = { k: 1 };
  const fruitShape = { n: 2, a: 42, b: 42 }; // starts a circle (a=b, n=2)
  const setPetals = (steps) => el.petals.setAttribute("d", rosePath(rose.k, { steps }));
  const setFruit = (steps) =>
    el.fruit.setAttribute("d", superellipsePath(fruitShape.n, { a: fruitShape.a, b: fruitShape.b, steps }));

  // Build the spiral path once (geometry is static; only its dashoffset animates).
  el.spiral.setAttribute("d", logSpiralPath());

  const mm = gsap.matchMedia();

  // ---------- Desktop: pinned, scrubbed, 5-point inertial snap ----------
  mm.add("(min-width: 769px) and (prefers-reduced-motion: no-preference)", () => {
    primeStroke(el.groundL);
    primeStroke(el.groundR);
    primeStroke(el.stem);
    const spiralLen = primeStroke(el.spiral);

    gsap.set(el.ground, { autoAlpha: 1 });
    // SEED: appears mid-screen (y = -110 → cy≈490), fades in with NO movement, then
    // sinks a short, slow distance to the root. translateX never set → stays 0.
    gsap.set(el.seed, { y: -110, autoAlpha: 0, scaleY: 1, transformOrigin: "50% 100%" });
    rose.k = 1;
    setPetals(240);
    gsap.set(el.petals, { opacity: 0 });
    gsap.set(el.flower, { rotation: 0, y: 0, autoAlpha: 1, svgOrigin: "500 330" });
    // FRUIT (single element): small circle, hidden, anchored at flower center.
    fruitShape.n = 2;
    fruitShape.a = 42;
    fruitShape.b = 42;
    setFruit(140);
    gsap.set(el.fruit, { autoAlpha: 0, scale: 0.8, svgOrigin: "500 330", fill: FRUIT_YOUNG });
    gsap.set(el.spiral, { autoAlpha: 1, strokeDashoffset: spiralLen }); // visible-but-undrawn

    gsap.set([scenes.stem, scenes.flower, scenes.wither, scenes.fruit], { autoAlpha: 0 });
    gsap.set(scenes.seed, { autoAlpha: 1 });
    gsap.set(cards, { y: 40, autoAlpha: 0 });

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: ".stage",
        start: "top top",
        end: "+=7500", // lengthened from 6000 to grow only the fruit segment
        pin: true,
        scrub: 1,
        snap: {
          snapTo: [0.08, 0.272, 0.4853, 0.7787, 1], // each = a stage COMPLETION frame
          duration: { min: 0.2, max: 0.6 }, // eased glide, not a hard jump
          delay: 0.08,
          inertia: true, // free-scroll, then ease to nearest on release
          ease: "power1.inOut",
        },
      },
    });

    // total duration = 1 → positions equal scroll progress.
    // SCENE TEXT RULE: each scene is fully opaque AT its snap and only fades out AFTER
    // scrolling past it — fade-in completes before the snap, fade-out begins after.

    // NOTE: positions/durations of stages 1–4 are the previous values ×0.8, which keeps
    // their ABSOLUTE scroll px identical on the longer (7500px) track — no compression.

    // --- → snap 0.08  种子落定: ground draws center-out; seed fades in mid-screen, then slow short sink ---
    tl.to([el.groundL, el.groundR], { strokeDashoffset: 0, duration: 0.032 }, 0);
    tl.to(el.seed, { autoAlpha: 1, duration: 0.04 }, 0); // fade in IN PLACE (no movement)
    tl.to(el.seed, { y: 0, duration: 0.04, ease: "power2.out" }, 0.04); // slow short sink to root; lands & stops

    // --- → snap 0.272  花刚开: ground fades, stem grows, flower opens to k≈2.5 (opaque) ---
    tl.to(el.ground, { autoAlpha: 0, duration: 0.032 }, 0.088);
    tl.to(el.stem, { strokeDashoffset: 0, duration: 0.072 }, 0.088);
    tl.to(scenes.seed, { autoAlpha: 0, duration: 0.04 }, 0.112); // hero fades AFTER snap1 (0.08)
    tl.to(el.petals, { opacity: 1, duration: 0.056 }, 0.16); // opaque before snap2
    tl.to(rose, { k: 2.5, duration: 0.112, onUpdate: () => setPetals(240) }, 0.16);
    tl.to(scenes.stem, { autoAlpha: 1, duration: 0.048 }, 0.176); // about full by 0.224 (< snap2)

    // --- → snap 0.4853  花快开完: bloom continues to k≈4.5; about → projects (SEG3 ×1.4815) ---
    tl.to(rose, { k: 4.5, duration: 0.2133, onUpdate: () => setPetals(240) }, 0.272);
    tl.to(scenes.stem, { autoAlpha: 0, duration: 0.0593 }, 0.3194); // about fades AFTER snap2 (0.272)
    tl.to(scenes.flower, { autoAlpha: 1, duration: 0.0593 }, 0.3905); // projects full by 0.4498 (< snap3)
    tl.to(cards, { y: 0, autoAlpha: 1, duration: 0.0593, stagger: 0.0237 }, 0.4024);

    // --- → snap 0.7787  花蕊出现: long bloom tail → brief full bloom → SHORT wither → young fruit (SEG4 ×1.3095) ---
    tl.to(rose, { k: 5, duration: 0.2095, onUpdate: () => setPetals(240) }, 0.4853); // tail k4.5→5
    tl.to(scenes.flower, { autoAlpha: 0, duration: 0.0629 }, 0.6739); // projects fades AFTER snap3 (0.4853)
    tl.to(el.flower, { rotation: 35, y: 70, autoAlpha: 0, duration: 0.0419, ease: "power1.in" }, 0.7158); // SHORT wither
    tl.to(el.fruit, { autoAlpha: 1, scale: 1, duration: 0.0419 }, 0.7368); // CORE: opacity+scale only, no move
    tl.to(scenes.wither, { autoAlpha: 1, duration: 0.0419 }, 0.7158); // research full by 0.7577 (< snap4)

    // --- → snap 1.00  果实成形: ripen in place, then slowly draw the spiral (SEG5 ×0.6148) ---
    tl.to(fruitShape, { n: 2.5, b: 52, duration: 0.1107, onUpdate: () => setFruit(140) }, 0.8008); // circle → superellipse
    tl.to(el.fruit, { fill: FRUIT_RIPE, duration: 0.1107 }, 0.8008); // gradual deepen → #7e2d26, bound to this element
    tl.to(scenes.wither, { autoAlpha: 0, duration: 0.0553 }, 0.8451); // research fades AFTER snap4 (0.7787)
    tl.to(el.spiral, { strokeDashoffset: 0, duration: 0.0885 }, 0.9115); // one-stroke log spiral (0.9115–1.0)
    tl.to(scenes.fruit, { autoAlpha: 1, duration: 0.0664 }, 0.8893); // contact full by 0.9557
    tl.from(scenes.fruit.querySelectorAll(".cta"), { y: 20, autoAlpha: 0, duration: 0.0664, stagger: 0.05 }, 0.9336);

    return () => {};
  });

  // ---------- Mobile: simplified — stacked scenes fade in, SVG settled at bloom ----------
  mm.add("(max-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
    document.body.classList.add("static-flow");

    gsap.set([el.groundL, el.groundR], { strokeDasharray: "none", strokeDashoffset: 0 });
    gsap.set(el.ground, { autoAlpha: 0 });
    gsap.set(el.seed, { y: 0, scaleY: 1, autoAlpha: 1 });
    gsap.set(el.stem, { strokeDasharray: "none", strokeDashoffset: 0 });
    rose.k = 5;
    setPetals(120);
    gsap.set(el.petals, { opacity: 1 });
    gsap.set([el.fruit, el.spiral], { autoAlpha: 0 });

    Object.values(scenes).forEach((s) => {
      gsap.set(s, { autoAlpha: 0, y: 24 });
      gsap.to(s, {
        autoAlpha: 1,
        y: 0,
        duration: 0.5,
        scrollTrigger: { trigger: s, start: "top 80%", toggleActions: "play none none reverse" },
      });
    });

    return () => document.body.classList.remove("static-flow");
  });

  // ---------- Reduced motion: static final fruit (+ spiral) + everything visible ----------
  mm.add("(prefers-reduced-motion: reduce)", () => {
    document.body.classList.add("reduced");
    gsap.set([el.groundL, el.groundR, el.stem], { strokeDasharray: "none", strokeDashoffset: 0 });
    gsap.set(el.ground, { autoAlpha: 0 });
    gsap.set(el.seed, { y: 0, scaleY: 1, autoAlpha: 1 });
    gsap.set(el.petals, { opacity: 0 });
    gsap.set(el.flower, { autoAlpha: 0 });
    fruitShape.n = 2.5;
    fruitShape.a = 42;
    fruitShape.b = 52;
    setFruit(140);
    gsap.set(el.fruit, { autoAlpha: 1, scale: 1, svgOrigin: "500 330", fill: FRUIT_RIPE });
    gsap.set(el.spiral, { autoAlpha: 1, strokeDasharray: "none", strokeDashoffset: 0 });
    return () => document.body.classList.remove("reduced");
  });
}
