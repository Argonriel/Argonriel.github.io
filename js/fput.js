// FPUT normal-mode energy visualization — a real simulation, not a canned loop.
//
// Model: the FPUT-α lattice, N interior oscillators with fixed ends,
//   ẍ_j = (x_{j+1} − 2x_j + x_{j−1}) + α[(x_{j+1} − x_j)² − (x_j − x_{j−1})²]
// integrated with velocity Verlet (a symplectic scheme — the same family the
// research project studies). All energy starts in mode 1; the canvas shows the
// live string displacement (top) and the energies of modes 1–6 (bars, bottom).
//
// Fallbacks: reduced-motion renders one static frame mid-transfer (no rAF loop);
// the canvas only simulates while on screen (IntersectionObserver).

const N = 32; // interior oscillators
const ALPHA = 0.25;
const DT = 0.1; // ω_max ≈ 2 → leapfrog stable for dt < 1; 0.1 keeps it accurate
const STEPS_PER_FRAME = 40; // ≈ 240 time-units/second at 60 fps
const MODES_SHOWN = 6;

const canvas = document.getElementById("fput-canvas");
const restartBtn = document.getElementById("fput-restart");

if (canvas) boot();

function boot() {
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  const COLORS = [
    token("--terracotta"),
    token("--plant"),
    token("--fruit-young"),
    token("--petal"),
    token("--fruit-ripe"),
    token("--muted"),
  ];
  const INK = token("--ink");
  const MUTED = token("--muted");

  // sin tables for the mode projection A_k = √(2/(N+1)) Σ x_j sin(jkπ/(N+1))
  const SIN = [];
  for (let k = 1; k <= MODES_SHOWN; k++) {
    SIN[k] = new Float64Array(N + 1);
    for (let j = 1; j <= N; j++) SIN[k][j] = Math.sin((j * k * Math.PI) / (N + 1));
  }
  const NORM = Math.sqrt(2 / (N + 1));
  const OMEGA = [];
  for (let k = 1; k <= MODES_SHOWN; k++) OMEGA[k] = 2 * Math.sin((k * Math.PI) / (2 * (N + 1)));

  let x, v, a, t, e0;

  const accel = () => {
    for (let j = 1; j <= N; j++) {
      const dr = x[j + 1] - x[j];
      const dl = x[j] - x[j - 1];
      a[j] = (dr - dl) + ALPHA * (dr * dr - dl * dl);
    }
  };

  const reset = () => {
    x = new Float64Array(N + 2); // x[0], x[N+1] are the fixed ends
    v = new Float64Array(N + 2);
    a = new Float64Array(N + 2);
    t = 0;
    for (let j = 1; j <= N; j++) x[j] = Math.sin((j * Math.PI) / (N + 1)); // all energy in mode 1
    accel();
    e0 = modeEnergies().reduce((s, e) => s + e, 0);
  };

  const step = () => {
    for (let j = 1; j <= N; j++) v[j] += 0.5 * DT * a[j];
    for (let j = 1; j <= N; j++) x[j] += DT * v[j];
    accel();
    for (let j = 1; j <= N; j++) v[j] += 0.5 * DT * a[j];
    t += DT;
  };

  const modeEnergies = () => {
    const out = [];
    for (let k = 1; k <= MODES_SHOWN; k++) {
      let A = 0;
      let Adot = 0;
      for (let j = 1; j <= N; j++) {
        A += x[j] * SIN[k][j];
        Adot += v[j] * SIN[k][j];
      }
      A *= NORM;
      Adot *= NORM;
      out.push(0.5 * (Adot * Adot + OMEGA[k] * OMEGA[k] * A * A));
    }
    return out;
  };

  const W = canvas.width;
  const H = canvas.height;

  const draw = () => {
    ctx.clearRect(0, 0, W, H);

    // ── top: the string itself ──
    const sTop = 24;
    const sMid = 96;
    const sAmp = 62;
    ctx.strokeStyle = token("--plant");
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j <= N + 1; j++) {
      const px = 30 + (j / (N + 1)) * (W - 60);
      const py = sMid - x[j] * sAmp;
      j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = "13px Georgia, serif";
    ctx.fillText("string displacement", 30, sTop);
    ctx.textAlign = "right";
    ctx.fillText("t = " + t.toFixed(0), W - 30, sTop);
    ctx.textAlign = "left";

    // ── bottom: normal-mode energy bars ──
    const bTop = 190;
    const bBottom = H - 36;
    const bH = bBottom - bTop;
    const energies = modeEnergies();
    const slot = (W - 60) / MODES_SHOWN;
    const barW = Math.min(58, slot * 0.42);

    ctx.strokeStyle = "rgba(42, 39, 36, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, bBottom + 0.5);
    ctx.lineTo(W - 30, bBottom + 0.5);
    ctx.stroke();

    energies.forEach((e, i) => {
      const frac = Math.min(1, e / e0);
      const h = frac * bH;
      const cx = 30 + slot * i + slot / 2;
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fillRect(cx - barW / 2, bBottom - h, barW, h);
      ctx.fillStyle = MUTED;
      ctx.font = "13px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("mode " + (i + 1), cx, bBottom + 20);
      ctx.textAlign = "left";
    });
    ctx.fillStyle = INK;
    ctx.font = "13px Georgia, serif";
    ctx.fillText("share of total energy per normal mode", 30, bTop - 10);
  };

  reset();

  if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    // Static fallback: advance to mid-transfer once, draw a single frame.
    while (t < 2400) step();
    draw();
    if (restartBtn) restartBtn.hidden = true;
    return;
  }

  let visible = true;
  let rafId = null;

  const frame = () => {
    for (let s = 0; s < STEPS_PER_FRAME; s++) step();
    draw();
    rafId = visible ? requestAnimationFrame(frame) : null;
  };

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && rafId === null) rafId = requestAnimationFrame(frame);
    },
    { threshold: 0.1 }
  ).observe(canvas);

  restartBtn?.addEventListener("click", () => {
    reset();
    draw();
  });

  draw();
}
