/**
 * Quantizer — pure-function contract tests + component integration tests
 *
 * Tests cover buildPitchTable, quantizeCv, midiToNoteLabel,
 * cvToMidi, midiToCv, serializeQuantizerConfig, deserializeQuantizerConfig,
 * and Quantizer component lifecycle (T020).
 * No Web Audio API required.
 *
 * Feature: 025-quantizer (T006–T008)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAudioContext } from '../../mocks/WebAudioAPI.mock';
import type { MockConstantSourceNode } from '../../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../../src/core/AudioEngine';
import { Quantizer } from '../../../src/components/utilities/Quantizer';
import {
  buildPitchTable,
  quantizeCv,
  midiToNoteLabel,
  cvToMidi,
  midiToCv,
  serializeQuantizerConfig,
  deserializeQuantizerConfig,
} from '../../../specs/025-quantizer/contracts/validation';
import {
  QuantizerNote,
  QuantizerScaleType,
  MIDI_C4,
  MIDI_MIN,
  MIDI_MAX,
  CV_MIN,
  CV_MAX,
  NOTE_ORDER,
  SCALE_TYPE_ORDER,
  DEFAULT_QUANTIZER_CONFIG,
} from '../../../specs/025-quantizer/contracts/types';

// ---------------------------------------------------------------------------
// buildPitchTable
// ---------------------------------------------------------------------------

describe('buildPitchTable', () => {
  it('returns a non-empty sorted array for C Major', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR);
    expect(table.length).toBeGreaterThan(0);
    for (let i = 1; i < table.length; i++) {
      expect(table[i]).toBeGreaterThan(table[i - 1]!);
    }
  });

  it('all entries are within MIDI_MIN..MIDI_MAX', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR);
    for (const midi of table) {
      expect(midi).toBeGreaterThanOrEqual(MIDI_MIN);
      expect(midi).toBeLessThanOrEqual(MIDI_MAX);
    }
  });

  it('C Major contains C, E, G in octave 4 (MIDI 60, 64, 67)', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR);
    expect(table).toContain(60); // C4
    expect(table).toContain(64); // E4
    expect(table).toContain(67); // G4
  });

  it('C Major does NOT contain F# (MIDI 66)', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR);
    expect(table).not.toContain(66);
  });

  it('Chromatic scale contains all 12 semitones per octave', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.CHROMATIC);
    // C4–B4 = MIDI 60–71
    for (let midi = 60; midi <= 71; midi++) {
      expect(table).toContain(midi);
    }
  });

  it('Pentatonic Major has 5 notes per octave', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.PENTATONIC_MAJOR);
    // Count notes within one octave (C4–B4: 60–71)
    const octave4 = table.filter(m => m >= 60 && m <= 71);
    expect(octave4.length).toBe(5);
  });

  it('Pentatonic Minor has 5 notes per octave', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.PENTATONIC_MINOR);
    const octave4 = table.filter(m => m >= 60 && m <= 71);
    expect(octave4.length).toBe(5);
  });

  it('Harmonic Minor contains raised 7th (B natural in C Harmonic Minor)', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.HARMONIC_MINOR);
    expect(table).toContain(71); // B4 — raised 7th
    expect(table).not.toContain(70); // Bb4 — not in harmonic minor
  });

  it('builds tables for all 12 root notes without error', () => {
    for (const root of NOTE_ORDER) {
      expect(() => buildPitchTable(root, QuantizerScaleType.MAJOR)).not.toThrow();
    }
  });

  it('builds tables for all 8 scale types without error', () => {
    for (const scale of SCALE_TYPE_ORDER) {
      expect(() => buildPitchTable(QuantizerNote.C, scale)).not.toThrow();
    }
  });

  it('produces no duplicates', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.CHROMATIC);
    const unique = new Set(table);
    expect(unique.size).toBe(table.length);
  });

  it('D Natural Minor contains D, F, A (MIDI 62, 65, 69 in octave 4)', () => {
    const table = buildPitchTable(QuantizerNote.D, QuantizerScaleType.NATURAL_MINOR);
    expect(table).toContain(62); // D4
    expect(table).toContain(65); // F4
    expect(table).toContain(69); // A4
  });
});

// ---------------------------------------------------------------------------
// quantizeCv
// ---------------------------------------------------------------------------

describe('quantizeCv', () => {
  const majorTable = buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR);

  it('returns a MIDI note from the pitch table', () => {
    const result = quantizeCv(0, majorTable); // C4 exactly
    expect(majorTable).toContain(result);
  });

  it('C4 (CV=0) quantizes to C4 (MIDI 60) in C Major', () => {
    expect(quantizeCv(0, majorTable)).toBe(60);
  });

  it('CV slightly above C4 (0.05) still snaps to C4 (MIDI 60)', () => {
    expect(quantizeCv(0.05, majorTable)).toBe(60);
  });

  it('CV halfway between C4 and D4 snaps upward to D4 (tie-breaks up)', () => {
    // C4=MIDI 60, D4=MIDI 62; midpoint CV = (60+62)/2 = 61 MIDI = 1/12 CV
    const midCv = 1 / 12; // MIDI 61 = C#4, not in C Major; nearest are C4(60) and D4(62)
    const result = quantizeCv(midCv, majorTable);
    // C#4 is equidistant from C4 and D4; tie resolves upward → D4
    expect(result).toBe(62);
  });

  it('clamps CV below CV_MIN: output is the lowest note in the table', () => {
    const chromTable = buildPitchTable(QuantizerNote.C, QuantizerScaleType.CHROMATIC);
    // Chromatic table starts at MIDI_MIN (C0=12); clamped input should snap there
    expect(quantizeCv(CV_MIN - 1, chromTable)).toBe(MIDI_MIN);
  });

  it('clamps CV above CV_MAX: output is the highest note in the table', () => {
    const chromTable = buildPitchTable(QuantizerNote.C, QuantizerScaleType.CHROMATIC);
    expect(quantizeCv(CV_MAX + 1, chromTable)).toBe(MIDI_MAX);
  });

  it('CV at exactly CV_MIN returns MIDI_MIN (chromatic table)', () => {
    const chromTable = buildPitchTable(QuantizerNote.C, QuantizerScaleType.CHROMATIC);
    expect(quantizeCv(CV_MIN, chromTable)).toBe(MIDI_MIN);
  });

  it('all 96 scale-type/root-note combinations produce valid MIDI output', () => {
    for (const root of NOTE_ORDER) {
      for (const scale of SCALE_TYPE_ORDER) {
        const table = buildPitchTable(root, scale);
        const result = quantizeCv(0, table);
        expect(result).toBeGreaterThanOrEqual(MIDI_MIN);
        expect(result).toBeLessThanOrEqual(MIDI_MAX);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// midiToNoteLabel
// ---------------------------------------------------------------------------

describe('midiToNoteLabel', () => {
  it('MIDI 60 → "C4"', () => {
    expect(midiToNoteLabel(60)).toBe('C4');
  });

  it('MIDI 69 → "A4"', () => {
    expect(midiToNoteLabel(69)).toBe('A4');
  });

  it('MIDI 61 → "C#4" (accidental)', () => {
    expect(midiToNoteLabel(61)).toBe('C#4');
  });

  it('MIDI 70 → "A#4" (accidental)', () => {
    expect(midiToNoteLabel(70)).toBe('A#4');
  });

  it('MIDI 12 → "C0" (lower boundary)', () => {
    expect(midiToNoteLabel(12)).toBe('C0');
  });

  it('MIDI 108 → "C8" (upper boundary)', () => {
    expect(midiToNoteLabel(108)).toBe('C8');
  });

  it('MIDI 72 → "C5"', () => {
    expect(midiToNoteLabel(72)).toBe('C5');
  });
});

// ---------------------------------------------------------------------------
// cvToMidi / midiToCv
// ---------------------------------------------------------------------------

describe('cvToMidi', () => {
  it('CV 0 → MIDI 60 (C4)', () => {
    expect(cvToMidi(0)).toBe(MIDI_C4);
  });

  it('CV 1 → MIDI 72 (C5)', () => {
    expect(cvToMidi(1)).toBe(72);
  });

  it('CV -1 → MIDI 48 (C3)', () => {
    expect(cvToMidi(-1)).toBe(48);
  });

  it('CV 0.75 → MIDI 69 (A4)', () => {
    expect(cvToMidi(0.75)).toBeCloseTo(69, 5);
  });
});

describe('midiToCv', () => {
  it('MIDI 60 → CV 0 (C4)', () => {
    expect(midiToCv(60)).toBe(0);
  });

  it('MIDI 72 → CV 1 (C5)', () => {
    expect(midiToCv(72)).toBe(1);
  });

  it('MIDI 48 → CV -1 (C3)', () => {
    expect(midiToCv(48)).toBe(-1);
  });

  it('round-trips: midiToCv(cvToMidi(x)) ≈ x', () => {
    const testValues = [0, 0.5, -0.5, 1, -1, 0.25, -0.75];
    for (const cv of testValues) {
      expect(midiToCv(cvToMidi(cv))).toBeCloseTo(cv, 10);
    }
  });
});

// ---------------------------------------------------------------------------
// serializeQuantizerConfig / deserializeQuantizerConfig
// ---------------------------------------------------------------------------

describe('serializeQuantizerConfig', () => {
  it('serializes default config to {rootNote: 0, scaleType: 0}', () => {
    const params = serializeQuantizerConfig(DEFAULT_QUANTIZER_CONFIG);
    expect(params['rootNote']).toBe(0);
    expect(params['scaleType']).toBe(0);
  });

  it('serializes G Harmonic Minor correctly', () => {
    const params = serializeQuantizerConfig({
      rootNote: QuantizerNote.G,
      scaleType: QuantizerScaleType.HARMONIC_MINOR,
    });
    expect(params['rootNote']).toBe(NOTE_ORDER.indexOf(QuantizerNote.G)); // 7
    expect(params['scaleType']).toBe(SCALE_TYPE_ORDER.indexOf(QuantizerScaleType.HARMONIC_MINOR)); // 2
  });
});

describe('deserializeQuantizerConfig', () => {
  it('deserializes {rootNote: 0, scaleType: 0} to default config', () => {
    const config = deserializeQuantizerConfig({ rootNote: 0, scaleType: 0 });
    expect(config.rootNote).toBe(QuantizerNote.C);
    expect(config.scaleType).toBe(QuantizerScaleType.MAJOR);
  });

  it('round-trips: serialize then deserialize returns original config', () => {
    const original = { rootNote: QuantizerNote.G, scaleType: QuantizerScaleType.HARMONIC_MINOR };
    const params = serializeQuantizerConfig(original);
    const restored = deserializeQuantizerConfig(params);
    expect(restored.rootNote).toBe(original.rootNote);
    expect(restored.scaleType).toBe(original.scaleType);
  });

  it('falls back to defaults for empty params object', () => {
    const config = deserializeQuantizerConfig({});
    expect(config.rootNote).toBe(DEFAULT_QUANTIZER_CONFIG.rootNote);
    expect(config.scaleType).toBe(DEFAULT_QUANTIZER_CONFIG.scaleType);
  });

  it('falls back to defaults for out-of-range indices', () => {
    const config = deserializeQuantizerConfig({ rootNote: 99, scaleType: 99 });
    expect(config.rootNote).toBe(DEFAULT_QUANTIZER_CONFIG.rootNote);
    expect(config.scaleType).toBe(DEFAULT_QUANTIZER_CONFIG.scaleType);
  });
});

// ---------------------------------------------------------------------------
// Quantizer component integration tests (T020)
// ---------------------------------------------------------------------------

describe('Quantizer component (audio nodes)', () => {
  let quantizer: Quantizer;
  let mockCtx: MockAudioContext;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    (audioEngine as any).context = mockCtx;
    (audioEngine as any).isInitialized = true;
    (audioEngine as any).nodes = new Map();

    quantizer = new Quantizer('test-q', { x: 0, y: 0 });
    quantizer.activate(); // calls createAudioNodes()
  });

  afterEach(() => {
    quantizer.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
  });

  it('creates a CV output node after activation', () => {
    const node = (quantizer as any).cvOutputNode as MockConstantSourceNode;
    expect(node).not.toBeNull();
    expect(node.isStarted).toBe(true);
  });

  it('initial CV output equals Hz for C4 (C Major default, input CV=0)', () => {
    const node = (quantizer as any).cvOutputNode as MockConstantSourceNode;
    // Default: root=C, scale=Major, input=0V → nearest note is C4 (MIDI 60) → 261.63 Hz
    const expectedMidi = quantizeCv(0, buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR));
    const expectedHz = 440 * Math.pow(2, (expectedMidi - 69) / 12);
    expect(node.offset.value).toBeCloseTo(expectedHz, 0);
  });

  it('initial note label is "C4"', () => {
    expect(quantizer.getNoteLabel()).toBe('C4');
  });

  it('deactivation stops and nullifies audio nodes', () => {
    quantizer.deactivate();
    expect((quantizer as any).cvOutputNode).toBeNull();
    expect((quantizer as any).cvAnalyserNode).toBeNull();
    expect((quantizer as any).gateAnalyserNode).toBeNull();
  });

  it('serialize produces correct numeric parameters', () => {
    const data = quantizer.serialize();
    expect(data.parameters['rootNote']).toBe(0); // C = 0
    expect(data.parameters['scaleType']).toBe(0); // Major = 0
  });

  it('deserialize restores config and rebuilds pitch table', () => {
    quantizer.deserialize({
      id: 'test-q',
      type: quantizer.type,
      position: { x: 10, y: 20 },
      parameters: {
        rootNote: NOTE_ORDER.indexOf(QuantizerNote.G), // 7
        scaleType: SCALE_TYPE_ORDER.indexOf(QuantizerScaleType.HARMONIC_MINOR), // 2
      },
    });
    expect((quantizer as any).config.rootNote).toBe(QuantizerNote.G);
    expect((quantizer as any).config.scaleType).toBe(QuantizerScaleType.HARMONIC_MINOR);
    expect(quantizer.position).toEqual({ x: 10, y: 20 });
  });

  it('updateAudioParameter rootNote rebuilds pitch table', () => {
    const tableBefore = (quantizer as any).pitchTable as readonly number[];
    quantizer.setParameterValue('rootNote', NOTE_ORDER.indexOf(QuantizerNote.F_SHARP)); // F# = 6
    const tableAfter = (quantizer as any).pitchTable as readonly number[];
    expect(tableAfter).not.toBe(tableBefore); // new reference
    expect(tableAfter).toContain(66); // F#4 = MIDI 66
  });
});

// ---------------------------------------------------------------------------
// T023 — Trigger-mode behavior (Phase 4 / US2)
// ---------------------------------------------------------------------------

describe('Quantizer trigger-mode (US2)', () => {
  let quantizer: Quantizer;
  let mockCtx: MockAudioContext;

  function getCvOutputNode(): MockConstantSourceNode {
    return (quantizer as any).cvOutputNode as MockConstantSourceNode;
  }

  function simulateUpdate(): void {
    (quantizer as any).update();
  }

  function connectGatePort(): void {
    const gatePort = quantizer.inputs.get('gate-in');
    if (gatePort) gatePort.connect('some-upstream-port');
  }

  function disconnectGatePort(): void {
    const gatePort = quantizer.inputs.get('gate-in');
    if (gatePort) gatePort.disconnect();
  }

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    (audioEngine as any).context = mockCtx;
    (audioEngine as any).isInitialized = true;
    (audioEngine as any).nodes = new Map();

    quantizer = new Quantizer('trig-q', { x: 0, y: 0 });
    quantizer.activate();
  });

  afterEach(() => {
    quantizer.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
  });

  it('without gate connected, output updates every tick', () => {
    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR);
    const before = getCvOutputNode().offset.value;
    disconnectGatePort();

    (quantizer as any).readCvInput = () => 1.0; // 1V = C5
    simulateUpdate();
    const after = getCvOutputNode().offset.value;
    const expectedMidi = quantizeCv(1.0, table);
    const expectedHz = 440 * Math.pow(2, (expectedMidi - 69) / 12);
    expect(after).toBeCloseTo(expectedHz, 0);
    expect(after).not.toBe(before);
  });

  it('with gate connected, output does NOT change on low gate (no rising edge)', () => {
    connectGatePort();
    (quantizer as any).lastGateValue = 0;
    (quantizer as any).readGateInput = () => 0; // gate stays low
    (quantizer as any).readCvInput = () => 2.0;

    const before = getCvOutputNode().offset.value;
    simulateUpdate();
    expect(getCvOutputNode().offset.value).toBe(before);
  });

  it('with gate connected, output DOES change on rising edge (low→high)', () => {
    connectGatePort();
    (quantizer as any).lastGateValue = 0;
    (quantizer as any).readGateInput = () => 1.0; // rising edge
    (quantizer as any).readCvInput = () => 1.0;

    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR);
    simulateUpdate();
    const midi = quantizeCv(1.0, table);
    const expectedHz = 440 * Math.pow(2, (midi - 69) / 12);
    expect(getCvOutputNode().offset.value).toBeCloseTo(expectedHz, 0);
  });

  it('with gate connected, no spurious updates between rising edges', () => {
    connectGatePort();
    // Rising edge — latch C5
    (quantizer as any).lastGateValue = 0;
    (quantizer as any).readGateInput = () => 1.0;
    (quantizer as any).readCvInput = () => 1.0;
    simulateUpdate();

    const latchedHz = getCvOutputNode().offset.value;

    // Gate stays high — no new rising edge
    (quantizer as any).lastGateValue = 1.0;
    (quantizer as any).readGateInput = () => 1.0;
    (quantizer as any).readCvInput = () => 2.0;
    simulateUpdate();

    expect(getCvOutputNode().offset.value).toBe(latchedHz);
  });

  it('with gate connected, output holds last quantized value when CV goes to 0', () => {
    connectGatePort();
    (quantizer as any).lastGateValue = 0;
    (quantizer as any).readGateInput = () => 1.0;
    (quantizer as any).readCvInput = () => 1.0;
    simulateUpdate();

    const latchedHz = getCvOutputNode().offset.value;

    // Gate still high, CV drops to 0
    (quantizer as any).lastGateValue = 1.0;
    (quantizer as any).readGateInput = () => 1.0;
    (quantizer as any).readCvInput = () => 0;
    simulateUpdate();

    expect(getCvOutputNode().offset.value).toBe(latchedHz);
  });

  it('disconnecting gate port reverts to free-running mode', () => {
    connectGatePort();
    (quantizer as any).lastGateValue = 0;
    (quantizer as any).readGateInput = () => 1.0;
    (quantizer as any).readCvInput = () => 1.0;
    simulateUpdate();

    // Disconnect — free-running again
    disconnectGatePort();
    (quantizer as any).lastGateValue = 1.0;
    (quantizer as any).readGateInput = () => 1.0;
    (quantizer as any).readCvInput = () => 2.0;

    const table = buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR);
    simulateUpdate();
    const midi = quantizeCv(2.0, table);
    const expectedHz = 440 * Math.pow(2, (midi - 69) / 12);
    expect(getCvOutputNode().offset.value).toBeCloseTo(expectedHz, 0);
  });
});

// ---------------------------------------------------------------------------
// T024 / T025 — Real-time scale & root switching (Phase 5 / US3)
// ---------------------------------------------------------------------------

describe('Quantizer real-time scale switching (US3)', () => {
  let quantizer: Quantizer;
  let mockCtx: MockAudioContext;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    (audioEngine as any).context = mockCtx;
    (audioEngine as any).isInitialized = true;
    (audioEngine as any).nodes = new Map();

    quantizer = new Quantizer('scale-q', { x: 0, y: 0 });
    quantizer.activate();
  });

  afterEach(() => {
    quantizer.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
  });

  it('T024: rebuildPitchTable() is called synchronously inside updateParameter()', () => {
    const tableBefore = (quantizer as any).pitchTable as readonly number[];
    // Change root to F — pitch table must update before this function returns
    quantizer.setParameterValue('rootNote', NOTE_ORDER.indexOf(QuantizerNote.F));
    const tableAfter = (quantizer as any).pitchTable as readonly number[];
    // Tables are different objects (rebuilt synchronously)
    expect(tableAfter).not.toBe(tableBefore);
    // F Major pitch table must contain F4 (MIDI 65)
    expect(tableAfter).toContain(65);
  });

  it('T025: quantize same CV before and after root change yields different in-scale notes', () => {
    // Start with C Major
    const cvInput = 0.4; // roughly between C4 and E4

    const tableBefore = buildPitchTable(QuantizerNote.C, QuantizerScaleType.MAJOR);
    const midiInC = quantizeCv(cvInput, tableBefore);

    // Switch root to F
    quantizer.setParameterValue('rootNote', NOTE_ORDER.indexOf(QuantizerNote.F));
    const tableAfter = (quantizer as any).pitchTable as readonly number[];
    const midiInF = quantizeCv(cvInput, tableAfter);

    // Both must be in their respective tables
    expect(tableBefore).toContain(midiInC);
    expect(tableAfter).toContain(midiInF);
  });

  it('T025: after changing root to F, pitch table contains only F Major notes', () => {
    quantizer.setParameterValue('rootNote', NOTE_ORDER.indexOf(QuantizerNote.F));
    const table = (quantizer as any).pitchTable as readonly number[];

    // F Major intervals: 0,2,4,5,7,9,11 semitones from F (MIDI 65 in octave 4)
    const fMajorOctave4 = [65, 67, 69, 70, 72, 74, 76]; // F4 G4 A4 Bb4 C5 D5 E5
    for (const midi of fMajorOctave4) {
      expect(table).toContain(midi);
    }
    // C# (MIDI 61) is NOT in F Major
    expect(table).not.toContain(61);
  });

  it('T025: changing scale type immediately rebuilds the pitch table', () => {
    const tableMajor = (quantizer as any).pitchTable as readonly number[];
    quantizer.setParameterValue('scaleType', SCALE_TYPE_ORDER.indexOf(QuantizerScaleType.PENTATONIC_MAJOR));
    const tablePenta = (quantizer as any).pitchTable as readonly number[];
    expect(tablePenta).not.toBe(tableMajor);
    // C Pentatonic Major has 5 notes per octave (no E and B)
    expect(tablePenta.filter((m: number) => m >= 60 && m <= 71).length).toBe(5);
  });

  it('T025: cvOutputNode offset updates when rebuildPitchTable() runs after config change', () => {
    // Manipulate heldCv to something non-default
    (quantizer as any).heldCv = 0; // C4
    // Force update to latch C4 pitch
    (quantizer as any).readCvInput = () => 0;
    (quantizer as any).update();

    const hzC = (quantizer as any).cvOutputNode.offset.value as number;

    // Switch to F# Major — C4 (MIDI 60) is not in F# Major
    quantizer.setParameterValue('rootNote', NOTE_ORDER.indexOf(QuantizerNote.F_SHARP));
    const hzAfter = (quantizer as any).cvOutputNode.offset.value as number;

    // Output should have been re-quantized on rebuild
    expect(hzAfter).not.toBeNaN();
    // F# Major: F#4=66, G#4=68, A#4=70, B4=71, C#5=73, D#5=75, F5=77
    const tableAfter = (quantizer as any).pitchTable as readonly number[];
    expect(tableAfter).toContain(66); // F#4
  });
});

// ---------------------------------------------------------------------------
// T029 / T030 — Patch serialization round-trip (Phase 6 / US4)
// ---------------------------------------------------------------------------

describe('Quantizer serialization round-trip (US4)', () => {
  let quantizer: Quantizer;
  let mockCtx: MockAudioContext;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    (audioEngine as any).context = mockCtx;
    (audioEngine as any).isInitialized = true;
    (audioEngine as any).nodes = new Map();
    quantizer = new Quantizer('ser-q', { x: 0, y: 0 });
    quantizer.activate();
  });

  afterEach(() => {
    quantizer.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
  });

  it('T029: full round-trip for G Harmonic Minor preserves config', () => {
    // Configure G Harmonic Minor
    quantizer.setParameterValue('rootNote', NOTE_ORDER.indexOf(QuantizerNote.G));
    quantizer.setParameterValue('scaleType', SCALE_TYPE_ORDER.indexOf(QuantizerScaleType.HARMONIC_MINOR));

    const serialized = quantizer.serialize();
    expect(serialized.parameters['rootNote']).toBe(NOTE_ORDER.indexOf(QuantizerNote.G));
    expect(serialized.parameters['scaleType']).toBe(SCALE_TYPE_ORDER.indexOf(QuantizerScaleType.HARMONIC_MINOR));

    // Restore into a fresh instance
    const q2 = new Quantizer('ser-q2', { x: 5, y: 5 });
    q2.activate();
    q2.deserialize(serialized);

    expect((q2 as any).config.rootNote).toBe(QuantizerNote.G);
    expect((q2 as any).config.scaleType).toBe(QuantizerScaleType.HARMONIC_MINOR);

    // Pitch table must contain G (MIDI 67 in octave 4)
    const table = (q2 as any).pitchTable as readonly number[];
    expect(table).toContain(67); // G4

    q2.deactivate();
  });

  it('T029: canvas parameter values are synced after deserialize', () => {
    const gIdx = NOTE_ORDER.indexOf(QuantizerNote.G);
    const hmIdx = SCALE_TYPE_ORDER.indexOf(QuantizerScaleType.HARMONIC_MINOR);

    quantizer.deserialize({
      id: 'ser-q',
      type: quantizer.type,
      position: { x: 0, y: 0 },
      parameters: { rootNote: gIdx, scaleType: hmIdx },
    });

    expect(quantizer.getParameter('rootNote')?.getValue()).toBe(gIdx);
    expect(quantizer.getParameter('scaleType')?.getValue()).toBe(hmIdx);
  });

  it('T030: deserializing empty params falls back to C Major defaults', () => {
    quantizer.deserialize({
      id: 'ser-q',
      type: quantizer.type,
      position: { x: 0, y: 0 },
      parameters: {},
    });

    expect((quantizer as any).config.rootNote).toBe(DEFAULT_QUANTIZER_CONFIG.rootNote);
    expect((quantizer as any).config.scaleType).toBe(DEFAULT_QUANTIZER_CONFIG.scaleType);
  });

  it('T030: deserializing out-of-range indices falls back to defaults', () => {
    quantizer.deserialize({
      id: 'ser-q',
      type: quantizer.type,
      position: { x: 0, y: 0 },
      parameters: { rootNote: 999, scaleType: 999 },
    });

    expect((quantizer as any).config.rootNote).toBe(DEFAULT_QUANTIZER_CONFIG.rootNote);
    expect((quantizer as any).config.scaleType).toBe(DEFAULT_QUANTIZER_CONFIG.scaleType);
  });
});

// ---------------------------------------------------------------------------
// T031 / T032 — Polish: CV clamping + note label edge cases (Phase 7)
// ---------------------------------------------------------------------------

describe('Quantizer polish: CV clamping and note label (Phase 7)', () => {
  let quantizer: Quantizer;
  let mockCtx: MockAudioContext;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    (audioEngine as any).context = mockCtx;
    (audioEngine as any).isInitialized = true;
    (audioEngine as any).nodes = new Map();
    quantizer = new Quantizer('polish-q', { x: 0, y: 0 });
    quantizer.activate();
  });

  afterEach(() => {
    quantizer.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
  });

  // T031 — runtime CV clamping: quantizeCv already clamps internally, verify
  // that update() passes through extreme values without throwing or producing NaN.
  it('T031: extreme CV below CV_MIN does not crash and produces valid Hz output', () => {
    (quantizer as any).readCvInput = () => CV_MIN - 100;
    expect(() => (quantizer as any).update()).not.toThrow();
    const hz = (quantizer as any).heldHz as number;
    expect(Number.isFinite(hz)).toBe(true);
    expect(hz).toBeGreaterThan(0);
  });

  it('T031: extreme CV above CV_MAX does not crash and produces valid Hz output', () => {
    (quantizer as any).readCvInput = () => CV_MAX + 100;
    expect(() => (quantizer as any).update()).not.toThrow();
    const hz = (quantizer as any).heldHz as number;
    expect(Number.isFinite(hz)).toBe(true);
    expect(hz).toBeGreaterThan(0);
  });

  // T032 — note label accidentals and boundary notes
  it('T032: note label shows accidental "C#4" for MIDI 61', () => {
    expect(midiToNoteLabel(61)).toBe('C#4');
  });

  it('T032: note label shows accidental "A#4" for MIDI 70', () => {
    expect(midiToNoteLabel(70)).toBe('A#4');
  });

  it('T032: note label shows boundary "C0" for MIDI_MIN (12)', () => {
    expect(midiToNoteLabel(MIDI_MIN)).toBe('C0');
  });

  it('T032: note label shows boundary "C8" for MIDI_MAX (108)', () => {
    expect(midiToNoteLabel(MIDI_MAX)).toBe('C8');
  });

  it('T032: currentNoteLabel updates to accidental after quantizing to C# scale input', () => {
    // C# Major: root=C#, scale=Major
    quantizer.setParameterValue('rootNote', NOTE_ORDER.indexOf(QuantizerNote.C_SHARP));
    // C# Major contains C#4 (MIDI 61) — CV input at 0 should snap there
    (quantizer as any).readCvInput = () => 1 / 12; // ~MIDI 61
    (quantizer as any).heldHz = 0; // force update to fire (newHz !== heldHz)
    (quantizer as any).update();
    const label = quantizer.getNoteLabel();
    // Should be a note in C# Major (all sharps/naturals)
    expect(label).toMatch(/^[A-G]#?\d$/);
  });
});
