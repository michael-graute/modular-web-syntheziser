import type { MidiMapping } from '../core/types';

export const MIDI_CC_MIN = 0;
export const MIDI_CC_MAX = 127;

export const MIDI_CHANNEL_MIN = 0;
export const MIDI_CHANNEL_MAX = 15;

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

export function scaleCcToParam(ccValue: number, minValue: number, maxValue: number): number {
  const clamped = Math.max(MIDI_CC_MIN, Math.min(MIDI_CC_MAX, ccValue));
  return minValue + (clamped / MIDI_CC_MAX) * (maxValue - minValue);
}

export function mappingKey(componentId: string, parameterName: string): string {
  return `${componentId}:${parameterName}`;
}

export function sanitiseMidiMappings(raw: unknown): MidiMapping[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidMidiMapping);
}
