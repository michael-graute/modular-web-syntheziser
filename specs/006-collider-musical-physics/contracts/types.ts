/**
 * Type definitions for Collider Musical Physics component
 *
 * This file exports all types from the data model for use in contracts.
 * Import these types in interface files, not the full data model.
 *
 * @see ../data-model.md for complete type documentation
 */

// Core types
export interface Vector2D {
  x: number;
  y: number;
}

// Enumerations
export enum Note {
  C = 'C',
  C_SHARP = 'C#',
  D = 'D',
  D_SHARP = 'D#',
  E = 'E',
  F = 'F',
  F_SHARP = 'F#',
  G = 'G',
  G_SHARP = 'G#',
  A = 'A',
  A_SHARP = 'A#',
  B = 'B',
}

export enum ScaleType {
  MAJOR = 'major',
  HARMONIC_MINOR = 'harmonic-minor',
  NATURAL_MINOR = 'natural-minor',
  LYDIAN = 'lydian',
  MIXOLYDIAN = 'mixolydian',
}

export enum SpeedPreset {
  SLOW = 'slow',
  MEDIUM = 'medium',
  FAST = 'fast',
}

export enum GateSize {
  WHOLE = 1,
  HALF = 0.5,
  QUARTER = 0.25,
  EIGHTH = 0.125,
  SIXTEENTH = 0.0625,
}

// Physics types
export interface Collider {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
  scaleDegree: number;
  cvVoltage: number;
  color: string;
  mass: number;
}

export interface CollisionBoundary {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface CollisionEvent {
  type: 'wall' | 'collider';
  timestamp: number;
  colliderId: string;
  wallSide?: 'left' | 'right' | 'top' | 'bottom';
  otherColliderId?: string;
}

// Musical types
export interface MusicalScale {
  scaleType: ScaleType;
  rootNote: Note;
  intervals: readonly number[];
  cvVoltages: readonly number[];
  weights: readonly number[];
}

// Configuration types
export interface ColliderConfig {
  scaleType: ScaleType;
  rootNote: Note;
  colliderCount: number;
  speedPreset: SpeedPreset;
  bpm: number;
  gateSize: GateSize;
}

/**
 * Default Collider configuration
 * Used when creating new components or when deserialization fails
 * FR-021: Default values for all configuration parameters
 */
export const DEFAULT_COLLIDER_CONFIG: ColliderConfig = {
  scaleType: ScaleType.MAJOR,
  rootNote: Note.C,
  colliderCount: 5,
  speedPreset: SpeedPreset.MEDIUM,
  bpm: 120,
  gateSize: GateSize.QUARTER,
};

// Audio output types
export interface GateOutput {
  cvValue: number;
  gateDurationMs: number;
  scheduleTime: number;
}

// Component state types
export interface ColliderSimulationState {
  isRunning: boolean;
  colliders: Collider[];
  boundary: CollisionBoundary;
  scale: MusicalScale;
  config: ColliderConfig;
  animationFrameId: number | null;
  lastUpdateTime: number;
  audioGenerator: any | null; // CVGateGenerator type (implementation-specific)
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Component data (for serialization)
export interface ComponentData {
  id: string;
  type: string; // ComponentType enum from core/types.ts
  position: { x: number; y: number };
  parameters: Record<string, number>;
  isBypassed?: boolean;
}
