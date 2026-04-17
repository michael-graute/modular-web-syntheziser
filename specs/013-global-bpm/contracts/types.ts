/**
 * Type contracts for feature 013-global-bpm
 * Global BPM Control
 */

/** Minimum allowed BPM value */
export const BPM_MIN = 30;

/** Maximum allowed BPM value */
export const BPM_MAX = 300;

/** Default global BPM when no patch value is present */
export const BPM_DEFAULT = 120;

/** Tap tempo window: taps older than this (ms) are discarded */
export const TAP_TEMPO_WINDOW_MS = 3000;

/** Minimum taps required before tap tempo is applied */
export const TAP_TEMPO_MIN_TAPS = 2;

/**
 * BPM mode for a tempo-aware component.
 * Stored as a numeric parameter so it serializes via the existing parameter map.
 */
export enum BpmMode {
  /** Component follows the global BPM (default) */
  Global = 0,
  /** Component uses its own locally overridden BPM */
  Local = 1,
}

/**
 * Payload emitted with the GLOBAL_BPM_CHANGED event.
 */
export interface GlobalBpmChangedPayload {
  bpm: number;
}

/**
 * Extension to PatchData for global BPM persistence.
 * Added as an optional field to preserve backward compatibility.
 */
export interface GlobalBpmPatchFields {
  /** Global BPM value. Omitted in legacy patches; defaults to BPM_DEFAULT on load. */
  globalBpm?: number;
}

/**
 * Interface that tempo-aware components must satisfy to integrate
 * with the GlobalBpmController subscription mechanism.
 */
export interface TempoAware {
  /** Subscribe to global BPM changes. Called during component activation. */
  subscribeToGlobalBpm(): void;

  /** Unsubscribe from global BPM changes. Called during component deactivation. */
  unsubscribeFromGlobalBpm(): void;

  /**
   * Apply a new BPM value. Only called when component is in Global mode.
   * Must take effect at the next step/timing boundary, not mid-step.
   */
  applyGlobalBpm(bpm: number): void;
}
