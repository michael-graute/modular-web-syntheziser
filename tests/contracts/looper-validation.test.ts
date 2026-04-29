import { describe, it, expect } from 'vitest';
import {
  isValidBarCount,
  validateBarCount,
  validateBpm,
  isValidLooperState,
  stateIndexToLooperState,
  looperStateToIndex,
  validateLooperSerializedParams,
  isValidBase64,
  validateAudioBlob,
  validateLoopDuration,
  isValidStateTransition,
} from '../../specs/015-bpm-looper/contracts/validation';
import { LooperState } from '../../specs/015-bpm-looper/contracts/types';

describe('isValidBarCount', () => {
  it('returns true for valid bar counts', () => {
    expect(isValidBarCount(1)).toBe(true);
    expect(isValidBarCount(2)).toBe(true);
    expect(isValidBarCount(4)).toBe(true);
    expect(isValidBarCount(8)).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isValidBarCount(0)).toBe(false);
    expect(isValidBarCount(3)).toBe(false);
    expect(isValidBarCount(16)).toBe(false);
    expect(isValidBarCount('4')).toBe(false);
    expect(isValidBarCount(null)).toBe(false);
    expect(isValidBarCount(undefined)).toBe(false);
  });
});

describe('validateBarCount', () => {
  it('returns null for valid bar counts', () => {
    expect(validateBarCount(1)).toBeNull();
    expect(validateBarCount(2)).toBeNull();
    expect(validateBarCount(4)).toBeNull();
    expect(validateBarCount(8)).toBeNull();
  });

  it('returns error message for invalid values', () => {
    expect(validateBarCount(3)).toMatch(/barCount must be one of/);
    expect(validateBarCount('2')).toMatch(/barCount must be one of/);
    expect(validateBarCount(null)).toMatch(/barCount must be one of/);
  });
});

describe('validateBpm', () => {
  it('returns null for valid BPM values', () => {
    expect(validateBpm(30)).toBeNull();
    expect(validateBpm(120)).toBeNull();
    expect(validateBpm(300)).toBeNull();
    expect(validateBpm(60.5)).toBeNull();
  });

  it('returns error for out-of-range values', () => {
    expect(validateBpm(29)).toMatch(/bpm must be a finite number/);
    expect(validateBpm(301)).toMatch(/bpm must be a finite number/);
  });

  it('returns error for non-number values', () => {
    expect(validateBpm('120')).toMatch(/bpm must be a finite number/);
    expect(validateBpm(null)).toMatch(/bpm must be a finite number/);
    expect(validateBpm(undefined)).toMatch(/bpm must be a finite number/);
    expect(validateBpm(NaN)).toMatch(/bpm must be a finite number/);
    expect(validateBpm(Infinity)).toMatch(/bpm must be a finite number/);
  });
});

describe('isValidLooperState', () => {
  it('returns true for valid states', () => {
    expect(isValidLooperState('idle')).toBe(true);
    expect(isValidLooperState('recording')).toBe(true);
    expect(isValidLooperState('playing')).toBe(true);
    expect(isValidLooperState('overdubbing')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isValidLooperState('paused')).toBe(false);
    expect(isValidLooperState('')).toBe(false);
    expect(isValidLooperState(0)).toBe(false);
    expect(isValidLooperState(null)).toBe(false);
    expect(isValidLooperState(undefined)).toBe(false);
  });
});

describe('stateIndexToLooperState', () => {
  it('maps 0 to IDLE', () => {
    expect(stateIndexToLooperState(0)).toBe(LooperState.IDLE);
  });

  it('maps 1 to PLAYING (recording normalized)', () => {
    expect(stateIndexToLooperState(1)).toBe(LooperState.PLAYING);
  });

  it('maps 2 to PLAYING', () => {
    expect(stateIndexToLooperState(2)).toBe(LooperState.PLAYING);
  });

  it('maps 3 to PLAYING (overdubbing normalized)', () => {
    expect(stateIndexToLooperState(3)).toBe(LooperState.PLAYING);
  });

  it('falls back to IDLE for unknown index', () => {
    expect(stateIndexToLooperState(99)).toBe(LooperState.IDLE);
    expect(stateIndexToLooperState(-1)).toBe(LooperState.IDLE);
  });
});

describe('looperStateToIndex', () => {
  it('maps IDLE to 0', () => {
    expect(looperStateToIndex(LooperState.IDLE)).toBe(0);
  });

  it('maps RECORDING to 2 (normalized to playing)', () => {
    expect(looperStateToIndex(LooperState.RECORDING)).toBe(2);
  });

  it('maps PLAYING to 2', () => {
    expect(looperStateToIndex(LooperState.PLAYING)).toBe(2);
  });

  it('maps OVERDUBBING to 2 (normalized to playing)', () => {
    expect(looperStateToIndex(LooperState.OVERDUBBING)).toBe(2);
  });
});

describe('validateLooperSerializedParams', () => {
  it('returns null for valid params', () => {
    expect(validateLooperSerializedParams({ barCount: 4, stateIndex: 2 })).toBeNull();
    expect(validateLooperSerializedParams({ barCount: 1, stateIndex: 0 })).toBeNull();
    expect(validateLooperSerializedParams({ barCount: 8, stateIndex: 3 })).toBeNull();
  });

  it('returns error for null/non-object params', () => {
    expect(validateLooperSerializedParams(null)).toMatch(/non-null object/);
    expect(validateLooperSerializedParams(undefined)).toMatch(/non-null object/);
    expect(validateLooperSerializedParams('string')).toMatch(/non-null object/);
  });

  it('returns error for invalid barCount', () => {
    expect(validateLooperSerializedParams({ barCount: 3, stateIndex: 0 })).toMatch(/barCount/);
    expect(validateLooperSerializedParams({ barCount: null, stateIndex: 0 })).toMatch(/barCount/);
  });

  it('returns error for invalid stateIndex', () => {
    expect(validateLooperSerializedParams({ barCount: 4, stateIndex: -1 })).toMatch(/stateIndex/);
    expect(validateLooperSerializedParams({ barCount: 4, stateIndex: 4 })).toMatch(/stateIndex/);
    expect(validateLooperSerializedParams({ barCount: 4, stateIndex: 1.5 })).toMatch(/stateIndex/);
    expect(validateLooperSerializedParams({ barCount: 4, stateIndex: 'two' })).toMatch(/stateIndex/);
  });
});

describe('isValidBase64', () => {
  it('returns true for valid base64 strings', () => {
    expect(isValidBase64('')).toBe(true); // empty string: length 0 % 4 === 0
    expect(isValidBase64('AAAA')).toBe(true);
    expect(isValidBase64('SGVsbG8=')).toBe(true);
    expect(isValidBase64('SGVsbG8h')).toBe(true);
    expect(isValidBase64('dGVzdA==')).toBe(true);
  });

  it('returns false for non-string values', () => {
    expect(isValidBase64(null)).toBe(false);
    expect(isValidBase64(undefined)).toBe(false);
    expect(isValidBase64(42)).toBe(false);
  });

  it('returns false for invalid base64 content', () => {
    expect(isValidBase64('SGVsbG8')).toBe(false); // length not multiple of 4
    expect(isValidBase64('!!==')).toBe(false); // invalid chars
  });
});

describe('validateAudioBlob', () => {
  it('returns null for undefined or null (optional field)', () => {
    expect(validateAudioBlob(undefined)).toBeNull();
    expect(validateAudioBlob(null)).toBeNull();
  });

  it('returns null for valid base64 string', () => {
    expect(validateAudioBlob('AAAA')).toBeNull();
    expect(validateAudioBlob('SGVsbG8=')).toBeNull();
  });

  it('returns error for invalid base64', () => {
    expect(validateAudioBlob('not-valid!!')).toMatch(/Base64/);
    expect(validateAudioBlob(42)).toMatch(/Base64/);
  });
});

describe('validateLoopDuration', () => {
  it('returns null for valid barCount and BPM', () => {
    expect(validateLoopDuration(4, 120)).toBeNull();
    expect(validateLoopDuration(1, 30)).toBeNull();
    expect(validateLoopDuration(8, 300)).toBeNull();
  });

  it('returns barCount error for invalid barCount', () => {
    // @ts-expect-error testing invalid input
    expect(validateLoopDuration(3, 120)).toMatch(/barCount/);
  });

  it('returns bpm error for invalid BPM', () => {
    expect(validateLoopDuration(4, 10)).toMatch(/bpm/);
    expect(validateLoopDuration(4, 400)).toMatch(/bpm/);
  });
});

describe('isValidStateTransition', () => {
  it('allows idle → recording', () => {
    expect(isValidStateTransition(LooperState.IDLE, LooperState.RECORDING)).toBe(true);
  });

  it('allows recording → playing (auto at loop end)', () => {
    expect(isValidStateTransition(LooperState.RECORDING, LooperState.PLAYING)).toBe(true);
  });

  it('allows playing → overdubbing', () => {
    expect(isValidStateTransition(LooperState.PLAYING, LooperState.OVERDUBBING)).toBe(true);
  });

  it('allows playing → idle (Stop)', () => {
    expect(isValidStateTransition(LooperState.PLAYING, LooperState.IDLE)).toBe(true);
  });

  it('allows overdubbing → playing (Stop/Overdub toggle)', () => {
    expect(isValidStateTransition(LooperState.OVERDUBBING, LooperState.PLAYING)).toBe(true);
  });

  it('disallows idle → playing', () => {
    expect(isValidStateTransition(LooperState.IDLE, LooperState.PLAYING)).toBe(false);
  });

  it('disallows idle → overdubbing', () => {
    expect(isValidStateTransition(LooperState.IDLE, LooperState.OVERDUBBING)).toBe(false);
  });

  it('disallows recording → idle', () => {
    expect(isValidStateTransition(LooperState.RECORDING, LooperState.IDLE)).toBe(false);
  });

  it('disallows recording → overdubbing', () => {
    expect(isValidStateTransition(LooperState.RECORDING, LooperState.OVERDUBBING)).toBe(false);
  });

  it('disallows overdubbing → idle directly', () => {
    expect(isValidStateTransition(LooperState.OVERDUBBING, LooperState.IDLE)).toBe(false);
  });

  it('disallows overdubbing → recording', () => {
    expect(isValidStateTransition(LooperState.OVERDUBBING, LooperState.RECORDING)).toBe(false);
  });
});
