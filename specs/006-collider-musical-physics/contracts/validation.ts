/**
 * Validation functions for Collider configuration
 * Ensures all configuration values are within acceptable ranges
 */

import type { ColliderConfig, ValidationResult, ScaleType, Note, SpeedPreset, GateSize } from './types';
import { ScaleType as ScaleTypeEnum, Note as NoteEnum, SpeedPreset as SpeedPresetEnum, GateSize as GateSizeEnum } from './types';

/**
 * Validate collider count
 * @param count - Number of colliders
 * @returns Validation result
 */
export function validateColliderCount(count: number): ValidationResult {
  const errors: string[] = [];

  if (typeof count !== 'number' || !isFinite(count)) {
    errors.push('Collider count must be a finite number');
  } else if (!Number.isInteger(count)) {
    errors.push('Collider count must be an integer');
  } else if (count < 1) {
    errors.push('Collider count must be at least 1');
  } else if (count > 20) {
    errors.push('Collider count must not exceed 20');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate BPM value
 * @param bpm - Beats per minute
 * @returns Validation result
 */
export function validateBPM(bpm: number): ValidationResult {
  const errors: string[] = [];

  if (typeof bpm !== 'number' || !isFinite(bpm)) {
    errors.push('BPM must be a finite number');
  } else if (bpm < 30) {
    errors.push('BPM must be at least 30');
  } else if (bpm > 300) {
    errors.push('BPM must not exceed 300');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate scale type
 * @param scaleType - Scale type enum value
 * @returns Validation result
 */
export function validateScaleType(scaleType: ScaleType): ValidationResult {
  const errors: string[] = [];

  const validScaleTypes = Object.values(ScaleTypeEnum);
  if (!validScaleTypes.includes(scaleType)) {
    errors.push(`Invalid scale type: ${scaleType}. Must be one of: ${validScaleTypes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate root note
 * @param note - Note enum value
 * @returns Validation result
 */
export function validateRootNote(note: Note): ValidationResult {
  const errors: string[] = [];

  const validNotes = Object.values(NoteEnum);
  if (!validNotes.includes(note)) {
    errors.push(`Invalid root note: ${note}. Must be one of: ${validNotes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate speed preset
 * @param speedPreset - Speed preset enum value
 * @returns Validation result
 */
export function validateSpeedPreset(speedPreset: SpeedPreset): ValidationResult {
  const errors: string[] = [];

  const validPresets = Object.values(SpeedPresetEnum);
  if (!validPresets.includes(speedPreset)) {
    errors.push(`Invalid speed preset: ${speedPreset}. Must be one of: ${validPresets.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate gate size
 * @param gateSize - Gate size enum value
 * @returns Validation result
 */
export function validateGateSize(gateSize: GateSize): ValidationResult {
  const errors: string[] = [];

  const validGateSizes = Object.values(GateSizeEnum);
  if (!validGateSizes.includes(gateSize)) {
    errors.push(`Invalid gate size: ${gateSize}. Must be one of: ${validGateSizes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate complete collider configuration
 * @param config - Collider configuration object
 * @returns Validation result with all errors
 */
export function validateColliderConfig(config: ColliderConfig): ValidationResult {
  const allErrors: string[] = [];

  // Validate scale type
  const scaleTypeResult = validateScaleType(config.scaleType);
  allErrors.push(...scaleTypeResult.errors);

  // Validate root note
  const rootNoteResult = validateRootNote(config.rootNote);
  allErrors.push(...rootNoteResult.errors);

  // Validate collider count
  const colliderCountResult = validateColliderCount(config.colliderCount);
  allErrors.push(...colliderCountResult.errors);

  // Validate speed preset
  const speedPresetResult = validateSpeedPreset(config.speedPreset);
  allErrors.push(...speedPresetResult.errors);

  // Validate BPM
  const bpmResult = validateBPM(config.bpm);
  allErrors.push(...bpmResult.errors);

  // Validate gate size
  const gateSizeResult = validateGateSize(config.gateSize);
  allErrors.push(...gateSizeResult.errors);

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Generate non-overlapping position with retry logic
 * Attempts to find a valid position up to maxAttempts times
 *
 * @param existingPositions - Array of existing collider positions
 * @param radius - Collider radius
 * @param boundary - Collision boundary
 * @param maxAttempts - Maximum number of attempts (default: 100)
 * @returns Valid position or null if failed
 */
export function generateNonOverlappingPosition(
  existingPositions: { x: number; y: number }[],
  radius: number,
  boundary: { left: number; top: number; right: number; bottom: number },
  maxAttempts: number = 100
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random position within boundary (with radius padding)
    const x = boundary.left + radius + Math.random() * (boundary.right - boundary.left - 2 * radius);
    const y = boundary.top + radius + Math.random() * (boundary.bottom - boundary.top - 2 * radius);

    // Check for overlaps with existing colliders
    const overlaps = existingPositions.some(pos => {
      const dx = x - pos.x;
      const dy = y - pos.y;
      const distanceSquared = dx * dx + dy * dy;
      const minDistance = 2 * radius; // Two radii for non-overlapping circles
      return distanceSquared < (minDistance * minDistance);
    });

    if (!overlaps) {
      return { x, y };
    }
  }

  // Failed to find non-overlapping position
  return null;
}

/**
 * Validate boundary dimensions for collider count
 * Checks if boundary is large enough to fit all colliders
 *
 * @param colliderCount - Number of colliders
 * @param radius - Collider radius
 * @param boundary - Collision boundary
 * @returns Validation result
 */
export function validateBoundarySize(
  colliderCount: number,
  radius: number,
  boundary: { left: number; top: number; right: number; bottom: number }
): ValidationResult {
  const errors: string[] = [];

  const width = boundary.right - boundary.left;
  const height = boundary.bottom - boundary.top;

  // Minimum area needed (very rough estimate)
  const colliderArea = Math.PI * radius * radius;
  const totalColliderArea = colliderArea * colliderCount * 2; // 2x for spacing
  const availableArea = width * height;

  if (totalColliderArea > availableArea) {
    errors.push(
      `Boundary too small for ${colliderCount} colliders. ` +
      `Reduce collider count or increase component size.`
    );
  }

  // Minimum dimension check
  const minDimension = radius * 4; // At least 4 radii for reasonable movement
  if (width < minDimension || height < minDimension) {
    errors.push(
      `Boundary dimensions too small. ` +
      `Minimum width and height should be at least ${minDimension}px.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
