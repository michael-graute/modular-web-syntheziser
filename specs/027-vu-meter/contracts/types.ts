/**
 * Type contracts for the VU Meter feature (027).
 * These types describe the public interface of VuMeter and VuMeterDisplay.
 */

/**
 * Public interface exposed by VuMeter for use by VuMeterDisplay.
 */
export interface IVuMeter {
  /** Returns the current peak amplitude in the range [0, 1]. Returns 0 when no signal. */
  getPeakLevel(): number;
}

/**
 * Configuration constants for the segmented VU display.
 * Centralised here so VuMeterDisplay and tests share the same values.
 */
export interface VuMeterDisplayConfig {
  /** Total number of vertical segments */
  segmentCount: number;
  /** Number of green (safe) segments starting from the bottom */
  greenSegments: number;
  /** Number of yellow (nominal) segments above the green zone */
  yellowSegments: number;
  /** Number of red (clip danger) segments at the top */
  redSegments: number;
  /** Milliseconds the peak hold marker stays at peak before decaying */
  peakHoldDurationMs: number;
  /** Fractional level decay per render frame (applied after hold expires) */
  peakDecayRate: number;
}

/**
 * Snapshot of VuMeterDisplay internal state (useful for testing).
 */
export interface VuMeterDisplayState {
  peakHoldLevel: number;
  isFrozen: boolean;
}
