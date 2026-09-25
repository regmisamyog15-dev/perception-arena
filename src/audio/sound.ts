let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let bgmPlaying = false;
let currentTrackIdx = 0;
let currentStep = 0;
let nextNoteTime = 0;
let schedulerTimer: number | null = null;
let bgmVolume = 0.4;
let sfxVolume = 0.5;

export interface SoundtrackMeta {
  id: number;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
}

export const SOUNDTRACK_TRACKS: SoundtrackMeta[] = [
  { id: 0, title: 'Devil Crossroads', artist: 'Robert Soul', genre: 'Delta Blues & Dark Slide', bpm: 88 },
  { id: 1, title: 'Cybernetic Siege', artist: 'Neon Predator', genre: 'Driving Acid Synthwave', bpm: 128 },
  { id: 2, title: 'Cathedral of the Overlord', artist: 'Gothic Requiem', genre: 'Dark Choir & Cathedral Organ', bpm: 95 },
  { id: 3, title: 'Atomic Outbreak', artist: 'Wasteland Engine', genre: 'Aggressive Industrial Bass', bpm: 136 },
  { id: 4, title: 'Sniper Watch (High Ground)', artist: 'Night Stalker', genre: 'Stealth Darkwave Tension', bpm: 112 },
  { id: 5, title: '8-Bit Arena Carnage', artist: 'Sub-Zero Pulse', genre: 'Hardstyle Chiptune Arcade', bpm: 144 },
];

export function getSoundtracks(): SoundtrackMeta[] {
  return SOUNDTRACK_TRACKS;
}

export function getCurrentTrackIndex(): number {
  return currentTrackIdx;
}

export function isBgmPlaying(): boolean {
  return bgmPlaying;
}

export function setBgmVolume(v: number) {
  bgmVolume = Math.max(0, Math.min(1, v));
  if (bgmGain && audioCtx) {
    bgmGain.gain.setValueAtTime(bgmVolume, audioCtx.currentTime);
  }
}

export function setSfxVolume(v: number) {
  sfxVolume = Math.max(0, Math.min(1, v));
  if (sfxGain && audioCtx) {
    sfxGain.gain.setValueAtTime(sfxVolume, audioCtx.currentTime);
  }
}

export function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    bgmGain = audioCtx.createGain();
    bgmGain.gain.setValueAtTime(bgmVolume, audioCtx.currentTime);
    bgmGain.connect(masterGain);

    sfxGain = audioCtx.createGain();
    sfxGain.gain.setValueAtTime(sfxVolume, audioCtx.currentTime);
    sfxGain.connect(masterGain);

    // Create 1-second white noise buffer for percussion & explosions
    const bufferSize = audioCtx.sampleRate;
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function unlockAudio() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch {
    // silent catch
  }
}

// ----------------- SOUND EFFECTS ----------------- //

export function playShootSound(type: 'gun' | 'rocket' | 'grenade' | 'tankmissile' | 'sniper') {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    if (type === 'sniper') {
      // High caliber sniper crack + deep bass body
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + 0.18);

      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);

      // Gunshot noise burst
      if (noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const nFilter = ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.setValueAtTime(1800, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.35, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(sfxGain || ctx.destination);
        noise.start(now);
        noise.stop(now + 0.12);
      }
    } else if (type === 'gun') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(sfxGain || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else {
      // Rocket / Tank missile boom
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(sfxGain || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    }
  } catch {
    // silent
  }
}

export function playExplosionSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    // Sub bass drop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.45);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(sfxGain || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);

    // Noise rumble
    if (noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(60, now + 0.5);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.4, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(sfxGain || ctx.destination);
      noise.start(now);
      noise.stop(now + 0.5);
    }
  } catch {
    // silent
  }
}

export function playMeleeSound(legendary: boolean) {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = legendary ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(legendary ? 880 : 340, now);
    osc.frequency.exponentialRampToValueAtTime(legendary ? 220 : 90, now + 0.12);
    gain.gain.setValueAtTime(legendary ? 0.35 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(sfxGain || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // silent
  }
}

export function playHealSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    [261.63, 329.63, 392.0, 523.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.18, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.18);
      osc.connect(gain);
      gain.connect(sfxGain || ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.18);
    });
  } catch {
    // silent
  }
}

export function playAlertStinger() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    [0, 0.1, 0.2].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320 + idx * 110, now + offset);
      osc.frequency.exponentialRampToValueAtTime(140, now + offset + 0.14);
      gain.gain.setValueAtTime(0.28, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
      osc.connect(gain);
      gain.connect(sfxGain || ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.14);
    });
  } catch {
    // silent
  }
}

export function playClimbSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(sfxGain || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // silent
  }
}

export function playUpgradeSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.22, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.2);
      osc.connect(gain);
      gain.connect(sfxGain || ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.2);
    });
  } catch {
    // silent
  }
}

export function playTowerHitSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.1);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(sfxGain || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // silent
  }
}

export function playBossRoarSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(sfxGain || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  } catch {
    // silent
  }
}

// ----------------- SYNTHESIZED MUSIC ENGINE ----------------- //

// Note Frequencies
const N = {
  C2: 65.41, D2: 73.42, Eb2: 77.78, E2: 82.41, F2: 87.31, G2: 98.0, Ab2: 103.83, A2: 110.0, Bb2: 116.54, B2: 123.47,
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.0, G3: 196.0, Ab3: 207.65, A3: 220.0, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, Ab4: 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
};

interface StepData {
  kick?: boolean;
  snare?: boolean;
  hihat?: boolean;
  bass?: number;
  bassType?: OscillatorType;
  lead?: number;
  leadType?: OscillatorType;
  leadDur?: number;
  chord?: number[];
}

// Track 0: Devil Crossroads (88 BPM Delta Blues)
const TRACK_0_STEPS: StepData[] = [
  { kick: true, hihat: true, bass: N.D2, lead: N.D4, leadDur: 0.35 },
  { hihat: true, bass: N.D2 },
  { hihat: true, bass: N.F2, lead: N.F4, leadDur: 0.25 },
  { snare: true, hihat: true, bass: N.G2, lead: N.Ab4, leadDur: 0.3 },
  { kick: true, hihat: true, bass: N.D2, lead: N.A4, leadDur: 0.4 },
  { hihat: true, bass: N.D2 },
  { hihat: true, bass: N.C3, lead: N.C5, leadDur: 0.35 },
  { snare: true, hihat: true, bass: N.A2, lead: N.D5, leadDur: 0.5 },
  { kick: true, hihat: true, bass: N.G2, lead: N.D4, leadDur: 0.35 },
  { hihat: true, bass: N.G2 },
  { hihat: true, bass: N.Bb2, lead: N.F4, leadDur: 0.25 },
  { snare: true, hihat: true, bass: N.C3, lead: N.G4, leadDur: 0.3 },
  { kick: true, hihat: true, bass: N.A2, lead: N.F4, leadDur: 0.3 },
  { hihat: true, bass: N.G2, lead: N.Eb4, leadDur: 0.25 },
  { hihat: true, bass: N.F2, lead: N.D4, leadDur: 0.4 },
  { snare: true, hihat: true, bass: N.D2, lead: N.D3, leadDur: 0.6 },
];

// Track 1: Cybernetic Siege (128 BPM Synthwave)
const TRACK_1_STEPS: StepData[] = [
  { kick: true, hihat: true, bass: N.A2, bassType: 'sawtooth', lead: N.A4, leadDur: 0.15 },
  { hihat: true, bass: N.A2, bassType: 'sawtooth', lead: N.C5, leadDur: 0.15 },
  { hihat: true, bass: N.A2, bassType: 'sawtooth', lead: N.E5, leadDur: 0.15 },
  { snare: true, hihat: true, bass: N.A2, bassType: 'sawtooth', lead: N.A4, leadDur: 0.15 },
  { kick: true, hihat: true, bass: N.F2, bassType: 'sawtooth', lead: N.F4, leadDur: 0.15 },
  { hihat: true, bass: N.F2, bassType: 'sawtooth', lead: N.A4, leadDur: 0.15 },
  { hihat: true, bass: N.F2, bassType: 'sawtooth', lead: N.C5, leadDur: 0.15 },
  { snare: true, hihat: true, bass: N.F2, bassType: 'sawtooth', lead: N.F5, leadDur: 0.2 },
  { kick: true, hihat: true, bass: N.G2, bassType: 'sawtooth', lead: N.G4, leadDur: 0.15 },
  { hihat: true, bass: N.G2, bassType: 'sawtooth', lead: N.B4, leadDur: 0.15 },
  { hihat: true, bass: N.G2, bassType: 'sawtooth', lead: N.D5, leadDur: 0.15 },
  { snare: true, hihat: true, bass: N.G2, bassType: 'sawtooth', lead: N.G5, leadDur: 0.2 },
  { kick: true, hihat: true, bass: N.E2, bassType: 'sawtooth', lead: N.E4, leadDur: 0.15 },
  { hihat: true, bass: N.E2, bassType: 'sawtooth', lead: N.G4, leadDur: 0.15 },
  { hihat: true, bass: N.E2, bassType: 'sawtooth', lead: N.B4, leadDur: 0.15 },
  { snare: true, hihat: true, bass: N.E2, bassType: 'sawtooth', lead: N.E5, leadDur: 0.25 },
];

// Track 2: Cathedral of the Overlord (95 BPM Gothic Organ / Choir)
const TRACK_2_STEPS: StepData[] = [
  { kick: true, hihat: true, bass: N.C2, chord: [N.C3, N.Eb3, N.G3, N.C4], lead: N.C5, leadDur: 0.6 },
  { hihat: true },
  { hihat: true, bass: N.C2, lead: N.Eb5, leadDur: 0.4 },
  { snare: true, hihat: true, chord: [N.C3, N.Eb3, N.G3] },
  { kick: true, hihat: true, bass: N.Ab2, chord: [N.Ab2, N.C3, N.Eb3, N.Ab3], lead: N.Ab4, leadDur: 0.6 },
  { hihat: true },
  { hihat: true, bass: N.Ab2, lead: N.C5, leadDur: 0.4 },
  { snare: true, hihat: true, chord: [N.Ab2, N.C3, N.Eb3] },
  { kick: true, hihat: true, bass: N.Bb2, chord: [N.Bb2, N.D3, N.F3, N.Bb3], lead: N.Bb4, leadDur: 0.6 },
  { hihat: true },
  { hihat: true, bass: N.Bb2, lead: N.D5, leadDur: 0.4 },
  { snare: true, hihat: true, chord: [N.Bb2, N.D3, N.F3] },
  { kick: true, hihat: true, bass: N.G2, chord: [N.G2, N.B2, N.D3, N.G3], lead: N.G4, leadDur: 0.6 },
  { hihat: true },
  { hihat: true, bass: N.G2, lead: N.B4, leadDur: 0.4 },
  { snare: true, hihat: true, chord: [N.G2, N.B2, N.D3] },
];

// Track 3: Atomic Outbreak (136 BPM Industrial Bass)
const TRACK_3_STEPS: StepData[] = [
  { kick: true, hihat: true, bass: N.E2, bassType: 'sawtooth', lead: N.E4, leadDur: 0.12 },
  { hihat: true, bass: N.E2, bassType: 'sawtooth' },
  { kick: true, hihat: true, bass: N.G2, bassType: 'sawtooth', lead: N.G4, leadDur: 0.12 },
  { snare: true, hihat: true, bass: N.E2, bassType: 'sawtooth' },
  { kick: true, hihat: true, bass: N.Bb2, bassType: 'sawtooth', lead: N.Bb4, leadDur: 0.15 },
  { hihat: true, bass: N.A2, bassType: 'sawtooth' },
  { kick: true, hihat: true, bass: N.G2, bassType: 'sawtooth', lead: N.G4, leadDur: 0.12 },
  { snare: true, hihat: true, bass: N.F2, bassType: 'sawtooth', lead: N.F4, leadDur: 0.18 },
  { kick: true, hihat: true, bass: N.E2, bassType: 'sawtooth', lead: N.E4, leadDur: 0.12 },
  { hihat: true, bass: N.E2, bassType: 'sawtooth' },
  { kick: true, hihat: true, bass: N.D3, bassType: 'sawtooth', lead: N.D5, leadDur: 0.15 },
  { snare: true, hihat: true, bass: N.C3, bassType: 'sawtooth', lead: N.C5, leadDur: 0.15 },
  { kick: true, hihat: true, bass: N.Bb2, bassType: 'sawtooth', lead: N.Bb4, leadDur: 0.12 },
  { hihat: true, bass: N.A2, bassType: 'sawtooth' },
  { kick: true, hihat: true, bass: N.Ab2, bassType: 'sawtooth', lead: N.Ab4, leadDur: 0.18 },
  { snare: true, hihat: true, bass: N.G2, bassType: 'sawtooth', lead: N.G4, leadDur: 0.22 },
];

// Track 4: Sniper High Ground (112 BPM Tension Darkwave)
const TRACK_4_STEPS: StepData[] = [
  { kick: true, hihat: true, bass: N.D2, lead: N.D4, leadType: 'sine', leadDur: 0.45 },
  { hihat: true },
  { hihat: true, bass: N.D2, lead: N.F4, leadType: 'sine', leadDur: 0.3 },
  { snare: true, hihat: true },
  { kick: true, hihat: true, bass: N.A2, lead: N.A4, leadType: 'sine', leadDur: 0.5 },
  { hihat: true },
  { hihat: true, bass: N.G2, lead: N.C5, leadType: 'sine', leadDur: 0.35 },
  { snare: true, hihat: true },
  { kick: true, hihat: true, bass: N.F2, lead: N.D5, leadType: 'sine', leadDur: 0.55 },
  { hihat: true },
  { hihat: true, bass: N.G2, lead: N.C5, leadType: 'sine', leadDur: 0.3 },
  { snare: true, hihat: true },
  { kick: true, hihat: true, bass: N.Eb2, lead: N.Bb4, leadType: 'sine', leadDur: 0.45 },
  { hihat: true },
  { hihat: true, bass: N.D2, lead: N.A4, leadType: 'sine', leadDur: 0.35 },
  { snare: true, hihat: true, lead: N.D4, leadType: 'sine', leadDur: 0.6 },
];

// Track 5: 8-Bit Overlord (144 BPM Chiptune Arcade)
const TRACK_5_STEPS: StepData[] = [
  { kick: true, hihat: true, bass: N.A2, bassType: 'square', lead: N.A4, leadType: 'square', leadDur: 0.1 },
  { hihat: true, bass: N.A2, bassType: 'square', lead: N.C5, leadType: 'square', leadDur: 0.1 },
  { hihat: true, bass: N.A2, bassType: 'square', lead: N.E5, leadType: 'square', leadDur: 0.1 },
  { snare: true, hihat: true, bass: N.A2, bassType: 'square', lead: N.A5, leadType: 'square', leadDur: 0.12 },
  { kick: true, hihat: true, bass: N.D3, bassType: 'square', lead: N.G5, leadType: 'square', leadDur: 0.1 },
  { hihat: true, bass: N.D3, bassType: 'square', lead: N.E5, leadType: 'square', leadDur: 0.1 },
  { hihat: true, bass: N.D3, bassType: 'square', lead: N.D5, leadType: 'square', leadDur: 0.1 },
  { snare: true, hihat: true, bass: N.D3, bassType: 'square', lead: N.C5, leadType: 'square', leadDur: 0.12 },
  { kick: true, hihat: true, bass: N.F2, bassType: 'square', lead: N.F4, leadType: 'square', leadDur: 0.1 },
  { hihat: true, bass: N.F2, bassType: 'square', lead: N.A4, leadType: 'square', leadDur: 0.1 },
  { hihat: true, bass: N.F2, bassType: 'square', lead: N.C5, leadType: 'square', leadDur: 0.1 },
  { snare: true, hihat: true, bass: N.F2, bassType: 'square', lead: N.F5, leadType: 'square', leadDur: 0.12 },
  { kick: true, hihat: true, bass: N.E2, bassType: 'square', lead: N.E5, leadType: 'square', leadDur: 0.1 },
  { hihat: true, bass: N.E2, bassType: 'square', lead: N.D5, leadType: 'square', leadDur: 0.1 },
  { hihat: true, bass: N.E2, bassType: 'square', lead: N.B4, leadType: 'square', leadDur: 0.1 },
  { snare: true, hihat: true, bass: N.E2, bassType: 'square', lead: N.G4, leadType: 'square', leadDur: 0.14 },
];

const TRACK_BANKS = [
  TRACK_0_STEPS,
  TRACK_1_STEPS,
  TRACK_2_STEPS,
  TRACK_3_STEPS,
  TRACK_4_STEPS,
  TRACK_5_STEPS,
];

// Synth Voice Dispatcher
function scheduleKick(time: number) {
  if (!audioCtx || !bgmGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(35, time + 0.14);

  gain.gain.setValueAtTime(0.7, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

  osc.connect(gain);
  gain.connect(bgmGain);

  osc.start(time);
  osc.stop(time + 0.15);
}

function scheduleSnare(time: number) {
  if (!audioCtx || !bgmGain || !noiseBuffer) return;
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(1000, time);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(bgmGain);

  noise.start(time);
  noise.stop(time + 0.18);

  // Snare body pop
  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, time);
  osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
  oscGain.gain.setValueAtTime(0.3, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  osc.connect(oscGain);
  oscGain.connect(bgmGain);
  osc.start(time);
  osc.stop(time + 0.1);
}

function scheduleHiHat(time: number) {
  if (!audioCtx || !bgmGain || !noiseBuffer) return;
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(6500, time);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.18, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(bgmGain);

  noise.start(time);
  noise.stop(time + 0.05);
}

function scheduleBass(freq: number, type: OscillatorType = 'sawtooth', time: number, dur: number) {
  if (!audioCtx || !bgmGain) return;
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(950, time);
  filter.frequency.exponentialRampToValueAtTime(180, time + dur);
  filter.Q.setValueAtTime(4, time);

  gain.gain.setValueAtTime(0.35, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bgmGain);

  osc.start(time);
  osc.stop(time + dur);
}

function scheduleLead(freq: number, type: OscillatorType = 'sawtooth', time: number, dur: number) {
  if (!audioCtx || !bgmGain) return;

  // Dual oscillator with chorus detune
  [-5, 5].forEach((detune) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.setValueAtTime(detune, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.18, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(bgmGain!);

    osc.start(time);
    osc.stop(time + dur);
  });
}

function scheduleChord(freqs: number[], time: number, dur = 0.6) {
  if (!audioCtx || !bgmGain) return;
  freqs.forEach((freq) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.12 / freqs.length, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(bgmGain!);
    osc.start(time);
    osc.stop(time + dur);
  });
}

function scheduler() {
  if (!bgmPlaying || !audioCtx) return;

  const trackMeta = SOUNDTRACK_TRACKS[currentTrackIdx] || SOUNDTRACK_TRACKS[0];
  const stepDuration = 60 / trackMeta.bpm / 4; // 16th note duration
  const scheduleAheadTime = 0.12;

  while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    const bank = TRACK_BANKS[currentTrackIdx] || TRACK_0_STEPS;
    const step = bank[currentStep % bank.length];

    if (step.kick) scheduleKick(nextNoteTime);
    if (step.snare) scheduleSnare(nextNoteTime);
    if (step.hihat) scheduleHiHat(nextNoteTime);
    if (step.bass) scheduleBass(step.bass, step.bassType || 'sawtooth', nextNoteTime, stepDuration * 1.8);
    if (step.lead) scheduleLead(step.lead, step.leadType || 'sawtooth', nextNoteTime, step.leadDur || stepDuration * 2);
    if (step.chord) scheduleChord(step.chord, nextNoteTime, stepDuration * 3.5);

    nextNoteTime += stepDuration;
    currentStep++;
  }

  schedulerTimer = window.setTimeout(scheduler, 25);
}

export function startBgmMusic() {
  // Game music has been removed — intentional no-op.
  return;
}

export function stopBgmMusic() {
  bgmPlaying = false;
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}

export function toggleBgmMusic(): boolean {
  if (bgmPlaying) {
    stopBgmMusic();
    return false;
  } else {
    startBgmMusic();
    return true;
  }
}

export function setBgmTrack(index: number) {
  currentTrackIdx = (index + SOUNDTRACK_TRACKS.length) % SOUNDTRACK_TRACKS.length;
  currentStep = 0;
  if (audioCtx && bgmPlaying) {
    nextNoteTime = audioCtx.currentTime + 0.05;
  }
}
