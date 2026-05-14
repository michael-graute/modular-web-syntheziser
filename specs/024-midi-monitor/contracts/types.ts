/**
 * Contract types for the MIDI Monitor feature (024-midi-monitor).
 *
 * These types are the authoritative reference for the implementation.
 * Copy them into src/core/types.ts (payload) and src/ui/MidiMonitorWindow.ts (window types).
 */

// ---------------------------------------------------------------------------
// EventBus payload — add to EventType enum in src/core/types.ts
// ---------------------------------------------------------------------------

/**
 * Emitted by MidiEngine.handleMidiMessage() for every raw MIDI message received,
 * before any CC mapping dispatch or note routing occurs.
 */
export interface MidiRawMessagePayload {
  /** Raw status byte (0x00–0xFF) */
  status: number;
  /** First data byte; 0 if the message has no data bytes */
  byte1: number;
  /** Second data byte; 0 if the message has fewer than 3 bytes */
  byte2: number;
  /** performance.now() at point of receipt */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Display model — used internally by MidiMonitorWindow
// ---------------------------------------------------------------------------

/** A single formatted row in the MIDI Monitor log. Never persisted. */
export interface MidiLogEntry {
  /** Wall-clock time string: HH:MM:SS.mmm */
  wallTime: string;
  /** Human-readable MIDI message type, e.g. "Note On", "Control Change" */
  type: string;
  /** MIDI channel as "1"–"16"; "—" for system messages */
  channel: string;
  /** Primary data value, formatted for readability (e.g. "C4 (60)" for notes) */
  data1: string;
  /** Secondary data value; empty string if unused */
  data2: string;
}

// ---------------------------------------------------------------------------
// MIDI message type label map
// ---------------------------------------------------------------------------

/** Maps decoded status nibble / full byte to a display label. */
export const MIDI_TYPE_LABELS: Record<number, string> = {
  0x80: 'Note Off',
  0x90: 'Note On',   // byte2 === 0 → treated as Note Off by MidiEngine; label here stays "Note On"
  0xa0: 'Aftertouch (Poly)',
  0xb0: 'Control Change',
  0xc0: 'Program Change',
  0xd0: 'Aftertouch (Ch)',
  0xe0: 'Pitch Bend',
  // System messages (full status byte)
  0xf0: 'SysEx',
  0xf2: 'Song Position',
  0xf3: 'Song Select',
  0xf8: 'Clock',
  0xfa: 'Start',
  0xfb: 'Continue',
  0xfc: 'Stop',
  0xff: 'Reset',
};

/** Maximum number of log entries kept in memory and rendered in the DOM. */
export const MAX_LOG_ENTRIES = 500;

// ---------------------------------------------------------------------------
// Note name helper — used for data1 formatting on Note On/Off messages
// ---------------------------------------------------------------------------

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Convert a MIDI note number (0–127) to a display string like "C4 (60)". */
export function midiNoteToName(note: number): string {
  const name = NOTE_NAMES[note % 12]!;
  const octave = Math.floor(note / 12) - 1;
  return `${name}${octave} (${note})`;
}
