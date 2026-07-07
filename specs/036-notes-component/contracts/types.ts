/**
 * Type definitions and constants for the Notes component.
 *
 * Imported directly as source by src/ code and tests, per this project's
 * convention (see Looper.ts importing from specs/015-bpm-looper/contracts/).
 *
 * @see ../data-model.md for complete documentation
 */

export const NOTES = {
  /**
   * Maximum note length in characters. Generous for the expected use case
   * ("a paragraph or two" of patch documentation) while bounding patch JSON
   * growth. Enforced authoritatively in Notes.setText via clampText and
   * mirrored as the textarea's maxLength attribute.
   */
  MAX_TEXT_LENGTH: 10_000,

  /** Placeholder shown in an empty Notes textarea (US1 acceptance scenario 4). */
  PLACEHOLDER: 'Add notes about this patch…',
} as const;
