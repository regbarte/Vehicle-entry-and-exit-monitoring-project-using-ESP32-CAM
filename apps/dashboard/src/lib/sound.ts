// Gate sounds. The team adds the mp3 files; a missing file fails quietly.

let chime: HTMLAudioElement | null = null;
let alarm: HTMLAudioElement | null = null;

function load(src: string, loop = false): HTMLAudioElement {
  const audio = new Audio(src);
  audio.loop = loop;
  return audio;
}

export function playRegistered() {
  chime ??= load("/sounds/registered.mp3");
  chime.currentTime = 0;
  chime.play().catch(() => {});
}

export function startNotRegistered() {
  alarm ??= load("/sounds/not-registered.mp3", true);
  if (alarm.paused) alarm.play().catch(() => {});
}

export function stopNotRegistered() {
  if (!alarm) return;
  alarm.pause();
  alarm.currentTime = 0;
}
