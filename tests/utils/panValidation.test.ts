import { describe, it, expect } from 'vitest';
import {
  clampPan,
  isValidPan,
  isCenterPan,
  PAN_MIN,
  PAN_MAX,
  PAN_DEFAULT,
} from '../../specs/019-mixer-channel-panning/contracts/validation';

describe('clampPan', () => {
  it('passes through a value already in range', () => {
    expect(clampPan(0.0)).toBe(0.0);
    expect(clampPan(0.5)).toBe(0.5);
    expect(clampPan(-0.5)).toBe(-0.5);
  });

  it('clamps values below PAN_MIN to PAN_MIN', () => {
    expect(clampPan(-2.0)).toBe(PAN_MIN);
    expect(clampPan(-1.0001)).toBe(PAN_MIN);
  });

  it('clamps values above PAN_MAX to PAN_MAX', () => {
    expect(clampPan(2.0)).toBe(PAN_MAX);
    expect(clampPan(1.0001)).toBe(PAN_MAX);
  });

  it('passes through boundary values exactly', () => {
    expect(clampPan(PAN_MIN)).toBe(PAN_MIN);
    expect(clampPan(PAN_MAX)).toBe(PAN_MAX);
  });
});

describe('isValidPan', () => {
  it('returns true for values within range', () => {
    expect(isValidPan(0.0)).toBe(true);
    expect(isValidPan(-1.0)).toBe(true);
    expect(isValidPan(1.0)).toBe(true);
    expect(isValidPan(0.5)).toBe(true);
    expect(isValidPan(-0.99)).toBe(true);
  });

  it('returns false for values out of range', () => {
    expect(isValidPan(-1.001)).toBe(false);
    expect(isValidPan(1.001)).toBe(false);
    expect(isValidPan(-2.0)).toBe(false);
    expect(isValidPan(100.0)).toBe(false);
  });

  it('returns false for NaN', () => {
    expect(isValidPan(NaN)).toBe(false);
  });

  it('returns false for Infinity', () => {
    expect(isValidPan(Infinity)).toBe(false);
    expect(isValidPan(-Infinity)).toBe(false);
  });
});

describe('isCenterPan', () => {
  it('returns true for PAN_DEFAULT (0.0)', () => {
    expect(isCenterPan(PAN_DEFAULT)).toBe(true);
  });

  it('returns true for values within default epsilon (0.001)', () => {
    expect(isCenterPan(0.0005)).toBe(true);
    expect(isCenterPan(-0.0005)).toBe(true);
  });

  it('returns false for values outside default epsilon', () => {
    expect(isCenterPan(0.5)).toBe(false);
    expect(isCenterPan(-0.5)).toBe(false);
    expect(isCenterPan(0.002)).toBe(false);
  });

  it('respects a custom epsilon', () => {
    expect(isCenterPan(0.05, 0.1)).toBe(true);
    expect(isCenterPan(0.15, 0.1)).toBe(false);
  });
});
