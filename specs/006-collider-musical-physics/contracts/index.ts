/**
 * Collider Musical Physics Component - Interface Contracts
 *
 * This module exports all TypeScript interfaces for the Collider component.
 * These contracts define the public API for physics simulation, musical scale
 * generation, timing, audio output, and serialization.
 *
 * Usage:
 * ```typescript
 * import {
 *   IPhysicsEngine,
 *   IMusicalScaleSystem,
 *   ITimingCalculator,
 *   ICVOutput,
 *   IColliderSerializer,
 * } from './contracts';
 *
 * // Or import types separately:
 * import type {
 *   Collider,
 *   CollisionEvent,
 *   MusicalScale,
 *   ColliderConfig,
 * } from './contracts';
 * ```
 *
 * @see data-model.md for complete type documentation
 * @see research.md for implementation guidance
 * @see spec.md for functional requirements
 */

// Export all interface contracts
export type { IPhysicsEngine } from './IPhysicsEngine';
export type { IMusicalScaleSystem } from './IMusicalScaleSystem';
export type { ITimingCalculator } from './ITimingCalculator';
export type { ICVOutput } from './ICVOutput';
export type { IColliderSerializer } from './IColliderSerializer';

// Export all types
export type {
  Vector2D,
  Collider,
  CollisionBoundary,
  CollisionEvent,
  MusicalScale,
  ColliderConfig,
  GateOutput,
  ColliderSimulationState,
  ValidationResult,
  ComponentData,
} from './types';

// Export enums
export {
  Note,
  ScaleType,
  SpeedPreset,
  GateSize,
} from './types';
