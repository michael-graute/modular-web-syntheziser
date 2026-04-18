/**
 * Unit tests for ChordFinder event emission (feature 014).
 *
 * Tests that pressChord() and releaseChord() emit the correct
 * CHORD_NOTES_ON / CHORD_NOTES_OFF events, that setOctave() re-emits
 * while a chord is held, and that ChordFinder works safely with zero
 * EventBus subscribers (no Keyboard module present).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChordFinder } from '../../src/components/utilities/ChordFinder';
import { EventType } from '../../src/core/types';
import type { ChordNotesOnPayload, ChordNotesOffPayload } from '../../src/core/types';
import { eventBus } from '../../src/core/EventBus';
import { audioEngine } from '../../src/core/AudioEngine';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChordFinder(id = 'cf-emit-test'): ChordFinder {
  return new ChordFinder(id, { x: 0, y: 0 });
}

function activateWithMockAudio(cf: ChordFinder): MockAudioContext {
  const mockCtx = new MockAudioContext();
  (audioEngine as unknown as Record<string, unknown>)['context'] = mockCtx;
  (audioEngine as unknown as Record<string, unknown>)['isInitialized'] = true;
  cf.activate();
  return mockCtx;
}

function deactivate(cf: ChordFinder): void {
  cf.deactivate();
  (audioEngine as unknown as Record<string, unknown>)['context'] = null;
  (audioEngine as unknown as Record<string, unknown>)['isInitialized'] = false;
  (audioEngine as unknown as Record<string, unknown>)['nodes'] = new Map();
}

// ---------------------------------------------------------------------------
// T018: Fire-and-forget — no error when no subscribers
// ---------------------------------------------------------------------------

describe('ChordFinder: no error without KeyboardController present (T018)', () => {
  let cf: ChordFinder;

  beforeEach(() => {
    cf = makeChordFinder();
    activateWithMockAudio(cf);
  });

  afterEach(() => {
    deactivate(cf);
  });

  it('pressChord does not throw when there are no CHORD_NOTES_ON subscribers', () => {
    expect(() => cf.pressChord(0)).not.toThrow();
  });

  it('releaseChord does not throw when there are no CHORD_NOTES_OFF subscribers', () => {
    cf.pressChord(0);
    expect(() => cf.releaseChord()).not.toThrow();
  });

  it('audio gate output is set to 1.0 after pressChord', () => {
    cf.pressChord(0);
    const state = cf.getState();
    expect(state.pressedDegree).toBe(0);
  });

  it('pressedDegree is null after releaseChord', () => {
    cf.pressChord(0);
    cf.releaseChord();
    expect(cf.getState().pressedDegree).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T019: CHORD_NOTES_ON emitted with correct octave-shifted MIDI notes
// ---------------------------------------------------------------------------

describe('ChordFinder: CHORD_NOTES_ON event emission', () => {
  let cf: ChordFinder;
  let receivedPayloads: ChordNotesOnPayload[];
  let unsubscribe: () => void;

  beforeEach(() => {
    cf = makeChordFinder('cf-1');
    activateWithMockAudio(cf);
    receivedPayloads = [];
    unsubscribe = eventBus.on(EventType.CHORD_NOTES_ON, (data) => {
      receivedPayloads.push(data as ChordNotesOnPayload);
    });
  });

  afterEach(() => {
    unsubscribe();
    deactivate(cf);
  });

  it('emits CHORD_NOTES_ON when pressChord is called', () => {
    cf.pressChord(0); // I chord (C Major default: C-E-G)
    expect(receivedPayloads).toHaveLength(1);
  });

  it('payload contains sourceId matching the component id', () => {
    cf.pressChord(0);
    expect(receivedPayloads[0]!.sourceId).toBe('cf-1');
  });

  it('payload notes are octave-shifted MIDI values (octave 4: C4=60, E4=64, G4=67)', () => {
    cf.pressChord(0); // C Major I chord at octave 4
    const notes = receivedPayloads[0]!.notes;
    // C Major diatonic degree 0 = C-E-G at octave 4
    expect(notes).toHaveLength(3);
    expect(notes[0]).toBe(60); // C4
    expect(notes[1]).toBe(64); // E4
    expect(notes[2]).toBe(67); // G4
  });

  it('octave shift is applied: octave 5 shifts all notes up by 12', () => {
    cf.setOctave(5);
    cf.pressChord(0);
    const notes = receivedPayloads[0]!.notes;
    expect(notes[0]).toBe(72); // C5
    expect(notes[1]).toBe(76); // E5
    expect(notes[2]).toBe(79); // G5
  });

  it('octave shift is applied: octave 3 shifts all notes down by 12', () => {
    cf.setOctave(3);
    cf.pressChord(0);
    const notes = receivedPayloads[0]!.notes;
    expect(notes[0]).toBe(48); // C3
    expect(notes[1]).toBe(52); // E3
    expect(notes[2]).toBe(55); // G3
  });

  it('pressing a new chord while one is held emits CHORD_NOTES_ON again', () => {
    cf.pressChord(0); // I
    cf.pressChord(4); // V (G-B-D in C Major)
    expect(receivedPayloads).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// CHORD_NOTES_OFF event emission
// ---------------------------------------------------------------------------

describe('ChordFinder: CHORD_NOTES_OFF event emission', () => {
  let cf: ChordFinder;
  let offPayloads: ChordNotesOffPayload[];
  let unsubscribe: () => void;

  beforeEach(() => {
    cf = makeChordFinder('cf-2');
    activateWithMockAudio(cf);
    offPayloads = [];
    unsubscribe = eventBus.on(EventType.CHORD_NOTES_OFF, (data) => {
      offPayloads.push(data as ChordNotesOffPayload);
    });
  });

  afterEach(() => {
    unsubscribe();
    deactivate(cf);
  });

  it('emits CHORD_NOTES_OFF when releaseChord is called after a press', () => {
    cf.pressChord(0);
    cf.releaseChord();
    expect(offPayloads).toHaveLength(1);
  });

  it('payload sourceId matches component id', () => {
    cf.pressChord(0);
    cf.releaseChord();
    expect(offPayloads[0]!.sourceId).toBe('cf-2');
  });

  it('CHORD_NOTES_OFF carries the same notes that were pressed', () => {
    cf.pressChord(0); // C-E-G at octave 4

    // Capture the ON payload first
    const onPayloads: ChordNotesOnPayload[] = [];
    const unsubOn = eventBus.on(EventType.CHORD_NOTES_ON, (d) => onPayloads.push(d as ChordNotesOnPayload));

    cf.pressChord(0); // press again to capture via subscriber
    cf.releaseChord();
    unsubOn();

    expect(offPayloads[0]!.notes).toEqual(onPayloads[0]!.notes);
  });

  it('does not emit CHORD_NOTES_OFF if releaseChord called without a prior press', () => {
    cf.releaseChord(); // no chord was pressed
    expect(offPayloads).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// setOctave re-emits CHORD_NOTES_ON while chord is held (T011b)
// ---------------------------------------------------------------------------

describe('ChordFinder: setOctave re-emits CHORD_NOTES_ON when chord is held', () => {
  let cf: ChordFinder;
  let onPayloads: ChordNotesOnPayload[];
  let unsubscribe: () => void;

  beforeEach(() => {
    cf = makeChordFinder('cf-3');
    activateWithMockAudio(cf);
    onPayloads = [];
    unsubscribe = eventBus.on(EventType.CHORD_NOTES_ON, (data) => {
      onPayloads.push(data as ChordNotesOnPayload);
    });
  });

  afterEach(() => {
    unsubscribe();
    deactivate(cf);
  });

  it('emits CHORD_NOTES_ON on setOctave when a chord is held', () => {
    cf.pressChord(0); // first emit
    cf.setOctave(5);  // second emit with new octave
    expect(onPayloads).toHaveLength(2);
    expect(onPayloads[1]!.notes[0]).toBe(72); // C5
  });

  it('does not emit CHORD_NOTES_ON on setOctave when no chord is held', () => {
    cf.setOctave(5);
    expect(onPayloads).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple ChordFinder instances are independent
// ---------------------------------------------------------------------------

describe('ChordFinder: multiple instances emit independent events', () => {
  it('events from two ChordFinders carry their own sourceIds', () => {
    const cf1 = makeChordFinder('cf-a');
    const cf2 = makeChordFinder('cf-b');
    activateWithMockAudio(cf1);
    activateWithMockAudio(cf2);

    const received: ChordNotesOnPayload[] = [];
    const unsub = eventBus.on(EventType.CHORD_NOTES_ON, (d) => received.push(d as ChordNotesOnPayload));

    cf1.pressChord(0);
    cf2.pressChord(0);

    unsub();
    deactivate(cf1);
    deactivate(cf2);

    expect(received).toHaveLength(2);
    expect(received[0]!.sourceId).toBe('cf-a');
    expect(received[1]!.sourceId).toBe('cf-b');
  });
});
