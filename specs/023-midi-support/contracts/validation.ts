// Validation helpers for feature 023-midi-support
// These pure functions belong in MidiEngine and are unit-testable at 100% coverage.

import type { MidiMapping } from './types';

/** Valid MIDI CC range */
export const MIDI_CC_MIN = 0;
export const MIDI_CC_MAX = 127;

/** Valid MIDI channel range (0 = omni) */
export const MIDI_CHANNEL_MIN = 0;
export const MIDI_CHANNEL_MAX = 15;

/**
 * Returns true if the MidiMapping record is structurally valid.
 */
export function isValidMidiMapping(m: unknown): m is MidiMapping {
  if (!m || typeof m !== 'object') return false;
  const mapping = m as Record<string, unknown>;
  return (
    typeof mapping.componentId === 'string' && mapping.componentId.length > 0 &&
    typeof mapping.parameterName === 'string' && mapping.parameterName.length > 0 &&
    typeof mapping.channel === 'number' &&
      mapping.channel >= MIDI_CHANNEL_MIN && mapping.channel <= MIDI_CHANNEL_MAX &&
    typeof mapping.cc === 'number' &&
      mapping.cc >= MIDI_CC_MIN && mapping.cc <= MIDI_CC_MAX &&
    typeof mapping.minValue === 'number' &&
    typeof mapping.maxValue === 'number' &&
      (mapping.maxValue as number) > (mapping.minValue as number)
  );
}

/**
 * Scales a raw MIDI CC value (0–127) to the parameter's native range.
 * Pure function — no side effects.
 */
export function scaleCcToParam(ccValue: number, minValue: number, maxValue: number): number {
  const clamped = Math.max(MIDI_CC_MIN, Math.min(MIDI_CC_MAX, ccValue));
  return minValue + (clamped / MIDI_CC_MAX) * (maxValue - minValue);
}

/**
 * Returns a stable registry key for a mapping.
 * Used as the Map key in MidiEngine's internal mapping registry.
 */
export function mappingKey(componentId: string, parameterName: string): string {
  return `${componentId}:${parameterName}`;
}

/**
 * Validates and filters an array of raw MidiMapping objects loaded from patch data.
 * Invalid entries are silently dropped (backward compatibility).
 */
export function sanitiseMidiMappings(raw: unknown): MidiMapping[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidMidiMapping);
}
