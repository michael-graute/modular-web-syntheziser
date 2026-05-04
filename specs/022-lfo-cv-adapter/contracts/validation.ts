/**
 * Validation helpers for feature 022 — LFO CV Adapter
 *
 * Pure functions — no Web Audio API dependencies — suitable for unit testing.
 */

import type { CvInputRange, ScaleGain } from './types';

/**
 * Compute the gain for a per-connection LFO scaler.
 *
 * The LFO's depth GainNode outputs ±(depth/100).
 * Multiplying by this gain yields a peak swing of depth% × (paramMax − paramMin) / 2
 * centred on zero, which Web Audio adds to the base AudioParam value.
 *
 * @param depthPercent  LFO depth (0–100)
 * @param range         Target parameter min/max
 * @returns             Gain value to set on the per-connection GainNode
 */
export function computeScaleGain(depthPercent: number, range: CvInputRange): ScaleGain {
  const clampedDepth = Math.max(0, Math.min(100, depthPercent));
  const paramRange = range.max - range.min;
  return (clampedDepth / 100) * (paramRange / 2);
}

/**
 * Compute the gain for the Filter's cvAmountGainNode.
 *
 * Scales a unipolar 0..1 CV signal (e.g. ADSR) into Hz.
 * At cvAmountPercent=100%, a 0..1 signal maps to 0..(paramMax − paramMin).
 *
 * @param cvAmountPercent  Filter CV Amount knob value (0–100)
 * @param range            Filter cutoff min/max
 * @returns                Gain value to set on cvAmountGainNode
 */
export function computeCvAmountGain(cvAmountPercent: number, range: CvInputRange): number {
  const clampedAmount = Math.max(0, Math.min(100, cvAmountPercent));
  const paramRange = range.max - range.min;
  return (clampedAmount / 100) * paramRange;
}

/**
 * Validate that a connection scaler key is well-formed.
 * Key must be "componentId:portId" with no empty segments.
 */
export function isValidScalerKey(key: string): boolean {
  const parts = key.split(':');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

/**
 * Build a connection scaler key from component ID and port ID.
 */
export function makeScalerKey(targetComponentId: string, targetPortId: string): string {
  return `${targetComponentId}:${targetPortId}`;
}
