/**
 * Type contracts for the Envelope Follower component (030-envelope-follower).
 *
 * These are specification-time types only — they document the intended public
 * surface of the component. The implementation must satisfy all contracts defined here.
 */

// ---------------------------------------------------------------------------
// Parameter identifiers
// ---------------------------------------------------------------------------

export type EnvelopeFollowerParamKey = 'attack' | 'release' | 'gain';

// ---------------------------------------------------------------------------
// Parameter value ranges (enforced by validation.ts at runtime)
// ---------------------------------------------------------------------------

export interface EnvelopeFollowerParamRanges {
  attack: { min: 1; max: 500; default: 10; step: 1; unit: 'ms' };
  release: { min: 5; max: 2000; default: 100; step: 5; unit: 'ms' };
  gain: { min: 0.1; max: 4.0; default: 1.0; step: 0.05; unit: '×' };
}

// ---------------------------------------------------------------------------
// Patch persistence shape (subset of ComponentData.parameters)
// ---------------------------------------------------------------------------

export interface EnvelopeFollowerPersistenceParams {
  attack: number;   // ms, integer in [1, 500]
  release: number;  // ms, multiple-of-5 in [5, 2000]
  gain: number;     // linear scalar in [0.1, 4.0]
}

// ---------------------------------------------------------------------------
// Public component interface
// ---------------------------------------------------------------------------

/**
 * The public interface that EnvelopeFollower must satisfy.
 * Verified by EnvelopeFollowerDisplay and tests.
 */
export interface IEnvelopeFollower {
  /** Returns the current smoothed envelope value in [0, 1]. */
  getEnvelopeValue(): number;

  /**
   * Advances the envelope by one frame.
   * Must be called once per animation frame from the display render loop.
   * @param dt Frame delta time in seconds.
   */
  tick(dt: number): void;
}

// ---------------------------------------------------------------------------
// Display interface
// ---------------------------------------------------------------------------

export interface IEnvelopeFollowerDisplay {
  render(ctx: CanvasRenderingContext2D): void;
  updatePosition(x: number, y: number): void;
  updateSize(width: number, height: number): void;
  setFrozen(frozen: boolean): void;
  destroy(): void;
}
