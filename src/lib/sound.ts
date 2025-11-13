function createAudio(src: string, loop = false, volume = 0.4): HTMLAudioElement {
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = volume;
  return audio;
}

export function playPing() {
  const audio = createAudio("/sounds/ping.wav", false, 0.35);
  void audio.play().catch(() => undefined);
}

export function playMissionComplete() {
  const audio = createAudio("/sounds/complete.wav", false, 0.5);
  void audio.play().catch(() => undefined);
}

export function playWaveLoop(): () => void {
  const audio = createAudio("/sounds/waves.mp3", true, 0.25);
  void audio.play().catch(() => undefined);
  return () => {
    audio.pause();
    audio.currentTime = 0;
  };
}
