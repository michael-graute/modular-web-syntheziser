/**
 * Validation Functions
 * Feature: 008-lfo-parameter-depth - Parameter-Aware LFO Depth
 *
 * Runtime validation for depth calculation inputs, edge cases, and error handling.
 * All validation functions return ValidationResult discriminated unions for type-safe error handling.
 */

import type {
  DepthCalculationInput,
  ValidationResult,
  ValidationError,
  DepthValidationError,
  ParameterBounds,
} from './types';
import { DEPTH_VALIDATION } from './types';

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Validates depth calculation input parameters
 * Checks all preconditions for safe depth calculation
 *
 * @param input - Depth calculation input to validate
 * @returns ValidationResult with valid input or error
 */
export function validateDepthCalculationInput(
  input: DepthCalculationInput
): ValidationResult<DepthCalculationInput> {
  // Check for invalid numbers (NaN, Infinity)
  if (
    !isFinite(input.parameterMin) ||
    !isFinite(input.parameterMax) ||
    !isFinite(input.baseValue) ||
    !isFinite(input.depthPercent)
  ) {
    return {
      valid: false,
      error: {
        code: DepthValidationError.INVALID_NUMBER,
        message: 'Input contains invalid number (NaN or Infinity)',
        details: { input },
      },
    };
  }

  // Check depth range (0-100%)
  if (
    input.depthPercent < DEPTH_VALIDATION.MIN_DEPTH ||
    input.depthPercent > DEPTH_VALIDATION.MAX_DEPTH
  ) {
    return {
      valid: false,
      error: {
        code: DepthValidationError.INVALID_DEPTH,
        message: `Depth must be between ${DEPTH_VALIDATION.MIN_DEPTH} and ${DEPTH_VALIDATION.MAX_DEPTH}, got ${input.depthPercent}`,
        details: { depthPercent: input.depthPercent },
      },
    };
  }

  // Check for zero range (min === max)
  // Use epsilon for floating-point comparison
  const range = input.parameterMax - input.parameterMin;
  if (Math.abs(range) < DEPTH_VALIDATION.EPSILON) {
    return {
      valid: false,
      error: {
        code: DepthValidationError.ZERO_RANGE,
        message: `Parameter has zero range (min=${input.parameterMin}, max=${input.parameterMax})`,
        details: {
          parameterMin: input.parameterMin,
          parameterMax: input.parameterMax,
          range,
        },
      },
    };
  }

  // Check base value is within bounds
  // Use epsilon for boundary comparison
  if (
    input.baseValue < input.parameterMin - DEPTH_VALIDATION.EPSILON ||
    input.baseValue > input.parameterMax + DEPTH_VALIDATION.EPSILON
  ) {
    return {
      valid: false,
      error: {
        code: DepthValidationError.BASE_OUT_OF_BOUNDS,
        message: `Base value ${input.baseValue} is outside parameter range [${input.parameterMin}, ${input.parameterMax}]`,
        details: {
          baseValue: input.baseValue,
          parameterMin: input.parameterMin,
          parameterMax: input.parameterMax,
        },
      },
    };
  }

  // All checks passed
  return {
    valid: true,
    value: input,
  };
}

/**
 * Validates parameter bounds for modulation capability
 * Checks if parameter can support modulation
 *
 * @param bounds - Parameter bounds to validate
 * @returns ValidationResult with valid bounds or error
 */
export function validateParameterBounds(
  bounds: ParameterBounds
): ValidationResult<ParameterBounds> {
  // Check for invalid numbers
  if (
    !isFinite(bounds.min) ||
    !isFinite(bounds.max) ||
    !isFinite(bounds.baseValue)
  ) {
    return {
      valid: false,
      error: {
        code: DepthValidationError.INVALID_NUMBER,
        message: 'Parameter bounds contain invalid numbers',
        details: { bounds },
      },
    };
  }

  // Check for zero range
  const range = bounds.max - bounds.min;
  if (Math.abs(range) < DEPTH_VALIDATION.EPSILON) {
    return {
      valid: false,
      error: {
        code: DepthValidationError.ZERO_RANGE,
        message: 'Parameter has zero range and cannot be modulated',
        details: {
          min: bounds.min,
          max: bounds.max,
          range,
        },
      },
    };
  }

  // Check base value is within bounds
  if (
    bounds.baseValue < bounds.min - DEPTH_VALIDATION.EPSILON ||
    bounds.baseValue > bounds.max + DEPTH_VALIDATION.EPSILON
  ) {
    return {
      valid: false,
      error: {
        code: DepthValidationError.BASE_OUT_OF_BOUNDS,
        message: 'Base value is outside parameter bounds',
        details: {
          baseValue: bounds.baseValue,
          min: bounds.min,
          max: bounds.max,
        },
      },
    };
  }

  return {
    valid: true,
    value: bounds,
  };
}

// ============================================================================
// Edge Case Handlers
// ============================================================================

/**
 * Handles zero range parameter edge case
 * Returns error result with appropriate message
 *
 * @param min - Parameter minimum
 * @param max - Parameter maximum
 * @returns ValidationError describing the issue
 */
export function handleZeroRange(min: number, max: number): ValidationError {
  return {
    code: DepthValidationError.ZERO_RANGE,
    message: `Cannot modulate parameter with zero range (min=${min}, max=${max})`,
    details: { min, max, range: max - min },
  };
}

/**
 * Handles base value at boundary edge case
 * Calculates unidirectional modulation range
 *
 * @param bounds - Parameter bounds
 * @param depthPercent - Depth percentage
 * @returns Information about the unidirectional modulation
 */
export function handleBaseAtBoundary(
  bounds: ParameterBounds,
  depthPercent: number
): {
  isAtMin: boolean;
  isAtMax: boolean;
  availableRange: number;
  direction: 'upward' | 'downward' | 'bidirectional';
} {
  const epsilon = DEPTH_VALIDATION.EPSILON;
  const isAtMin = Math.abs(bounds.baseValue - bounds.min) < epsilon;
  const isAtMax = Math.abs(bounds.baseValue - bounds.max) < epsilon;

  let direction: 'upward' | 'downward' | 'bidirectional';
  let availableRange: number;

  if (isAtMin) {
    direction = 'upward';
    availableRange = (bounds.max - bounds.min) * (depthPercent / 100);
  } else if (isAtMax) {
    direction = 'downward';
    availableRange = (bounds.max - bounds.min) * (depthPercent / 100);
  } else {
    direction = 'bidirectional';
    const upward = (bounds.max - bounds.baseValue) * (depthPercent / 100);
    const downward = (bounds.baseValue - bounds.min) * (depthPercent / 100);
    availableRange = upward + downward;
  }

  return {
    isAtMin,
    isAtMax,
    availableRange,
    direction,
  };
}

/**
 * Clamps base value to parameter bounds
 * Used to recover from invalid state
 *
 * @param baseValue - Base value to clamp
 * @param min - Parameter minimum
 * @param max - Parameter maximum
 * @returns Clamped base value and whether clamping occurred
 */
export function clampBaseValue(
  baseValue: number,
  min: number,
  max: number
): { clamped: number; wasClamped: boolean } {
  const clamped = Math.max(min, Math.min(max, baseValue));
  const wasClamped = clamped !== baseValue;

  if (wasClamped) {
    console.warn(
      `[DepthValidation] Base value ${baseValue} was outside bounds [${min}, ${max}], clamped to ${clamped}`
    );
  }

  return { clamped, wasClamped };
}

/**
 * Handles very small parameter ranges
 * Checks if range is too small for meaningful modulation
 *
 * @param min - Parameter minimum
 * @param max - Parameter maximum
 * @param threshold - Minimum acceptable range (default: 0.001)
 * @returns Warning information if range is very small
 */
export function handleSmallRange(
  min: number,
  max: number,
  threshold: number = 0.001
): {
  isTooSmall: boolean;
  range: number;
  warning?: string;
} {
  const range = max - min;
  const isTooSmall = range < threshold && range > DEPTH_VALIDATION.EPSILON;

  return {
    isTooSmall,
    range,
    warning: isTooSmall
      ? `Parameter range ${range} is very small, modulation may be imperceptible`
      : undefined,
  };
}

/**
 * Handles negative parameter ranges
 * Validates that calculation will work correctly with negative values
 *
 * @param bounds - Parameter bounds
 * @returns Information about negative range handling
 */
export function handleNegativeRange(bounds: ParameterBounds): {
  hasNegativeMin: boolean;
  hasNegativeMax: boolean;
  spansZero: boolean;
  rangeIsNegative: boolean;
} {
  const hasNegativeMin = bounds.min < 0;
  const hasNegativeMax = bounds.max < 0;
  const spansZero = bounds.min < 0 && bounds.max > 0;
  const rangeIsNegative = bounds.max < bounds.min;

  // Range should never be negative (max < min)
  if (rangeIsNegative) {
    console.error(
      `[DepthValidation] Invalid parameter bounds: max (${bounds.max}) < min (${bounds.min})`
    );
  }

  return {
    hasNegativeMin,
    hasNegativeMax,
    spansZero,
    rangeIsNegative,
  };
}

// ============================================================================
// Modulation Connection Validation
// ============================================================================

/**
 * Validates that a parameter can accept modulation connection
 * Checks exclusivity constraint (only one LFO per parameter)
 *
 * @param isAlreadyModulated - Whether parameter already has modulation
 * @param sourceComponentType - Type of source component (must be LFO)
 * @returns ValidationResult indicating if connection is allowed
 */
export function validateModulationConnection(
  isAlreadyModulated: boolean,
  sourceComponentType: string
): ValidationResult<void> {
  // Check if parameter is already modulated
  if (isAlreadyModulated) {
    return {
      valid: false,
      error: {
        code: DepthValidationError.ALREADY_MODULATED,
        message: 'Parameter is already modulated by another LFO. Only one LFO per parameter is allowed.',
        details: { isAlreadyModulated },
      },
    };
  }

  // Verify source is an LFO
  if (sourceComponentType !== 'lfo') {
    return {
      valid: false,
      error: {
        code: DepthValidationError.INVALID_SIGNAL_TYPE,
        message: `Source component must be LFO, got ${sourceComponentType}`,
        details: { sourceComponentType },
      },
    };
  }

  return {
    valid: true,
    value: undefined,
  };
}

/**
 * Validates signal type is CV for modulation
 *
 * @param signalType - Signal type to validate
 * @returns ValidationResult indicating if signal type is valid
 */
export function validateSignalType(signalType: string): ValidationResult<void> {
  if (signalType !== 'cv') {
    return {
      valid: false,
      error: {
        code: DepthValidationError.INVALID_SIGNAL_TYPE,
        message: `Modulation connections must use CV signal type, got ${signalType}`,
        details: { signalType },
      },
    };
  }

  return {
    valid: true,
    value: undefined,
  };
}

// ============================================================================
// Calculation Result Validation
// ============================================================================

/**
 * Validates depth calculation result for sanity
 * Checks that calculated values are within expected bounds
 *
 * @param result - Calculation result to validate
 * @returns true if result is valid, false with console error if invalid
 */
export function validateCalculationResult(result: {
  upwardRange: number;
  downwardRange: number;
  gain: number;
  effectiveMin: number;
  effectiveMax: number;
}): boolean {
  // Check for invalid numbers
  if (
    !isFinite(result.upwardRange) ||
    !isFinite(result.downwardRange) ||
    !isFinite(result.gain) ||
    !isFinite(result.effectiveMin) ||
    !isFinite(result.effectiveMax)
  ) {
    console.error(
      '[DepthValidation] Calculation result contains invalid numbers:',
      result
    );
    return false;
  }

  // Check for negative ranges (should never happen)
  if (result.upwardRange < 0 || result.downwardRange < 0) {
    console.error(
      '[DepthValidation] Calculation resulted in negative ranges:',
      result
    );
    return false;
  }

  // Check that effective bounds are ordered correctly
  if (result.effectiveMax < result.effectiveMin) {
    console.error(
      '[DepthValidation] Effective max is less than effective min:',
      result
    );
    return false;
  }

  // Check that gain is reasonable (non-negative)
  if (result.gain < 0) {
    console.error('[DepthValidation] Calculated gain is negative:', result);
    return false;
  }

  return true;
}

// ============================================================================
// Error Message Helpers
// ============================================================================

/**
 * Formats validation error for user display
 * Converts technical error into user-friendly message
 *
 * @param error - ValidationError to format
 * @returns User-friendly error message
 */
export function formatValidationError(error: ValidationError): string {
  switch (error.code) {
    case DepthValidationError.ZERO_RANGE:
      return 'This parameter cannot be modulated because it has no range (min equals max).';

    case DepthValidationError.INVALID_DEPTH:
      return `Depth value must be between 0% and 100%. ${error.message}`;

    case DepthValidationError.BASE_OUT_OF_BOUNDS:
      return 'Parameter base value is outside valid range. Please adjust the parameter value.';

    case DepthValidationError.INVALID_NUMBER:
      return 'Invalid parameter values detected. Please check parameter settings.';

    case DepthValidationError.PARAMETER_NOT_FOUND:
      return 'Target parameter not found. Connection cannot be established.';

    case DepthValidationError.ALREADY_MODULATED:
      return 'This parameter is already modulated. Disconnect the existing LFO first.';

    case DepthValidationError.INVALID_SIGNAL_TYPE:
      return 'Invalid connection type. LFO modulation requires CV signal connections.';

    default:
      return `Validation error: ${error.message}`;
  }
}

/**
 * Logs validation error with context
 * Used for debugging and error tracking
 *
 * @param error - ValidationError to log
 * @param context - Additional context information
 */
export function logValidationError(
  error: ValidationError,
  context?: Record<string, unknown>
): void {
  console.error('[DepthValidation] Validation failed:', {
    code: error.code,
    message: error.message,
    details: error.details,
    context,
  });
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validates multiple depth calculation inputs
 * Returns first error encountered or success if all valid
 *
 * @param inputs - Array of inputs to validate
 * @returns ValidationResult for batch validation
 */
export function validateBatch(
  inputs: DepthCalculationInput[]
): ValidationResult<DepthCalculationInput[]> {
  for (let i = 0; i < inputs.length; i++) {
    const result = validateDepthCalculationInput(inputs[i]);
    if (!result.valid) {
      return {
        valid: false,
        error: {
          ...result.error,
          details: {
            ...result.error.details,
            batchIndex: i,
            totalInputs: inputs.length,
          },
        },
      };
    }
  }

  return {
    valid: true,
    value: inputs,
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Re-export types for convenience
  DEPTH_VALIDATION,
};
