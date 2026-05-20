let audioCtx: AudioContext | null = null;

export const playNewEmailSound = () => {
  try {
    // Lazily initialize AudioContext
    if (!audioCtx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    
    // Create oscillator 1 (high chime)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1); // Slide up to A5
    
    // Create oscillator 2 (harmonious fifth/third)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now); // E5
    osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15); // Slide up to C6

    // Envelope
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    // Connect
    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(audioCtx.destination);
    gain2.connect(audioCtx.destination);

    // Start & Stop
    osc1.start(now);
    osc1.stop(now + 0.6);
    osc2.start(now);
    osc2.stop(now + 0.6);
  } catch (error) {
    console.warn('Web Audio chime could not play:', error);
  }
};
