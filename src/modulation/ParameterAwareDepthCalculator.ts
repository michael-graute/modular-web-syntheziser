/**
 * Parameter-Aware Depth Calculator
 * Feature: 008-lfo-parameter-depth
 *
 * Calculates LFO modulation ranges based on target parameter characteristics.
 * Implements asymmetric depth calculation per spec clarification:
 * - Upward range: (max - base) * (depth / 100)
 * - Downward range: (base - min) * (depth / 100)
 * - Gain value: averaged for single GainNode implementation
 */

import type {
  DepthCalculationInput,
  DepthCalculationResult,
  ValidationResult,
} from './types';
import { validateDepthCalculationInput } from './validation';

/**
 * Core calculator class for parameter-aware LFO depth
 * Stateless pure functions for predictable behavior
 */
export class ParameterAwareDepthCalculator {
  /**
   * Calculate parameter-aware modulation ranges
   *
   * Implements asymmetric depth calculation:
   * - Independent calculation for upward and downward ranges
   * - Depth percentage applied to available range in each direction
   * - Averaged gain for simplified single-GainNode architecture
   *
   * @param input - Depth calculation input (parameter bounds, base value, depth%)
   * @returns Calculation result with ranges and gain, or validation error
   */
  calculateModulationRanges(
    input: DepthCalculationInput
  ): ValidationResult<DepthCalculationResult> {
    // Validate inputs before calculation
    const validationResult = validateDepthCalculationInput(input);
    if (!validationResult.valid) {
      return validationResult;
    }

    const { parameterMin, parameterMax, baseValue, depthPercent } = input;

    // Calculate asymmetric ranges independently
    // Upward range: distance from base to max, scaled by depth percentage
    const upwardRange = (parameterMax - baseValue) * (depthPercent / 100);

    // Downward range: distance from min to base, scaled by depth percentage
    const downwardRange = (baseValue - parameterMin) * (depthPercent / 100);

    // Averaged gain for single GainNode (research decision)
    // This provides good accuracy for symmetric and near-symmetric cases
    const gain = (upwardRange + downwardRange) / 2;

    // Calculate effective bounds for UI display
    const effectiveMin = baseValue - downwardRange;
    const effectiveMax = baseValue + upwardRange;

    return {
      valid: true,
      value: {
        upwardRange,
        downwardRange,
        gain,
        effectiveMin,
        effectiveMax,
        inputs: input,
      },
    };
  }

  /**
   * Apply modulation to parameter value
   *
   * Transforms LFO output (-1 to +1) into parameter value change
   * Uses pre-calculated ranges for performance (event-driven calculation)
   *
   * @param baseValue - Parameter base value (center point)
   * @param lfoOutput - Normalized LFO output (-1 to +1)
   * @param ranges - Pre-calculated modulation ranges
   * @param paramMin - Parameter minimum (for clamping)
   * @param paramMax - Parameter maximum (for clamping)
   * @returns Final modulated parameter value, clamped to [paramMin, paramMax]
   */
  applyModulation(
    baseValue: number,
    lfoOutput: number,
    ranges: DepthCalculationResult,
    paramMin: number,
    paramMax: number
  ): number {
    // Map LFO bipolar output (-1 to +1) to modulation amount
    // Positive LFO → upward modulation, Negative LFO → downward modulation
    let modulationAmount: number;

    if (lfoOutput >= 0) {
      // Positive: use upward range
      modulationAmount = lfoOutput * ranges.upwardRange;
    } else {
      // Negative: use downward range (lfoOutput is negative, so this adds negative value)
      modulationAmount = lfoOutput * ranges.downwardRange;
    }

    // Apply modulation additively (per spec FR-012)
    const modulatedValue = baseValue + modulationAmount;

    // Clamp to parameter bounds (per spec FR-004)
    return Math.max(paramMin, Math.min(paramMax, modulatedValue));
  }
}

/**
 * Singleton instance for global access
 * Stateless calculator can be safely shared
 */
export const parameterAwareDepthCalculator = new ParameterAwareDepthCalculator();
