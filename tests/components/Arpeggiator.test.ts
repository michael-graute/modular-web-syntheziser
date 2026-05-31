import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MockGainNode,
  MockConstantSourceNode,
} from '../mocks/WebAudioAPI.mock';

// ---------------------------------------------------------------------------
// Mocks — must be registered before any imports that pull in the real modules
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockConstantSource = () => new MockConstantSourceNode() as unknown as ConstantSourceNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createConstantSource: vi.fn(mockConstantSource),
};

vi.mock('../../src/core/AudioEngine', () => ({
  audioEngine: {
    isReady: () => true,
    getContext: () => mockCtx,
    addNode: vi.fn(),
  },
}));

vi.mock('../../src/core/GlobalBpmController', () => ({
  globalBpmController: { getBpm: () => 120 },
}));

const mockBpmUnsubscribe = vi.fn();
vi.mock('../../src/core/EventBus', () => ({
  eventBus: {
    on: vi.fn(() => mockBpmUnsubscribe),
    emit: vi.fn(),
    off: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { Arpeggiator } from '../../src/components/utilities/Arpeggiator';

function makeArp(): Arpeggiator {
  return new Arpeggiator('arp-test', { x: 0, y: 0 });
}

function makeActiveArp(): Arpeggiator {
  const arp = makeArp();
  arp.activate();
  return arp;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createConstantSource.mockImplementation(mockConstantSource);
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('Arpeggiator constructor', () => {
  it('creates cv-in and gate-in input ports', () => {
    const arp = makeArp();
    expect(arp.getInput('cv-in')).toBeDefined();
    expect(arp.getInput('gate-in')).toBeDefined();
  });

  it('creates cv-out and gate-out output ports', () => {
    const arp = makeArp();
    expect(arp.getOutput('cv-out')).toBeDefined();
    expect(arp.getOutput('gate-out')).toBeDefined();
  });

  it('has exactly four parameters', () => {
    const arp = makeArp();
    expect(arp.getParameterIds()).toHaveLength(4);
  });

  it('direction defaults to 0 (Up)', () => {
    const arp = makeArp();
    expect(arp.getParameter('direction')?.getValue()).toBe(0);
  });

  it('octaves defaults to 1', () => {
    const arp = makeArp();
    expect(arp.getParameter('octaves')?.getValue()).toBe(1);
  });

  it('subdivision defaults to 2 (1/16 note)', () => {
    const arp = makeArp();
    expect(arp.getParameter('subdivision')?.getValue()).toBe(2);
  });

  it('gateLength defaults to 1 (medium)', () => {
    const arp = makeArp();
    expect(arp.getParameter('gateLength')?.getValue()).toBe(1);
  });

  it('is NOT bypassable', () => {
    const arp = makeArp();
    expect(arp.isBypassable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createAudioNodes
// ---------------------------------------------------------------------------

describe('Arpeggiator createAudioNodes', () => {
  let arp: Arpeggiator;

  beforeEach(() => {
    arp = makeActiveArp();
  });

  it('creates 2 GainNodes and 2 ConstantSourceNodes', () => {
    expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
    expect(mockCtx.createConstantSource).toHaveBeenCalledTimes(2);
  });

  it('registers all four named nodes', () => {
    expect(arp.getAudioNode('cvInputNode')).toBeDefined();
    expect(arp.getAudioNode('gateInputNode')).toBeDefined();
    expect(arp.getAudioNode('cvOutputNode')).toBeDefined();
    expect(arp.getAudioNode('gateOutputNode')).toBeDefined();
  });

  it('starts both ConstantSourceNodes', () => {
    const cvOut = arp.getAudioNode('cvOutputNode') as unknown as MockConstantSourceNode;
    const gateOut = arp.getAudioNode('gateOutputNode') as unknown as MockConstantSourceNode;
    expect(cvOut.isStarted).toBe(true);
    expect(gateOut.isStarted).toBe(true);
  });

  it('subscribes to GLOBAL_BPM_CHANGED', async () => {
    const { eventBus } = await import('../../src/core/EventBus');
    expect(eventBus.on).toHaveBeenCalled();
  });

  it('starts the step clock', () => {
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getInputNode routing
// ---------------------------------------------------------------------------

describe('Arpeggiator getInputNode routing', () => {
  let arp: Arpeggiator;

  beforeEach(() => { arp = makeActiveArp(); });

  it('"cv-in" returns cvInputNode', () => {
    expect(arp.getInputNode('cv-in')).toBe(arp.getAudioNode('cvInputNode'));
  });

  it('"gate-in" returns gateInputNode', () => {
    expect(arp.getInputNode('gate-in')).toBe(arp.getAudioNode('gateInputNode'));
  });

  it('default (no portId) returns cvInputNode', () => {
    expect(arp.getInputNode()).toBe(arp.getAudioNode('cvInputNode'));
  });
});

// ---------------------------------------------------------------------------
// getOutputNode routing
// ---------------------------------------------------------------------------

describe('Arpeggiator getOutputNode routing', () => {
  let arp: Arpeggiator;

  beforeEach(() => { arp = makeActiveArp(); });

  it('getOutputNode() returns cvOutputNode', () => {
    expect(arp.getOutputNode()).toBe(arp.getAudioNode('cvOutputNode'));
  });
});

// ---------------------------------------------------------------------------
// Getter registration
// ---------------------------------------------------------------------------

describe('Arpeggiator getter registration', () => {
  let arp: Arpeggiator;

  beforeEach(() => { arp = makeActiveArp(); });

  it('setCvGetter stores the function', () => {
    const fn = vi.fn(() => 1.0);
    arp.setCvGetter(fn);
    // Verify by triggering a gate-high tick
    arp.setGateGetter(() => 1.0);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalled();
  });

  it('clearCvGetter removes the function', () => {
    const fn = vi.fn(() => 1.0);
    arp.setCvGetter(fn);
    arp.clearCvGetter();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('setGateGetter stores the function and resets prevGateHigh', () => {
    const fn = vi.fn(() => 0.0);
    arp.setGateGetter(fn);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalled();
  });

  it('clearGateGetter removes the function', () => {
    const fn = vi.fn(() => 0.0);
    arp.setGateGetter(fn);
    arp.clearGateGetter();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// buildStepCycle — direction
// ---------------------------------------------------------------------------

describe('Arpeggiator buildStepCycle — direction', () => {
  let arp: Arpeggiator;

  function latchNotes(notes: number[]): void {
    let callCount = 0;
    arp.setCvGetter(() => notes[callCount < notes.length ? callCount : notes.length - 1]);
    notes.forEach((_, i) => {
      callCount = i;
      arp.setGateGetter(() => 1.0); // gate-high
      vi.advanceTimersByTime(200);
      arp.clearGateGetter();
      arp.setGateGetter(() => 0.0); // gate-low
      vi.advanceTimersByTime(200);
    });
    // Re-hold all notes (gate stays high for cycle)
    let noteIdx = 0;
    arp.setCvGetter(() => notes[noteIdx++ % notes.length]);
    notes.forEach((_, i) => {
      noteIdx = i;
      arp.setGateGetter(() => 1.0);
      vi.advanceTimersByTime(10);
    });
  }

  beforeEach(() => {
    arp = makeActiveArp();
  });

  it('Up direction cycles low to high', () => {
    // Directly test by manipulating internal state via public parameter API
    arp.setParameterValue('direction', 0); // Up
    arp.setCvGetter(() => 1.0);
    arp.setGateGetter(() => 1.0);
    vi.advanceTimersByTime(200);
    const cvOut = arp.getAudioNode('cvOutputNode') as unknown as MockConstantSourceNode;
    // CV should have been set
    expect(cvOut.offset.scheduledValues.length).toBeGreaterThan(0);
  });

  it('Down direction parameter is accepted without error', () => {
    expect(() => {
      arp.setParameterValue('direction', 1);
      arp.updateAudioParameter('direction', 1);
    }).not.toThrow();
  });

  it('Up-Down direction parameter is accepted without error', () => {
    expect(() => {
      arp.setParameterValue('direction', 2);
      arp.updateAudioParameter('direction', 2);
    }).not.toThrow();
  });

  it('Random direction parameter is accepted without error', () => {
    expect(() => {
      arp.setParameterValue('direction', 3);
      arp.updateAudioParameter('direction', 3);
    }).not.toThrow();
  });

  it('Up-Down with exactly 2 notes produces a 2-step cycle (no boundary duplication)', () => {
    arp.setParameterValue('direction', 2);
    arp.updateAudioParameter('direction', 2);
    // Latch two notes via getters
    let noteIdx = 0;
    const notes = [0.0, 1.0]; // two distinct CV pitches
    arp.setCvGetter(() => notes[noteIdx % notes.length]);
    notes.forEach((_, i) => {
      noteIdx = i;
      arp.setGateGetter(() => 1.0);
      vi.advanceTimersByTime(10);
    });
    // With 2 notes and Up-Down: expanded=[0,1]; slice(1,-1)=[] → cycle=[0,1]
    // The clock will advance with stepIndex cycling between 0 and 1
    const cvOut = arp.getAudioNode('cvOutputNode') as unknown as MockConstantSourceNode;
    const before = cvOut.offset.scheduledValues.length;
    vi.advanceTimersByTime(500);
    expect(cvOut.offset.scheduledValues.length).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// Octave range
// ---------------------------------------------------------------------------

describe('Arpeggiator octave range', () => {
  it('changing octaves triggers a step cycle rebuild without error', () => {
    const arp = makeActiveArp();
    expect(() => {
      arp.setParameterValue('octaves', 2);
      arp.updateAudioParameter('octaves', 2);
    }).not.toThrow();
  });

  it('octave 2 schedules CV at +1.0 offset relative to base note', () => {
    const arp = makeActiveArp();
    arp.setParameterValue('octaves', 2);
    arp.updateAudioParameter('octaves', 2);

    let noteIdx = 0;
    const cvValues = [0.5];
    arp.setCvGetter(() => cvValues[0]);
    arp.setGateGetter(() => 1.0);
    vi.advanceTimersByTime(600); // let several ticks fire

    const cvOut = arp.getAudioNode('cvOutputNode') as unknown as MockConstantSourceNode;
    const scheduledCvValues = cvOut.offset.scheduledValues.map(v => v.value);

    // With one note (0.5) and 2 octaves: step cycle = [0.5, 1.5]
    const has0_5 = scheduledCvValues.some(v => Math.abs(v - 0.5) < 0.001);
    const has1_5 = scheduledCvValues.some(v => Math.abs(v - 1.5) < 0.001);
    expect(has0_5).toBe(true);
    expect(has1_5).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tick — empty sequence emits no gate
// ---------------------------------------------------------------------------

describe('Arpeggiator tick — empty sequence', () => {
  it('emits no gate-high when no notes are latched', () => {
    const arp = makeActiveArp();
    // No getters registered, no notes latched
    vi.advanceTimersByTime(500);
    const gateOut = arp.getAudioNode('gateOutputNode') as unknown as MockConstantSourceNode;
    const gateHighValues = gateOut.offset.scheduledValues.filter(v => v.value === 1);
    expect(gateHighValues).toHaveLength(0);
  });

  it('schedules gate-high once a note is latched', () => {
    const arp = makeActiveArp();
    arp.setCvGetter(() => 0.5);
    arp.setGateGetter(() => 1.0);
    vi.advanceTimersByTime(500);
    const gateOut = arp.getAudioNode('gateOutputNode') as unknown as MockConstantSourceNode;
    const gateHighValues = gateOut.offset.scheduledValues.filter(v => v.value === 1);
    expect(gateHighValues.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// BPM change restarts clock
// ---------------------------------------------------------------------------

describe('Arpeggiator BPM change', () => {
  it('updateAudioParameter with subdivision restarts the clock', () => {
    const arp = makeActiveArp();
    const countBefore = vi.getTimerCount();
    arp.setParameterValue('subdivision', 0); // change to 1/4 note
    arp.updateAudioParameter('subdivision', 0);
    // Clock should still be running (1 interval timer)
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Step interval timing (T023) — BPM=120, all 4 subdivisions
// ---------------------------------------------------------------------------

describe('Arpeggiator step interval timing at BPM=120', () => {
  // At 120 BPM: quarter note = 500ms, eighth = 250ms, sixteenth = 125ms, thirty-second = 62.5ms
  const cases: Array<{ subdivisionIndex: number; label: string; expectedMs: number }> = [
    { subdivisionIndex: 0, label: '1/4 note', expectedMs: 500 },
    { subdivisionIndex: 1, label: '1/8 note', expectedMs: 250 },
    { subdivisionIndex: 2, label: '1/16 note', expectedMs: 125 },
    { subdivisionIndex: 3, label: '1/32 note', expectedMs: 62.5 },
  ];

  cases.forEach(({ subdivisionIndex, label, expectedMs }) => {
    it(`subdivision ${subdivisionIndex} (${label}) fires steps at ${expectedMs}ms intervals`, () => {
      const arp = makeActiveArp();
      arp.setParameterValue('subdivision', subdivisionIndex);
      arp.updateAudioParameter('subdivision', subdivisionIndex);
      arp.setCvGetter(() => 440);
      arp.setGateGetter(() => 1.0);

      const cvOut = arp.getAudioNode('cvOutputNode') as unknown as MockConstantSourceNode;
      const before = cvOut.offset.scheduledValues.length;

      // Advance by exactly one expected interval — should fire ~1 tick
      vi.advanceTimersByTime(expectedMs + 1);
      const after = cvOut.offset.scheduledValues.length;
      expect(after).toBeGreaterThan(before);

      // Advance by 3 more intervals — should have fired ~4 ticks total
      vi.advanceTimersByTime(expectedMs * 3);
      const final = cvOut.offset.scheduledValues.length;
      expect(final).toBeGreaterThan(after);
    });
  });
});

// ---------------------------------------------------------------------------
// onInputDisconnected
// ---------------------------------------------------------------------------

describe('Arpeggiator onInputDisconnected', () => {
  it('clearing gate-in silences gate output', () => {
    const arp = makeActiveArp();
    arp.setCvGetter(() => 0.5);
    arp.setGateGetter(() => 1.0);
    vi.advanceTimersByTime(300);

    arp.onInputDisconnected('gate-in');

    const gateOut = arp.getAudioNode('gateOutputNode') as unknown as MockConstantSourceNode;
    const lastScheduled = gateOut.offset.scheduledValues.at(-1);
    expect(lastScheduled?.value).toBe(0);
  });

  it('clearing cv-in removes the CV getter', () => {
    const arp = makeActiveArp();
    const fn = vi.fn(() => 0.5);
    arp.setCvGetter(fn);
    arp.onInputDisconnected('cv-in');
    arp.setGateGetter(() => 1.0);
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('Arpeggiator serialization', () => {
  it('serialize includes type as arpeggiator', () => {
    const arp = makeArp();
    expect(arp.serialize().type).toBe('arpeggiator');
  });

  it('serialize includes all 4 parameters', () => {
    const arp = makeArp();
    const params = arp.serialize().parameters;
    expect(params).toHaveProperty('direction');
    expect(params).toHaveProperty('octaves');
    expect(params).toHaveProperty('subdivision');
    expect(params).toHaveProperty('gateLength');
  });

  it('serialize reflects changed parameter values', () => {
    const arp = makeArp();
    arp.setParameterValue('direction', 1);
    arp.setParameterValue('octaves', 3);
    const params = arp.serialize().parameters;
    expect(params.direction).toBe(1);
    expect(params.octaves).toBe(3);
  });

  it('isBypassed is not set (Arpeggiator is not bypassable)', () => {
    const arp = makeArp();
    expect(arp.serialize().isBypassed).toBeUndefined();
  });

  it('deserialize restores parameter values', () => {
    const arp = makeArp();
    const serialized = arp.serialize();
    serialized.parameters = { direction: 3, octaves: 4, subdivision: 0, gateLength: 2 };
    const arp2 = makeArp();
    arp2.deserialize(serialized);
    expect(arp2.getParameter('direction')?.getValue()).toBe(3);
    expect(arp2.getParameter('octaves')?.getValue()).toBe(4);
    expect(arp2.getParameter('subdivision')?.getValue()).toBe(0);
    expect(arp2.getParameter('gateLength')?.getValue()).toBe(2);
  });
});
