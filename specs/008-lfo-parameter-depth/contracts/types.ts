/**
 * TypeScript Type Definitions
 * Feature: 008-lfo-parameter-depth - Parameter-Aware LFO Depth
 *
 * This file defines all types and interfaces for the parameter-aware depth calculation system.
 * These types extend the existing modulation system without breaking backward compatibility.
 */

import type { Connection, SignalType } from '../../../src/core/types';

// ============================================================================
// Modulation Metadata Types
// ============================================================================

/**
 * Modulation-specific metadata for CV connections
 * Extends the base Connection interface with depth calculation state
 */
export interface ModulationMetadata {
  /**
   * Target parameter bounds cached for performance
   * Avoids repeated Parameter lookups during recalculation
   */
  targetParameterMin: number;
  targetParameterMax: number;

  /**
   * Last calculation inputs (for change detection and debugging)
   */
  lastCalculatedDepth: number;      // LFO depth percentage (0-100)
  lastCalculatedBaseValue: number;  // Parameter base value at calculation time

  /**
   * Last calculation output
   */
  lastCalculatedGain: number;       // Gain node value (averaged asymmetric gain)

  /**
   * Calculation timestamp for debugging
   */
  lastCalculatedAt: number;         // Unix timestamp (Date.now())
}

/**
 * Extended Connection interface with optional modulation metadata
 * Backward compatible: existing connections without metadata are valid
 */
export interface ModulationConnection extends Connection {
  /**
   * Optional modulation metadata
   * Only present for CV signal type connections from LFOs to parameters
   */
  modulationMetadata?: ModulationMetadata;
}

// ============================================================================
// Depth Calculation Types
// ============================================================================

/**
 * Input parameters for depth calculation
 * Describes the parameter bounds, current base value, and desired depth percentage
 */
export interface DepthCalculationInput {
  /**
   * Target parameter minimum bound
   */
  parameterMin: number;

  /**
   * Target parameter maximum bound
   */
  parameterMax: number;

  /**
   * Current base value of the parameter
   * Must satisfy: parameterMin <= baseValue <= parameterMax
   */
  baseValue: number;

  /**
   * LFO depth percentage (0-100)
   * Represents the proportion of available range to use for modulation
   */
  depthPercent: number;
}

/**
 * Result of parameter-aware depth calculation
 * Contains asymmetric range values and the effective gain to apply
 */
export interface DepthCalculationResult {
  /**
   * Asymmetric modulation ranges
   */
  upwardRange: number;      // Maximum modulation above base value: (max - base) * (depth/100)
  downwardRange: number;    // Maximum modulation below base value: (base - min) * (depth/100)

  /**
   * Effective gain value for scaling GainNode
   * Calculated as average of upward and downward ranges
   * This provides good accuracy for symmetric and near-symmetric cases
   */
  gain: number;

  /**
   * Effective modulation bounds (for UI display)
   */
  effectiveMin: number;     // base - downwardRange
  effectiveMax: number;     // base + upwardRange

  /**
   * Input parameters used for this calculation
   * Useful for debugging and validation
   */
  inputs: DepthCalculationInput;
}

/**
 * Parameter bounds information for depth calculation
 * Extracted from Parameter class for type-safe access
 */
export interface ParameterBounds {
  min: number;
  max: number;
  baseValue: number;
  range: number;  // max - min (computed value)
}

// ============================================================================
// Modulation Scaling Node Types
// ============================================================================

/**
 * Tracks a Web Audio API GainNode used for per-connection depth scaling
 * Managed by ConnectionManager, one instance per CV connection
 */
export interface ModulationScalingNode {
  /**
   * Connection ID this scaling node belongs to
   * References Connection.id for lifecycle management
   */
  connectionId: string;

  /**
   * Web Audio API GainNode for depth scaling
   * Inserted between LFO output and target AudioParam
   */
  scalingGainNode: GainNode;

  /**
   * Source audio node (LFO's gain node)
   * Cached for cleanup on disconnect
   */
  sourceNode: AudioNode;

  /**
   * Target AudioParam being modulated
   * Cached for cleanup on disconnect
   */
  targetParam: AudioParam;

  /**
   * Connection state tracking
   * True if audio graph connections are established
   */
  isConnected: boolean;
}

// ============================================================================
// Validation Error Types
// ============================================================================

/**
 * Validation error codes for depth calculation
 */
export enum DepthValidationError {
  ZERO_RANGE = 'ZERO_RANGE',                    // parameter.min === parameter.max
  INVALID_DEPTH = 'INVALID_DEPTH',              // depth < 0 or depth > 100
  BASE_OUT_OF_BOUNDS = 'BASE_OUT_OF_BOUNDS',    // base < min or base > max
  INVALID_NUMBER = 'INVALID_NUMBER',            // NaN or Infinity in inputs
  PARAMETER_NOT_FOUND = 'PARAMETER_NOT_FOUND',  // Target parameter doesn't exist
  ALREADY_MODULATED = 'ALREADY_MODULATED',      // Parameter already has modulation
  INVALID_SIGNAL_TYPE = 'INVALID_SIGNAL_TYPE',  // Connection is not CV signal type
}

/**
 * Validation error result
 * Contains error code and human-readable message
 */
export interface ValidationError {
  code: DepthValidationError;
  message: string;
  details?: Record<string, unknown>;  // Optional context for debugging
}

/**
 * Validation result discriminated union
 * Success contains the valid input, failure contains error
 */
export type ValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; error: ValidationError };

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event payload for modulation depth/base value changes
 * Emitted when recalculation is needed
 */
export interface ModulationUpdateEvent {
  /**
   * Component ID that triggered the update
   * Either LFO (depth change) or target component (base value change)
   */
  componentId: string;

  /**
   * Parameter ID that changed
   * For LFO: 'depth', for target: parameter ID
   */
  parameterId: string;

  /**
   * New value of the parameter
   */
  newValue: number;

  /**
   * Timestamp of the change
   */
  timestamp: number;
}

/**
 * Event payload for connection lifecycle with modulation data
 * Extends base ConnectionEvent with modulation-specific info
 */
export interface ModulationConnectionEvent {
  /**
   * The modulation connection that was created/removed
   */
  connection: ModulationConnection;

  /**
   * Initial depth calculation result (for connection created)
   */
  initialCalculation?: DepthCalculationResult;

  /**
   * Source component (LFO)
   */
  sourceComponentId: string;

  /**
   * Target component
   */
  targetComponentId: string;

  /**
   * Target parameter ID
   */
  targetParameterId: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for modulation depth calculation behavior
 * Can be extended for future enhancements (e.g., asymmetry mode)
 */
export interface ModulationDepthConfig {
  /**
   * Calculation mode
   * 'averaged': Use averaged gain (current implementation)
   * 'precise': Future enhancement with WaveShaperNode for true asymmetric scaling
   */
  calculationMode: 'averaged' | 'precise';

  /**
   * Enable debug logging for depth calculations
   */
  debugLogging: boolean;

  /**
   * Minimum recalculation interval in milliseconds
   * Prevents excessive recalculation on rapid parameter changes
   */
  recalculationDebounceMs: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a connection has modulation metadata
 * @param connection - Connection to check
 * @returns True if connection has modulation metadata
 */
export function hasModulationMetadata(
  connection: Connection
): connection is ModulationConnection {
  return 'modulationMetadata' in connection &&
         connection.modulationMetadata !== undefined;
}

/**
 * Type guard to check if a connection is a CV modulation connection
 * @param connection - Connection to check
 * @returns True if connection is CV signal type
 */
export function isCVConnection(connection: Connection): boolean {
  return connection.signalType === 'cv';  // SignalType.CV
}

/**
 * Type guard to check if value is a valid ValidationError
 * @param error - Value to check
 * @returns True if value is ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    Object.values(DepthValidationError).includes((error as ValidationError).code)
  );
}

/**
 * Type guard to check if a number is finite and valid
 * @param value - Value to check
 * @returns True if value is a finite number
 */
export function isValidNumber(value: number): boolean {
  return typeof value === 'number' && isFinite(value);
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Readonly version of ModulationMetadata for immutable access
 */
export type ReadonlyModulationMetadata = Readonly<ModulationMetadata>;

/**
 * Partial update to ModulationMetadata (for recalculation)
 */
export type ModulationMetadataUpdate = Partial<
  Omit<ModulationMetadata, 'lastCalculatedAt'>
> & {
  lastCalculatedAt?: number;  // Optional, defaults to Date.now()
};

/**
 * Extract modulation-specific fields from Connection
 */
export type ModulationFields = Pick<
  ModulationConnection,
  'modulationMetadata'
>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_MODULATION_CONFIG: ModulationDepthConfig = {
  calculationMode: 'averaged',
  debugLogging: false,
  recalculationDebounceMs: 10,
};

/**
 * Validation constraints
 */
export const DEPTH_VALIDATION = {
  MIN_DEPTH: 0,
  MAX_DEPTH: 100,
  EPSILON: 1e-10,  // For floating-point comparisons
} as const;

// ============================================================================
// Exports
// ============================================================================

export type {
  // Re-export base types from core
  Connection,
  SignalType,
};
