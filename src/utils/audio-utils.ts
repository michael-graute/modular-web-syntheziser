/**
 * Audio utility functions
 */

/**
 * Convert MIDI note number to frequency in Hz
 * @param midiNote - MIDI note number (0-127)
 * @returns Frequency in Hz
 */
export function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Convert frequency to MIDI note number
 * @param frequency - Frequency in Hz
 * @returns MIDI note number
 */
export function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * Convert linear gain (0-1) to decibels
 * @param gain - Linear gain value
 * @returns Gain in decibels
 */
export function gainToDecibels(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

/**
 * Convert decibels to linear gain
 * @param db - Gain in decibels
 * @returns Linear gain value
 */
export function decibelsToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Generate a distortion curve for WaveShaperNode
 * @param amount - Distortion amount (0-1)
 * @param samples - Number of samples in curve (default 4096)
 * @returns Float32Array curve
 */
export function makeDistortionCurve(
  amount: number,
  samples: number = 4096
): Float32Array {
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  const k = amount * 100;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }

  return curve;
}

/**
 * Generate white noise buffer
 * @param context - AudioContext
 * @param duration - Duration in seconds
 * @returns AudioBuffer containing white noise
 */
export function generateWhiteNoise(
  context: AudioContext,
  duration: number
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

/**
 * Generate pink noise buffer (using simple filtering)
 * @param context - AudioContext
 * @param duration - Duration in seconds
 * @returns AudioBuffer containing pink noise
 */
export function generatePinkNoise(
  context: AudioContext,
  duration: number
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Pink noise generation using Paul Kellet's algorithm
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const sample = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    data[i] = sample * 0.11; // Adjust gain
    b6 = white * 0.115926;
  }

  return buffer;
}

/**
 * Create an exponential ramp curve for envelopes
 * @param startValue - Starting value
 * @param endValue - Ending value
 * @param duration - Duration in seconds
 * @param currentTime - Current audio context time
 * @param param - AudioParam to ramp
 */
export function exponentialRampToValue(
  param: AudioParam,
  startValue: number,
  endValue: number,
  currentTime: number,
  duration: number
): void {
  // Ensure we don't try to ramp to/from 0 (exponential ramp limitation)
  const safeStartValue = startValue === 0 ? 0.0001 : startValue;
  const safeEndValue = endValue === 0 ? 0.0001 : endValue;

  param.setValueAtTime(safeStartValue, currentTime);
  param.exponentialRampToValueAtTime(safeEndValue, currentTime + duration);
}

/**
 * Map a value from one range to another
 * @param value - Input value
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @returns Mapped value
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Get note name from MIDI note number
 * @param midiNote - MIDI note number
 * @returns Note name (e.g., "C4", "A#3")
 */
export function midiNoteToName(midiNote: number): string {
  const noteNames = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
}
