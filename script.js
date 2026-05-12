const seed = document.getElementById("seed");
const curve = document.getElementById("curve");
const flower = document.getElementById("flower");

const curveLength = curve.getTotalLength();

curve.style.strokeDasharray = curveLength;
curve.style.strokeDashoffset = curveLength;

function updateGarden() {
  const scrollTop = window.scrollY;
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  const progress = scrollTop / maxScroll;

  const seedY = -260 * progress;
  const seedScale = 1 - 0.6 * progress;

  seed.style.transform = `translateY(${seedY}px) scale(${seedScale})`;

  curve.style.strokeDashoffset = curveLength * (1 - progress);

  flower.style.opacity = progress;
  flower.style.transform = `scale(${0.3 + 0.7 * progress})`;
}

window.addEventListener("scroll", updateGarden);

updateGarden();
