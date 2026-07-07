/**
 * Validation helpers for the Notes component.
 *
 * Pure functions, no DOM/AudioContext dependency, directly unit-testable
 * per the Constitution's Test Coverage requirements (utility/validation
 * functions require 100% coverage). Imported directly as source by src/
 * code and tests, per this project's convention.
 *
 * @see ../data-model.md for the invariants these enforce
 */

import { NOTES } from './types';

/**
 * Clamps note text to the maximum allowed length. All Unicode content is
 * legal — no character filtering, so quotes/symbols/emoji round-trip
 * exactly (spec edge case). Non-string inputs are not expected (TypeScript
 * strict mode), so no coercion is performed.
 */
export function clampText(text: string): string {
  if (text.length <= NOTES.MAX_TEXT_LENGTH) return text;
  return text.slice(0, NOTES.MAX_TEXT_LENGTH);
}

/**
 * Whether a serialized ComponentData.text value should be emitted at all.
 * Empty notes serialize without the field, keeping patch JSON minimal and
 * matching the Looper's conditional audioBlob assignment pattern.
 */
export function shouldSerializeText(text: string): boolean {
  return text.length > 0;
}
