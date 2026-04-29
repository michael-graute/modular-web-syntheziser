import { describe, it, expect } from 'vitest';
import {
  computeLoopDurationSeconds,
  computeLoopDurationSamples,
  normalizePlayHead,
  playHeadToAngle,
  LOOPER_STATE_COLORS,
  LOOPER_RESERVED_KEYS,
  LOOPER_SHORTCUT_RECORD,
  LOOPER_SHORTCUT_STOP,
  LOOPER_SHORTCUT_CLEAR,
  LooperState,
} from '../../specs/015-bpm-looper/contracts/types';

describe('computeLoopDurationSeconds', () => {
  it('computes correct duration for 1 bar at 120 BPM', () => {
    expect(computeLoopDurationSeconds(1, 120)).toBeCloseTo(2.0);
  });

  it('computes correct duration for 2 bars at 120 BPM', () => {
    expect(computeLoopDurationSeconds(2, 120)).toBeCloseTo(4.0);
  });

  it('computes correct duration for 4 bars at 120 BPM', () => {
    expect(computeLoopDurationSeconds(4, 120)).toBeCloseTo(8.0);
  });

  it('computes correct duration for 8 bars at 120 BPM', () => {
    expect(computeLoopDurationSeconds(8, 120)).toBeCloseTo(16.0);
  });

  it('uses formula: barCount × 4 × 60 / bpm', () => {
    // 2 bars at 60 BPM = 2 × 4 × 60 / 60 = 8 seconds
    expect(computeLoopDurationSeconds(2, 60)).toBeCloseTo(8.0);
    // 4 bars at 30 BPM = 4 × 4 × 60 / 30 = 32 seconds
    expect(computeLoopDurationSeconds(4, 30)).toBeCloseTo(32.0);
    // 1 bar at 300 BPM = 1 × 4 × 60 / 300 = 0.8 seconds
    expect(computeLoopDurationSeconds(1, 300)).toBeCloseTo(0.8);
  });
});

describe('computeLoopDurationSamples', () => {
  it('returns rounded integer', () => {
    const result = computeLoopDurationSamples(1, 120, 44100);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('computes 2 bars at 120 BPM at 44100 Hz', () => {
    // 4.0 seconds × 44100 = 176400
    expect(computeLoopDurationSamples(2, 120, 44100)).toBe(176400);
  });

  it('computes 1 bar at 120 BPM at 48000 Hz', () => {
    // 2.0 seconds × 48000 = 96000
    expect(computeLoopDurationSamples(1, 120, 48000)).toBe(96000);
  });

  it('rounds to nearest integer', () => {
    // 1 bar at 127 BPM at 44100 Hz: (4 * 60 / 127) * 44100 ≈ 83622.047...
    const result = computeLoopDurationSamples(1, 127, 44100);
    expect(result).toBe(Math.round((4 * 60 / 127) * 44100));
  });
});

describe('normalizePlayHead', () => {
  it('returns 0 for zero or negative lengthSamples', () => {
    expect(normalizePlayHead(100, 0)).toBe(0);
    expect(normalizePlayHead(100, -1)).toBe(0);
  });

  it('returns 0 when playHead is at start', () => {
    expect(normalizePlayHead(0, 1000)).toBe(0);
  });

  it('returns 1 when playHead equals lengthSamples', () => {
    expect(normalizePlayHead(1000, 1000)).toBe(1);
  });

  it('returns 0.5 for midpoint', () => {
    expect(normalizePlayHead(500, 1000)).toBeCloseTo(0.5);
  });

  it('clamps to [0, 1] for out-of-range values', () => {
    expect(normalizePlayHead(-10, 1000)).toBe(0);
    expect(normalizePlayHead(2000, 1000)).toBe(1);
  });
});

describe('playHeadToAngle', () => {
  it('returns -π/2 at position 0 (top of ring)', () => {
    expect(playHeadToAngle(0)).toBeCloseTo(-Math.PI / 2);
  });

  it('returns π/2 at position 0.5 (bottom of ring)', () => {
    // 0.5 × 2π - π/2 = π - π/2 = π/2... wait: 0.5 × 2π = π; π - π/2 = π/2
    expect(playHeadToAngle(0.5)).toBeCloseTo(Math.PI / 2);
  });

  it('returns 3π/2 at position 1 (full revolution = one tick past top)', () => {
    // 1 × 2π - π/2 = 3π/2
    expect(playHeadToAngle(1)).toBeCloseTo(3 * Math.PI / 2);
  });

  it('returns 0 at position 0.25 (3 o\'clock)', () => {
    // 0.25 × 2π - π/2 = π/2 - π/2 = 0
    expect(playHeadToAngle(0.25)).toBeCloseTo(0);
  });
});

describe('LOOPER_STATE_COLORS', () => {
  it('has a color for every LooperState', () => {
    expect(LOOPER_STATE_COLORS[LooperState.IDLE]).toBeTruthy();
    expect(LOOPER_STATE_COLORS[LooperState.RECORDING]).toBeTruthy();
    expect(LOOPER_STATE_COLORS[LooperState.PLAYING]).toBeTruthy();
    expect(LOOPER_STATE_COLORS[LooperState.OVERDUBBING]).toBeTruthy();
  });

  it('uses correct semantic colors', () => {
    expect(LOOPER_STATE_COLORS[LooperState.IDLE]).toBe('#4a4a4a');     // grey
    expect(LOOPER_STATE_COLORS[LooperState.RECORDING]).toBe('#e05555');  // red
    expect(LOOPER_STATE_COLORS[LooperState.PLAYING]).toBe('#4caf50');    // green
    expect(LOOPER_STATE_COLORS[LooperState.OVERDUBBING]).toBe('#f5a623'); // orange
  });
});

describe('LOOPER_RESERVED_KEYS', () => {
  it('contains the three shortcut keys', () => {
    expect(LOOPER_RESERVED_KEYS.has(LOOPER_SHORTCUT_RECORD)).toBe(true);
    expect(LOOPER_RESERVED_KEYS.has(LOOPER_SHORTCUT_STOP)).toBe(true);
    expect(LOOPER_RESERVED_KEYS.has(LOOPER_SHORTCUT_CLEAR)).toBe(true);
  });

  it('has exactly three keys', () => {
    expect(LOOPER_RESERVED_KEYS.size).toBe(3);
  });

  it('uses the correct key values', () => {
    expect(LOOPER_SHORTCUT_RECORD).toBe('1');
    expect(LOOPER_SHORTCUT_STOP).toBe('2');
    expect(LOOPER_SHORTCUT_CLEAR).toBe('0');
  });

  it('does not contain unrelated keys', () => {
    expect(LOOPER_RESERVED_KEYS.has('r')).toBe(false);
    expect(LOOPER_RESERVED_KEYS.has('s')).toBe(false);
    expect(LOOPER_RESERVED_KEYS.has('c')).toBe(false);
    expect(LOOPER_RESERVED_KEYS.has('3')).toBe(false);
  });
});
