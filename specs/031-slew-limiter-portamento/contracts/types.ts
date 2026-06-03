/**
 * Type contracts for the Slew Limiter / Portamento component.
 * Feature: 031-slew-limiter-portamento
 */

/** Persisted parameter record stored in ComponentData.parameters. */
export interface SlewLimiterParams {
  /** Rise time in ms — upward slew. Range: [0, 5000]. Default: 50. */
  rise: number;
  /** Fall time in ms — downward slew. Range: [0, 5000]. Default: 50. */
  fall: number;
}

export const SLEW_LIMITER_DEFAULTS: SlewLimiterParams = {
  rise: 50,
  fall: 50,
};

export const SLEW_LIMITER_RISE_MIN = 0;
export const SLEW_LIMITER_RISE_MAX = 5000;
export const SLEW_LIMITER_FALL_MIN = 0;
export const SLEW_LIMITER_FALL_MAX = 5000;
