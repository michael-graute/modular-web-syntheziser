/**
 * Ring Modulator — public type contracts
 */

import { ComponentType, Position } from '../../../src/core/types';

/**
 * Serialised representation of a Ring Modulator inside PatchData.components[].
 * Uses the shared ComponentData shape — no new fields required.
 */
export interface RingModulatorData {
  id: string;
  type: ComponentType.RING_MODULATOR;
  position: Position;
  /** Always an empty object — Ring Modulator has no user-adjustable parameters. */
  parameters: Record<string, never>;
  /** Present only when true; absent means active (not bypassed). */
  isBypassed?: true;
}

/**
 * Port identifiers for Ring Modulator connections.
 */
export const RING_MODULATOR_PORTS = {
  /** Carrier audio input */
  AUDIO_IN: 'audio-in',
  /** Modulator audio input */
  MODULATOR: 'modulator',
  /** Ring-modulated audio output */
  OUTPUT: 'output',
} as const;

export type RingModulatorPortId =
  (typeof RING_MODULATOR_PORTS)[keyof typeof RING_MODULATOR_PORTS];
