/**
 * Validation and formatting helpers for MIDI Monitor log entries.
 *
 * These functions are pure (no side effects) and are 100%-testable in isolation.
 * Copy into src/ui/MidiMonitorWindow.ts or a dedicated src/midi/midiMonitorFormatters.ts.
 */

import {
  MIDI_TYPE_LABELS,
  midiNoteToName,
  type MidiLogEntry,
  type MidiRawMessagePayload,
} from './types';

/**
 * Format a wall-clock timestamp as HH:MM:SS.mmm.
 * Uses en-GB locale to guarantee 24-hour format without AM/PM.
 */
export function formatWallClock(date: Date): string {
  const hms = date.toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hms}.${ms}`;
}

/**
 * Derive the human-readable message type label from a raw status byte.
 * System messages use the full byte; channel messages use the upper nibble.
 */
export function parseMidiType(status: number): string {
  if (status >= 0xf0) {
    return MIDI_TYPE_LABELS[status] ?? 'Unknown';
  }
  const nibble = status & 0xf0;
  return MIDI_TYPE_LABELS[nibble] ?? 'Unknown';
}

/**
 * Extract the 1-based channel number for channel messages (status 0x80–0xEF).
 * Returns "—" for system messages (status >= 0xF0).
 */
export function parseMidiChannel(status: number): string {
  if (status >= 0xf0) return '—';
  return String((status & 0x0f) + 1);
}

/**
 * Format the primary data byte (byte1) based on the decoded message type.
 * Note On/Off → note name + number; CC → "CC <n>"; others → raw number string.
 */
export function formatData1(status: number, byte1: number): string {
  const nibble = status & 0xf0;
  if (nibble === 0x80 || nibble === 0x90) {
    return midiNoteToName(byte1);
  }
  if (nibble === 0xb0) {
    return `CC ${byte1}`;
  }
  if (status >= 0xf0) return '';
  return String(byte1);
}

/**
 * Format the secondary data byte (byte2) based on the decoded message type.
 * Returns empty string when byte2 is not meaningful (e.g. Program Change, system messages).
 */
export function formatData2(status: number, byte2: number): string {
  if (status >= 0xf0) return '';
  const nibble = status & 0xf0;
  // Messages with only one data byte
  if (nibble === 0xc0 || nibble === 0xd0) return '';
  return String(byte2);
}

/**
 * Convert a raw MidiRawMessagePayload into a displayable MidiLogEntry.
 * Captures the current wall-clock time at call time.
 */
export function formatMidiLogEntry(payload: MidiRawMessagePayload): MidiLogEntry {
  const { status, byte1, byte2 } = payload;
  return {
    wallTime: formatWallClock(new Date()),
    type: parseMidiType(status),
    channel: parseMidiChannel(status),
    data1: formatData1(status, byte1),
    data2: formatData2(status, byte2),
  };
}
