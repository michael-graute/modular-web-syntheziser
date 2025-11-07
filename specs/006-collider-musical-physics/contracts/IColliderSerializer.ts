/**
 * IColliderSerializer - Persistence interface
 *
 * Handles serialization and deserialization of Collider component configuration
 * and simulation state. Integrates with existing PatchSerializer pattern for
 * saving/loading patches.
 *
 * Implementation notes:
 * - Serializes to ComponentData format (matches existing components)
 * - Enum values stored as indices for type safety
 * - Simulation state (collider positions/velocities) NOT persisted
 * - Only configuration is saved (FR-021)
 * - Validation performed during deserialization
 *
 * @see data-model.md section 8 (Serialization Format)
 * @see src/core/PatchSerializer.ts for integration pattern
 */

import type {
  ColliderConfig,
  ColliderSimulationState,
  ComponentData,
} from './types';

/**
 * Serializer interface for Collider component persistence
 */
export interface IColliderSerializer {
  /**
   * Serialize component configuration to ComponentData
   *
   * Converts ColliderConfig to parameters object with enum indices.
   * Compatible with PatchSerializer format.
   *
   * @param config - Current collider configuration
   * @param state - Current simulation state (for metadata only)
   * @returns ComponentData for patch serialization
   *
   * @example
   * ```typescript
   * const config: ColliderConfig = {
   *   scaleType: ScaleType.MAJOR,
   *   rootNote: Note.C,
   *   colliderCount: 5,
   *   speedPreset: SpeedPreset.MEDIUM,
   *   bpm: 120,
   *   gateSize: GateSize.QUARTER,
   * };
   *
   * const data = serializer.serialize(config, state);
   * // Returns:
   * // {
   * //   id: 'collider-123',
   * //   type: ComponentType.COLLIDER,
   * //   position: { x: 250, y: 180 },
   * //   parameters: {
   * //     scaleType: 0,      // ScaleType.MAJOR
   * //     rootNote: 0,       // Note.C
   * //     colliderCount: 5,
   * //     speedPreset: 1,    // SpeedPreset.MEDIUM
   * //     bpm: 120,
   * //     gateSize: 0.25,    // GateSize.QUARTER
   * //   },
   * //   isBypassed: false,
   * // }
   * ```
   */
  serialize(
    config: ColliderConfig,
    state: ColliderSimulationState
  ): ComponentData;

  /**
   * Deserialize ComponentData to configuration and state
   *
   * Converts ComponentData parameters to typed ColliderConfig.
   * Validates all values during deserialization.
   * Creates initial simulation state (colliders not restored).
   *
   * @param data - ComponentData from patch file
   * @returns Configuration and initial state
   * @throws Error if data is invalid or fails validation
   *
   * @example
   * ```typescript
   * const data: ComponentData = {
   *   id: 'collider-123',
   *   type: ComponentType.COLLIDER,
   *   position: { x: 250, y: 180 },
   *   parameters: {
   *     scaleType: 0,
   *     rootNote: 0,
   *     colliderCount: 5,
   *     speedPreset: 1,
   *     bpm: 120,
   *     gateSize: 0.25,
   *   },
   * };
   *
   * const { config, state } = serializer.deserialize(data);
   * // config contains validated ColliderConfig
   * // state contains fresh ColliderSimulationState (stopped, no colliders)
   * ```
   */
  deserialize(data: ComponentData): {
    config: ColliderConfig;
    state: ColliderSimulationState;
  };

  /**
   * Serialize configuration only (no state)
   *
   * Converts ColliderConfig to parameters object for storage.
   * Used when only configuration needs to be saved/copied.
   *
   * @param config - Configuration to serialize
   * @returns Parameters object for ComponentData
   *
   * @example
   * ```typescript
   * const params = serializer.serializeConfig(config);
   * // Returns: { scaleType: 0, rootNote: 0, colliderCount: 5, ... }
   * ```
   */
  serializeConfig(config: ColliderConfig): Record<string, number>;

  /**
   * Deserialize configuration from parameters
   *
   * Converts parameters object to typed ColliderConfig.
   * Validates all values.
   *
   * @param parameters - Parameters from ComponentData
   * @returns Validated ColliderConfig
   * @throws Error if parameters are invalid
   *
   * @example
   * ```typescript
   * const params = { scaleType: 0, rootNote: 0, colliderCount: 5, ... };
   * const config = serializer.deserializeConfig(params);
   * // Returns validated ColliderConfig
   * ```
   */
  deserializeConfig(parameters: Record<string, number>): ColliderConfig;

  /**
   * Validate serialized data before deserialization
   *
   * Checks if ComponentData contains valid Collider parameters.
   * Does not throw - returns validation result.
   *
   * @param data - ComponentData to validate
   * @returns Validation result with error messages if invalid
   *
   * @example
   * ```typescript
   * const validation = serializer.validateData(data);
   * if (!validation.isValid) {
   *   console.error('Invalid data:', validation.errors);
   *   return;
   * }
   * const { config } = serializer.deserialize(data);
   * ```
   */
  validateData(data: ComponentData): {
    isValid: boolean;
    errors: string[];
  };

  /**
   * Get default configuration
   *
   * Returns default ColliderConfig for new components.
   *
   * @returns Default configuration values
   *
   * @example
   * ```typescript
   * const defaultConfig = serializer.getDefaultConfig();
   * // Returns:
   * // {
   * //   scaleType: ScaleType.MAJOR,
   * //   rootNote: Note.C,
   * //   colliderCount: 5,
   * //   speedPreset: SpeedPreset.MEDIUM,
   * //   bpm: 120,
   * //   gateSize: GateSize.QUARTER,
   * // }
   * ```
   */
  getDefaultConfig(): ColliderConfig;

  /**
   * Clone configuration
   *
   * Creates a deep copy of configuration object.
   *
   * @param config - Configuration to clone
   * @returns Independent copy of configuration
   *
   * @example
   * ```typescript
   * const copy = serializer.cloneConfig(config);
   * copy.bpm = 140; // Does not affect original
   * ```
   */
  cloneConfig(config: ColliderConfig): ColliderConfig;
}
