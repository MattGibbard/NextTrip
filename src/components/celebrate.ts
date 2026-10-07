import confetti from "canvas-confetti";

/** A burst of confetti for a winner. Skipped for people who prefer reduced motion. */
export function celebrate() {
  const end = Date.now() + 1500;
  const opts = { disableForReducedMotion: true, zIndex: 3000 };
  confetti({ ...opts, particleCount: 140, spread: 90, origin: { y: 0.55 } });
  const frame = () => {
    confetti({ ...opts, particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
    confetti({ ...opts, particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
