/**
 * Input validation utility functions
 */

import { SignalType } from '../core/types';

/**
 * Validate if a string is a valid UUID v4
 * @param id - String to validate
 * @returns True if valid UUID
 */
export function isValidUUID(id: string): boolean {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}

/**
 * Validate if a value is within a numeric range
 * @param value - Value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns True if value is within range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate if two signal types are compatible for connection
 * @param sourceType - Source signal type
 * @param targetType - Target signal type
 * @returns True if signals can be connected
 */
export function areSignalTypesCompatible(
  sourceType: SignalType,
  targetType: SignalType
): boolean {
  // Audio can only connect to audio
  if (sourceType === SignalType.AUDIO) {
    return targetType === SignalType.AUDIO;
  }

  // CV can connect to CV or audio (for modulation)
  if (sourceType === SignalType.CV) {
    return targetType === SignalType.CV || targetType === SignalType.AUDIO;
  }

  // Gate can only connect to gate
  if (sourceType === SignalType.GATE) {
    return targetType === SignalType.GATE;
  }

  return false;
}

/**
 * Validate patch name
 * @param name - Patch name to validate
 * @returns Validation result with error message if invalid
 */
export function validatePatchName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Patch name cannot be empty' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Patch name must be less than 100 characters' };
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(name)) {
    return { valid: false, error: 'Patch name contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Validate frequency value
 * @param frequency - Frequency in Hz
 * @returns True if valid audio frequency
 */
export function isValidFrequency(frequency: number): boolean {
  return isInRange(frequency, 20, 20000);
}

/**
 * Validate gain value
 * @param gain - Gain value (0-2)
 * @returns True if valid gain
 */
export function isValidGain(gain: number): boolean {
  return isInRange(gain, 0, 2);
}

/**
 * Sanitize a string for safe usage
 * @param str - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(str: string): string {
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Check if localStorage is available
 * @returns True if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if Web Audio API is available
 * @returns True if Web Audio API is supported
 */
export function isWebAudioSupported(): boolean {
  return 'AudioContext' in window || 'webkitAudioContext' in window;
}
