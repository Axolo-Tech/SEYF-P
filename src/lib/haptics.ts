/* Vibración corta de confirmación, como el "tap" de una app nativa. Solo
   Android la soporta (iOS Safari no expone `vibrate`); en otros casos no hace nada.
   Se respeta reduce-motion. */
export function haptic(ms = 8) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(ms);
  } catch {}
}
