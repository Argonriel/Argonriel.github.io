// Pure curve math — no DOM, no GSAP, no side effects. Each function returns an
// SVG path "d" string so it can be unit-tested and reused freely.

// Rose curve (rhodonea), polar r = cos(k·θ).
//   - odd  k → k petals,  even k → 2k petals
// k may be fractional so it tweens smoothly from a single loop to a full bloom.
export function rosePath(k, { cx = 500, cy = 330, R = 110, steps = 240 } = {}) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = Math.cos(k * theta) * R; // signed radius — negative lobes fold through origin
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2) + " ";
  }
  return d + "Z";
}

// Superellipse / Lamé curve |x/a|^n + |y/b|^n = 1, parametric form.
//   - n = 2   → ellipse
//   - n ≈ 2.8 → a plump, round fruit (deliberately NOT a rounded rectangle)
// n may be fractional so the fruit swells smoothly.
export function superellipsePath(n, { cx = 500, cy = 330, a = 48, b = 56, steps = 140 } = {}) {
  let d = "";
  const p = 2 / n;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const x = cx + a * Math.sign(ct) * Math.pow(Math.abs(ct), p);
    const y = cy + b * Math.sign(st) * Math.pow(Math.abs(st), p);
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2) + " ";
  }
  return d + "Z";
}

// Logarithmic spiral r = a·e^(b·θ) — the same growth law a sunflower head follows,
// echoing the seed the whole garden started from. Returns an OPEN polyline "d"
// (no Z) so it can be stroked on via stroke-dashoffset. Sized to sit inside the fruit.
export function logSpiralPath({ cx = 500, cy = 330, a = 2.8, b = 0.15, turns = 2.5, steps = 160 } = {}) {
  let d = "";
  const thetaMax = turns * Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * thetaMax;
    const r = a * Math.exp(b * theta);
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2) + " ";
  }
  return d;
}
