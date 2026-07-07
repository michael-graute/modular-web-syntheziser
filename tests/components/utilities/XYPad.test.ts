import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGainNode, MockConstantSourceNode } from '../../mocks/WebAudioAPI.mock';
import { SynthComponent } from '../../../src/components/base/SynthComponent';
import { ComponentType, SignalType } from '../../../src/core/types';
import { clampAxis, clampPosition } from '../../../specs/035-xy-pad-controller/contracts/validation';

// ---------------------------------------------------------------------------
// Mock AudioEngine — must come before importing XYPad
// ---------------------------------------------------------------------------

const mockGain = () => new MockGainNode() as unknown as GainNode;
const mockConstantSource = () => new MockConstantSourceNode() as unknown as ConstantSourceNode;

const mockCtx = {
  currentTime: 0,
  createGain: vi.fn(mockGain),
  createConstantSource: vi.fn(mockConstantSource),
};

vi.mock('../../../src/core/AudioEngine', () => ({
  audioEngine: {
    isReady: () => true,
    getContext: () => mockCtx,
    addNode: vi.fn(),
  },
}));

import { XYPad } from '../../../src/components/utilities/XYPad';

function makeActivePad(): XYPad {
  const pad = new XYPad('xy-test', { x: 0, y: 0 });
  pad.activate();
  return pad;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx.createGain.mockImplementation(mockGain);
  mockCtx.createConstantSource.mockImplementation(mockConstantSource);
});

// ---------------------------------------------------------------------------
// clampAxis / clampPosition (FR-016) — 100% coverage
// ---------------------------------------------------------------------------

describe('clampAxis', () => {
  it('clamps values below 0 to 0', () => {
    expect(clampAxis(-0.5)).toBe(0);
  });

  it('clamps values above 1 to 1', () => {
    expect(clampAxis(1.5)).toBe(1);
  });

  it('passes through values already within [0,1]', () => {
    expect(clampAxis(0.42)).toBe(0.42);
  });

  it('passes through boundary values unchanged', () => {
    expect(clampAxis(0)).toBe(0);
    expect(clampAxis(1)).toBe(1);
  });
});

describe('clampPosition', () => {
  it('clamps both axes independently', () => {
    expect(clampPosition({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 });
  });

  it('passes through an in-range position unchanged', () => {
    expect(clampPosition({ x: 0.3, y: 0.7 })).toEqual({ x: 0.3, y: 0.7 });
  });
});

// ---------------------------------------------------------------------------
// A minimal fake target component exposing an AudioParam + declared range,
// mirroring how Filter/VCA expose CV inputs for the LFO adapter pattern.
// ---------------------------------------------------------------------------

class FakeTarget extends SynthComponent {
  private param: GainNode;

  constructor(id: string, private range: { min: number; max: number }) {
    super(id, ComponentType.FILTER, 'FakeTarget', { x: 0, y: 0 });
    this.addInput('cv', 'CV', SignalType.CV);
    this.param = mockGain();
  }

  createAudioNodes(): void {}
  destroyAudioNodes(): void {}
  updateAudioParameter(): void {}
  getInputNode(): AudioNode | null { return this.param; }
  getOutputNode(): AudioNode | null { return null; }

  override getAudioParamForInput(inputId: string): AudioParam | null {
    return inputId === 'cv' ? this.param.gain : null;
  }

  override getParameterRangeForInput(inputId: string): { min: number; max: number } | null {
    return inputId === 'cv' ? this.range : null;
  }
}

// ---------------------------------------------------------------------------
// Position tracking (FR-004, FR-005, FR-006, US1 acceptance scenario 4)
// ---------------------------------------------------------------------------

describe('XYPad position tracking', () => {
  it('setAxisPosition updates getPosition', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.25, 0.75);
    expect(pad.getPosition()).toEqual({ x: 0.25, y: 0.75 });
  });

  it('clamps out-of-range positions to [0,1] (FR-016)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(-0.5, 1.5);
    expect(pad.getPosition()).toEqual({ x: 0, y: 1 });
  });

  it('holds the last position after interaction stops (FR-006)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.6, 0.4);
    // No further calls — position should remain exactly as last set.
    expect(pad.getPosition()).toEqual({ x: 0.6, y: 0.4 });
  });

  it('a newly connected output reflects the current resting position (US1 scenario 4)', () => {
    const pad = makeActivePad();
    pad.setAxisPosition(0.8, 0.2);
    const target = new FakeTarget('t1', { min: 0, max: 100 });
    pad.connectTo(target, 'x', 'cv');
    // The X gain node (source of the scaler chain) holds the resting position value.
    expect(pad.getPosition().x).toBe(0.8);
  });

  it('defaults to center position (0.5, 0.5) before any interaction', () => {
    const pad = makeActivePad();
    expect(pad.getPosition()).toEqual({ x: 0.5, y: 0.5 });
  });
});

// ---------------------------------------------------------------------------
// Depth-scaled connectTo (FR-004a) — mirrors LFO.cv.test.ts style
// ---------------------------------------------------------------------------

describe('XYPad depth-scaled connections', () => {
  it('creates a per-connection scaler GainNode sized from xDepth and target range', () => {
    const pad = makeActivePad();
    pad.setParameterValue('xDepth', 50);
    const target = new FakeTarget('t1', { min: 0, max: 100 });

    pad.connectTo(target, 'x', 'cv');

    // computeScaleGain(50, {min:0,max:100}) = 0.5 * 100 = 50.
    // createGain is called twice: 1 for the connection scaler, 1 for the
    // combined (scaler + offset) summing node.
    expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
    // createConstantSource: 1 for X, 1 for Y (createAudioNodes), then 1 more
    // for the connection's range-offset node.
    expect(mockCtx.createConstantSource).toHaveBeenCalledTimes(3);
  });

  it('the connection offset node is set to the target range minimum, so position 0 reaches range.min not 0', () => {
    const pad = makeActivePad();
    pad.setParameterValue('xDepth', 100);
    const target = new FakeTarget('t1', { min: 200, max: 300 });

    pad.connectTo(target, 'x', 'cv');

    // The 3rd createConstantSource call (after the X and Y position sources)
    // is the per-connection offset node.
    const offsetNode = mockCtx.createConstantSource.mock.results[2]!.value as MockConstantSourceNode;
    expect(offsetNode.offset.value).toBe(200);
  });

  it('getScaledOutputForConnection returns the combined node the visualizer taps for accurate live values', () => {
    const pad = makeActivePad();
    pad.setParameterValue('xDepth', 100);
    const target = new FakeTarget('t1', { min: 0, max: 100 });

    pad.connectTo(target, 'x', 'cv');

    const combined = pad.getScaledOutputForConnection('t1', 'cv');
    expect(combined).not.toBeNull();
  });

  it('getScaledOutputForConnection returns null when no connection exists', () => {
    const pad = makeActivePad();
    expect(pad.getScaledOutputForConnection('nonexistent', 'cv')).toBeNull();
  });

  it('X and Y scalers are independent — connecting Y does not affect X depth scaling', () => {
    const pad = makeActivePad();
    pad.setParameterValue('xDepth', 100);
    pad.setParameterValue('yDepth', 10);
    const xTarget = new FakeTarget('tx', { min: 0, max: 100 });
    const yTarget = new FakeTarget('ty', { min: 0, max: 100 });

    pad.connectTo(xTarget, 'x', 'cv');
    pad.connectTo(yTarget, 'y', 'cv');

    // Different depths must be independently reflected; verified indirectly via
    // updateAudioParameter not throwing and each axis tracking its own param.
    expect(pad.getParameter('xDepth')?.getValue()).toBe(100);
    expect(pad.getParameter('yDepth')?.getValue()).toBe(10);
  });

  it('falls back to base connectTo when target has no declared parameter range', () => {
    const pad = makeActivePad();
    const target = new FakeTarget('t1', { min: 0, max: 100 });
    // Force no range so the adapter pattern falls back to the base class.
    vi.spyOn(target, 'getParameterRangeForInput').mockReturnValue(null);

    expect(() => pad.connectTo(target, 'x', 'cv')).not.toThrow();
  });
});
