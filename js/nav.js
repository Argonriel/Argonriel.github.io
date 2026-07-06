// Corner Λ nav — toggle behavior only. Deliberately GSAP-free (CSS transitions
// do the panel motion) so navigation still works if the CDN is unreachable.
// The markup is inlined per page; without JS the panel simply stays open.

document.documentElement.classList.add("js");

const nav = document.querySelector(".site-nav");

if (nav) {
  const toggle = nav.querySelector(".nav-toggle");
  const panel = nav.querySelector(".nav-panel");
  nav.classList.add("nav-js"); // switches the panel from always-open fallback to toggled

  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  setOpen(false);

  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));

  document.addEventListener("click", (e) => {
    if (nav.classList.contains("open") && !nav.contains(e.target)) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  panel.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
}
