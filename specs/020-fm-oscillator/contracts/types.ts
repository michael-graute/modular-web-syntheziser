// Contracts for feature 020-fm-oscillator
// These types describe the shape of FM oscillator data; they are NOT imported at runtime.

/** All parameter IDs available on an FMOscillator (inherited + new). */
export type FMOscillatorParameterId =
  | 'waveform'   // inherited from Oscillator
  | 'frequency'  // inherited
  | 'detune'     // inherited
  | 'fmDepth';   // new: frequency deviation range in Hz (0–1000)

/** Input port IDs for FMOscillator. */
export type FMOscillatorInputId =
  | 'frequency'  // inherited: CV frequency modulation
  | 'detune'     // inherited: CV detune modulation
  | 'fm';        // new: audio-rate FM modulator input

/** Audio node keys registered by FMOscillator. */
export type FMOscillatorAudioNodeKey =
  | 'oscillator'  // inherited from Oscillator
  | 'fmInput';    // the GainNode that scales FM modulation depth

/** Configuration snapshot for FM Depth (used in serialisation validation). */
export interface FMOscillatorConfig {
  /** FM modulation depth in Hz. Range: 0–1000. */
  fmDepth: number;
}
