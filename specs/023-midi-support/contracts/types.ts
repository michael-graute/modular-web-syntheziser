// Contract types for feature 023-midi-support
// These are the canonical TypeScript interfaces to be added to src/core/types.ts

/**
 * Persistent CC-to-parameter binding stored inside PatchData.
 * Uniquely identified by (componentId, parameterName).
 */
export interface MidiMapping {
  componentId: string;
  parameterName: string;
  /** MIDI channel 0–15; 0 means omni (accept on any channel) */
  channel: number;
  /** CC number 0–127 */
  cc: number;
  /** Parameter's minimum value — used for linear scaling */
  minValue: number;
  /** Parameter's maximum value — used for linear scaling */
  maxValue: number;
}

/**
 * Transient state held during a MIDI Learn session.
 * Never serialised; discarded on page reload or cancel.
 */
export interface MidiLearnSession {
  componentId: string;
  parameterName: string;
}

/**
 * Runtime representation of a connected MIDI input device.
 * Not persisted in PatchData.
 */
export interface MidiDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
}

// ─── EventType additions ────────────────────────────────────────────────────
// The following string values are to be added to the EventType enum in types.ts.
// Listed here as a const for contract reference.

export const MIDI_EVENTS = {
  MIDI_DEVICE_CONNECTED: 'MIDI_DEVICE_CONNECTED',
  MIDI_DEVICE_DISCONNECTED: 'MIDI_DEVICE_DISCONNECTED',
  MIDI_LEARN_STARTED: 'MIDI_LEARN_STARTED',
  MIDI_LEARN_COMPLETED: 'MIDI_LEARN_COMPLETED',
  MIDI_LEARN_CANCELLED: 'MIDI_LEARN_CANCELLED',
  MIDI_MAPPINGS_CHANGED: 'MIDI_MAPPINGS_CHANGED',
} as const;

// ─── PatchData extension ─────────────────────────────────────────────────────
// Add this optional field to the existing PatchData interface in types.ts:
//
//   midiMappings?: MidiMapping[];
//
// Absence of this field in legacy patches is treated as [].

// ─── EventBus payload shapes ─────────────────────────────────────────────────

export interface MidiDeviceConnectedPayload {
  deviceName: string;
}

export interface MidiDeviceDisconnectedPayload {
  deviceName: string;
}

export interface MidiLearnStartedPayload {
  componentId: string;
  parameterName: string;
}

export interface MidiLearnCompletedPayload {
  mapping: MidiMapping;
}

// MIDI_LEARN_CANCELLED and MIDI_MAPPINGS_CHANGED carry no payload ({}).
