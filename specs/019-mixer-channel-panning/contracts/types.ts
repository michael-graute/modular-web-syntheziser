// Contracts for feature 019-mixer-channel-panning
// These types describe the shape of pan-related data; they are NOT imported at runtime.

/** Stereo pan position for a single Mixer channel. */
export interface ChannelPanConfig {
  /** Stereo position in the range [−1.0, +1.0]. 0.0 = center, −1.0 = hard left, +1.0 = hard right. */
  pan: number;
}

/** Per-channel pan parameter IDs used in SynthComponent.addParameter() / getParameter(). */
export type MixerPanParameterId = 'pan1' | 'pan2' | 'pan3' | 'pan4';

/** All Mixer parameter IDs after this feature (gain1–4, master, pan1–4). */
export type MixerParameterId =
  | 'gain1' | 'gain2' | 'gain3' | 'gain4'
  | 'master'
  | MixerPanParameterId;

/** Audio node keys registered for each Mixer channel (extended with panner). */
export type MixerAudioNodeKey =
  | 'inputGain1' | 'inputGain2' | 'inputGain3' | 'inputGain4'
  | 'channelGain1' | 'channelGain2' | 'channelGain3' | 'channelGain4'
  | 'stereoPanner1' | 'stereoPanner2' | 'stereoPanner3' | 'stereoPanner4'
  | 'outputGain';
