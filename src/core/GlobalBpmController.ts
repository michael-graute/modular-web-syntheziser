/**
 * GlobalBpmController - Authoritative global BPM value for the modular synthesizer.
 *
 * Holds the single global BPM that all tempo-aware components follow by default.
 * Changes are broadcast synchronously via EventBus so all subscribers receive
 * the new value within the same call-stack turn.
 */

import { EventType, PatchData } from './types';
import { eventBus } from './EventBus';
import { clampBpm, BPM_DEFAULT } from './bpmValidation';

export class GlobalBpmController {
  private _bpm: number = BPM_DEFAULT;

  /**
   * Returns the current global BPM value.
   */
  getBpm(): number {
    return this._bpm;
  }

  /**
   * Sets the global BPM, clamping to the valid range [30–300].
   * Emits GLOBAL_BPM_CHANGED only when the value actually changes.
   */
  setBpm(value: number): void {
    const clamped = clampBpm(value);
    if (clamped === this._bpm) return;
    this._bpm = clamped;
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: this._bpm });
  }

  /**
   * Reads the global BPM from a loaded patch.
   * Falls back to BPM_DEFAULT when the field is absent (legacy patches).
   */
  loadFromPatch(patch: PatchData): void {
    this.setBpm(patch.globalBpm ?? BPM_DEFAULT);
  }

  /**
   * Injects the current global BPM into a patch object before saving.
   * Returns a new object — does not mutate the input.
   */
  saveToPatch(patch: PatchData): PatchData {
    return { ...patch, globalBpm: this._bpm };
  }
}

/** Singleton instance shared across the application */
export const globalBpmController = new GlobalBpmController();
