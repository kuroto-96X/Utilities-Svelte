let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function freqFromMidi(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function playNoteAt(audioCtx: AudioContext, midi: number, duration: number, startTime: number): void {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const attack = Math.min(0.012, duration * 0.3);
  osc.type = 'triangle';
  osc.frequency.value = freqFromMidi(midi);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.2, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function startNote(midi: number): () => void {
  const audioCtx = getAudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freqFromMidi(midi);
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.012);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const t = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.stop(t + 0.06);
    setTimeout(() => {
      osc.disconnect();
      gain.disconnect();
    }, 100);
  };
}
