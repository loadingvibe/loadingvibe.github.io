export function createVideoRipple(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) return null;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    canvas.classList.add("is-unavailable");
    return null;
  }

  const waves = [];
  let width = 1;
  let height = 1;
  let ratio = 1;
  let frame = 0;
  let disposed = false;

  function resize() {
    if (disposed) return;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    clear();
  }

  function schedule() {
    if (!disposed && frame === 0) frame = requestAnimationFrame(render);
  }

  function add(x, y, kind = "move") {
    if (disposed) return;
    const click = kind === "click";
    waves.push({
      x,
      y,
      startedAt: performance.now(),
      duration: click ? 640 : 420,
      from: click ? 8 : 3,
      to: click ? 136 : 52,
      weight: click ? 1.05 : 0.62,
    });
    if (waves.length > 18) waves.splice(0, waves.length - 18);
    schedule();
  }

  function clear() {
    waves.length = 0;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    context.clearRect(0, 0, width, height);
  }

  function render(now) {
    frame = 0;
    if (disposed) return;
    context.clearRect(0, 0, width, height);

    for (let index = waves.length - 1; index >= 0; index -= 1) {
      const wave = waves[index];
      const progress = (now - wave.startedAt) / wave.duration;
      if (progress >= 1) {
        waves.splice(index, 1);
        continue;
      }

      const eased = 1 - (1 - progress) ** 3;
      const radius = wave.from + (wave.to - wave.from) * eased;
      const alpha = (1 - progress) ** 1.75;

      context.beginPath();
      context.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
      context.lineWidth = wave.weight;
      context.strokeStyle = `rgba(247, 243, 239, ${0.46 * alpha})`;
      context.stroke();

      context.beginPath();
      context.arc(wave.x, wave.y, Math.max(1, radius - 2.1), 0, Math.PI * 2);
      context.lineWidth = 0.45;
      context.strokeStyle = `rgba(23, 23, 23, ${0.2 * alpha})`;
      context.stroke();
    }

    if (waves.length) schedule();
  }

  function destroy() {
    disposed = true;
    clear();
  }

  resize();
  return { add, clear, destroy, resize };
}
