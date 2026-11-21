import { TheoryId } from '../types/menu';

const STORAGE_KEY = 'amumal_sound_on';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function loadSoundPreference(): boolean {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === '0') return false;
    if (saved === '1') return true;
  } catch {
    // Ignore storage restriction
  }
  return true;
}

export function saveSoundPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore storage restriction
  }
}

/**
 * Call synchronously inside user click/submit handlers so iOS/Chrome unlock the AudioContext cleanly.
 */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
}

function playTone(
  ctx: AudioContext,
  opts: {
    freq: number;
    endFreq?: number;
    type?: OscillatorType;
    startOffset?: number;
    duration?: number;
    gain?: number;
    filterHz?: number;
  }
): void {
  const now = ctx.currentTime + (opts.startOffset ?? 0);
  const dur = opts.duration ?? 0.12;
  const peak = opts.gain ?? 0.045;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.endFreq && opts.endFreq !== opts.freq) {
    osc.frequency.exponentialRampToValueAtTime(opts.endFreq, now + dur);
  }

  // Ultra-smooth micro attack + exponential release so there are zero speaker clicks
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(peak, now + Math.min(0.014, dur * 0.25));
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  if (opts.filterHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.filterHz, now);
    osc.connect(filter);
    filter.connect(amp);
  } else {
    osc.connect(amp);
  }

  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function getReadyCtx(enabled: boolean): AudioContext | null {
  if (!enabled) return null;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return null;
  return ctx;
}

export function playToggleOnSound(): void {
  unlockAudio();
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx
      .resume()
      .then(() => {
        playTone(ctx, { freq: 587.33, endFreq: 783.99, duration: 0.11, gain: 0.042 });
      })
      .catch(() => {});
    return;
  }
  playTone(ctx, { freq: 587.33, endFreq: 783.99, duration: 0.11, gain: 0.042 });
}

export function playPhaseSound(
  phase: 1 | 2 | 3 | 4,
  theoryId: TheoryId,
  enabled: boolean
): void {
  const ctx = getReadyCtx(enabled);
  if (!ctx) return;

  if (phase === 1) {
    if (theoryId === 'weather') {
      // Soft airy breeze / drop chime
      playTone(ctx, { freq: 659.25, endFreq: 523.25, duration: 0.16, gain: 0.032 });
      playTone(ctx, { freq: 783.99, startOffset: 0.1, duration: 0.14, gain: 0.028 });
      return;
    }
    if (theoryId === 'fx') {
      // Crisp stock-ticker double ping
      playTone(ctx, { freq: 740, duration: 0.07, gain: 0.034 });
      playTone(ctx, { freq: 987.77, startOffset: 0.09, duration: 0.11, gain: 0.034 });
      return;
    }
    if (theoryId === 'moon') {
      // Dreamy celestial lunar harmonic
      playTone(ctx, { freq: 698.46, duration: 0.22, gain: 0.028 });
      playTone(ctx, { freq: 1046.5, startOffset: 0.11, duration: 0.26, gain: 0.024 });
      return;
    }
    if (theoryId === 'clock') {
      // Crisp watchmaker tick-tick-tick
      [0, 0.14, 0.28].forEach((offset, i) => {
        playTone(ctx, {
          freq: i % 2 === 0 ? 980 : 820,
          type: 'triangle',
          startOffset: offset,
          duration: 0.032,
          gain: 0.032,
          filterHz: 2200,
        });
      });
      return;
    }
    if (theoryId === 'fingerprint') {
      // Soft ascending biometric scan pulse
      playTone(ctx, { freq: 523.25, duration: 0.1, gain: 0.032 });
      playTone(ctx, { freq: 698.46, startOffset: 0.09, duration: 0.12, gain: 0.034 });
      return;
    }
    if (theoryId === 'constellation') {
      // Airy night-sky twin sparkle
      playTone(ctx, { freq: 880, duration: 0.18, gain: 0.032 });
      playTone(ctx, { freq: 1318.5, startOffset: 0.09, duration: 0.22, gain: 0.028 });
      return;
    }
    if (theoryId === 'morse') {
      // Tactile dot-dash woodblock pulse
      playTone(ctx, { freq: 520, type: 'triangle', duration: 0.065, gain: 0.04, filterHz: 1400 });
      playTone(ctx, {
        freq: 440,
        type: 'triangle',
        startOffset: 0.11,
        duration: 0.14,
        gain: 0.042,
        filterHz: 1400,
      });
      return;
    }
    if (theoryId === 'keyboard') {
      // Soft tactile mechanical keycaps
      [0, 0.09, 0.18].forEach((offset, i) => {
        playTone(ctx, {
          freq: 300 + i * 45,
          endFreq: 190,
          type: 'triangle',
          startOffset: offset,
          duration: 0.055,
          gain: 0.038,
          filterHz: 1100,
        });
      });
      return;
    }
    // Clean Toss-like soft start blip
    playTone(ctx, { freq: 440, endFreq: 554.37, duration: 0.11, gain: 0.036 });
    return;
  }

  if (phase === 2) {
    if (theoryId === 'constellation') {
      playTone(ctx, { freq: 1046.5, duration: 0.19, gain: 0.03 });
      return;
    }
    if (theoryId === 'morse') {
      playTone(ctx, { freq: 587.33, type: 'triangle', duration: 0.08, gain: 0.036, filterHz: 1600 });
      playTone(ctx, {
        freq: 659.25,
        type: 'triangle',
        startOffset: 0.095,
        duration: 0.08,
        gain: 0.034,
        filterHz: 1600,
      });
      return;
    }
    playTone(ctx, { freq: 587.33, duration: 0.11, gain: 0.034 });
    return;
  }

  if (phase === 3) {
    // Gentle rising harmonic step right before reveal
    playTone(ctx, { freq: 659.25, duration: 0.12, gain: 0.034 });
    return;
  }

  // Phase 4: Warm crystal-clear two-note reveal chime (C5 + G5 -> D6 soft shimmer)
  playTone(ctx, { freq: 523.25, duration: 0.28, gain: 0.042 });
  playTone(ctx, { freq: 783.99, startOffset: 0.06, duration: 0.34, gain: 0.044 });
  playTone(ctx, { freq: 1174.66, startOffset: 0.12, duration: 0.32, gain: 0.022 });
}

/**
 * Ultra-soft tactile micro-pulse as Act 1 sweeps across each Hangul syllable.
 */
export function playScanTickSound(stepIndex: number, enabled: boolean): void {
  const ctx = getReadyCtx(enabled);
  if (!ctx) return;

  const freq = 520 + (stepIndex % 6) * 44;
  playTone(ctx, {
    freq,
    type: 'sine',
    duration: 0.032,
    gain: 0.015,
  });
}

/**
 * Crisp micro verification tick for Act 2 sequential checkmarks.
 */
export function playVerifyTickSound(stepIndex: number, enabled: boolean): void {
  const ctx = getReadyCtx(enabled);
  if (!ctx) return;

  const freqs = [660, 784, 988];
  playTone(ctx, {
    freq: freqs[Math.min(stepIndex, freqs.length - 1)],
    type: 'sine',
    duration: 0.055,
    gain: 0.022,
  });
}

/**
 * Tactile rejection cut + tension tick for Act 3 candidate-pool elimination waves.
 */
export function playReelTickSound(stepIndex: number, isLock: boolean, enabled: boolean): void {
  const ctx = getReadyCtx(enabled);
  if (!ctx) return;

  if (isLock) {
    // Crisp lock-on double chime right before final reveal
    playTone(ctx, { freq: 783.99, type: 'sine', duration: 0.09, gain: 0.044 });
    playTone(ctx, { freq: 1046.5, type: 'sine', startOffset: 0.055, duration: 0.15, gain: 0.046 });
    return;
  }

  // Crisp downward rejection cut paired with rising precision ping
  playTone(ctx, {
    freq: 360,
    endFreq: 195,
    type: 'triangle',
    duration: 0.04,
    gain: 0.024,
    filterHz: 1150,
  });
  const freq = 420 + Math.min(stepIndex, 8) * 44;
  playTone(ctx, {
    freq,
    type: 'sine',
    startOffset: 0.014,
    duration: 0.036,
    gain: 0.018,
  });
}
