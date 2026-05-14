import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatWallClock,
  parseMidiType,
  parseMidiChannel,
  midiNoteToName,
  formatData1,
  formatData2,
  MidiMonitorWindow,
} from '../../src/ui/MidiMonitorWindow';
import type { MidiRawMessagePayload } from '../../src/core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayload(status: number, byte1 = 0, byte2 = 0): MidiRawMessagePayload {
  return { status, byte1, byte2, timestamp: 0 };
}

function makeWindow(): MidiMonitorWindow {
  return new MidiMonitorWindow();
}

// ---------------------------------------------------------------------------
// T015: formatWallClock — HH:MM:SS.mmm format
// ---------------------------------------------------------------------------

describe('formatWallClock', () => {
  it('outputs HH:MM:SS.mmm format', () => {
    const date = new Date('2024-01-01T14:05:03.042Z');
    // Use a fixed date to avoid timezone issues; just verify structure
    const result = formatWallClock(date);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('zero-pads milliseconds to 3 digits', () => {
    // Create a date with known ms via manipulation
    const date = new Date(0);
    const result = formatWallClock(date);
    // ms portion must be exactly 3 digits
    const msPart = result.split('.')[1];
    expect(msPart).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// T016: parseMidiType
// ---------------------------------------------------------------------------

describe('parseMidiType', () => {
  it('returns "Note On" for 0x90', () => {
    expect(parseMidiType(0x90)).toBe('Note On');
  });

  it('returns "Note On" for 0x9F (ch 16)', () => {
    expect(parseMidiType(0x9f)).toBe('Note On');
  });

  it('returns "Clock" for 0xF8 (system message)', () => {
    expect(parseMidiType(0xf8)).toBe('Clock');
  });

  it('returns "Note Off" for 0x80', () => {
    expect(parseMidiType(0x80)).toBe('Note Off');
  });

  it('returns "Control Change" for 0xB0', () => {
    expect(parseMidiType(0xb0)).toBe('Control Change');
  });

  it('returns "Unknown" for an unrecognised status byte', () => {
    expect(parseMidiType(0x01)).toBe('Unknown');
  });
});

// ---------------------------------------------------------------------------
// T017: parseMidiChannel
// ---------------------------------------------------------------------------

describe('parseMidiChannel', () => {
  it('returns "1" for 0x90 (channel message, channel 0 → display 1)', () => {
    expect(parseMidiChannel(0x90)).toBe('1');
  });

  it('returns "16" for 0x9F (channel 15 → display 16)', () => {
    expect(parseMidiChannel(0x9f)).toBe('16');
  });

  it('returns "—" for 0xF8 (system message)', () => {
    expect(parseMidiChannel(0xf8)).toBe('—');
  });

  it('returns "—" for 0xFF (system reset)', () => {
    expect(parseMidiChannel(0xff)).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// T018: midiNoteToName
// ---------------------------------------------------------------------------

describe('midiNoteToName', () => {
  it('returns "C4 (60)" for MIDI note 60', () => {
    expect(midiNoteToName(60)).toBe('C4 (60)');
  });

  it('returns "A4 (69)" for MIDI note 69', () => {
    expect(midiNoteToName(69)).toBe('A4 (69)');
  });

  it('returns "C-1 (0)" for MIDI note 0', () => {
    expect(midiNoteToName(0)).toBe('C-1 (0)');
  });

  it('returns "G9 (127)" for MIDI note 127', () => {
    expect(midiNoteToName(127)).toBe('G9 (127)');
  });
});

// ---------------------------------------------------------------------------
// T019: formatData1 / formatData2
// ---------------------------------------------------------------------------

describe('formatData1', () => {
  it('returns note name for Note On (0x90)', () => {
    expect(formatData1(0x90, 60)).toBe('C4 (60)');
  });

  it('returns note name for Note Off (0x80)', () => {
    expect(formatData1(0x80, 69)).toBe('A4 (69)');
  });

  it('returns "CC 7" for Control Change (0xB0) byte1=7', () => {
    expect(formatData1(0xb0, 7)).toBe('CC 7');
  });

  it('returns raw number string for Pitch Bend (0xE0)', () => {
    expect(formatData1(0xe0, 64)).toBe('64');
  });

  it('returns empty string for system messages (0xF8)', () => {
    expect(formatData1(0xf8, 0)).toBe('');
  });
});

describe('formatData2', () => {
  it('returns empty string for Program Change (0xC0) — 1-byte message', () => {
    expect(formatData2(0xc0, 0)).toBe('');
  });

  it('returns empty string for Channel Aftertouch (0xD0)', () => {
    expect(formatData2(0xd0, 0)).toBe('');
  });

  it('returns empty string for system messages (0xF8)', () => {
    expect(formatData2(0xf8, 0)).toBe('');
  });

  it('returns raw number string for Note On (0x90) byte2=64', () => {
    expect(formatData2(0x90, 64)).toBe('64');
  });

  it('returns "0" for CC (0xB0) byte2=0', () => {
    expect(formatData2(0xb0, 0)).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// T020: FIFO cap — 501 calls → entries.length === 500, oldest gone
// ---------------------------------------------------------------------------

describe('MidiMonitorWindow FIFO cap', () => {
  let win: MidiMonitorWindow;

  beforeEach(() => {
    win = makeWindow();
    // Build DOM and open the window so logContainer is initialised
    win.open();
  });

  it('caps entries at 500 after 501 appendEntry calls, removing the oldest', () => {
    for (let i = 0; i < 501; i++) {
      // Use byte1 as a sequence number so we can identify oldest/newest
      win.appendEntry(makePayload(0x90, i % 128, 64));
    }

    // Access internal entries via cast
    const entries = (win as any).entries as MidiRawMessagePayload[];
    expect(entries.length).toBe(500);
    // The first entry should have byte1 = 1 (entry 0 was dropped)
    expect(entries[0]!.byte1).toBe(1);
  });

  it('caps DOM rows at 500', () => {
    for (let i = 0; i < 501; i++) {
      win.appendEntry(makePayload(0x90, 60, 64));
    }
    const logContainer = (win as any).logContainer as HTMLElement;
    expect(logContainer.children.length).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// T021: clearLog() sets entries to []
// ---------------------------------------------------------------------------

describe('MidiMonitorWindow clearLog', () => {
  let win: MidiMonitorWindow;

  beforeEach(() => {
    win = makeWindow();
    win.open();
  });

  it('sets entries to [] after clearLog()', () => {
    win.appendEntry(makePayload(0x90, 60, 64));
    win.appendEntry(makePayload(0xb0, 7, 100));
    win.clearLog();

    const entries = (win as any).entries as MidiRawMessagePayload[];
    expect(entries).toEqual([]);
  });

  it('empties the DOM log container after clearLog()', () => {
    win.appendEntry(makePayload(0x90, 60, 64));
    win.clearLog();

    const logContainer = (win as any).logContainer as HTMLElement;
    expect(logContainer.innerHTML).toBe('');
  });

  it('resets autoScroll to true after clearLog()', () => {
    (win as any).autoScroll = false;
    win.clearLog();
    expect((win as any).autoScroll).toBe(true);
  });
});
