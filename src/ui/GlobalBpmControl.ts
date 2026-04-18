/**
 * GlobalBpmControl - Toolbar widget for setting the global BPM
 *
 * Renders a numeric input (30–300) and a Tap button.
 * Reads/writes via globalBpmController and stays in sync via GLOBAL_BPM_CHANGED.
 */

import { globalBpmController } from '../core/GlobalBpmController';
import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';
import { BPM_MIN, BPM_MAX, TAP_TEMPO_WINDOW_MS, TAP_TEMPO_MIN_TAPS } from '../core/bpmValidation';
import type { GlobalBpmChangedPayload } from '../core/types';

export class GlobalBpmControl {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private tapTimes: number[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // Build DOM
    const label = document.createElement('label');
    label.textContent = 'BPM';
    label.style.cssText = 'font-size:12px;color:var(--color-text-secondary,#aaa);margin-right:4px;';

    this.input = document.createElement('input');
    this.input.type = 'number';
    this.input.min = String(BPM_MIN);
    this.input.max = String(BPM_MAX);
    this.input.step = '1';
    this.input.value = String(globalBpmController.getBpm());
    this.input.style.cssText = 'width:56px;text-align:center;';
    this.input.title = 'Global BPM';

    const tapBtn = document.createElement('button');
    tapBtn.textContent = 'Tap';
    tapBtn.title = 'Tap Tempo';

    // Wire input events
    this.input.addEventListener('change', () => {
      globalBpmController.setBpm(Number(this.input.value));
    });
    this.input.addEventListener('input', () => {
      globalBpmController.setBpm(Number(this.input.value));
    });

    // Wire tap button
    tapBtn.addEventListener('click', () => this.handleTap());

    // Subscribe to GLOBAL_BPM_CHANGED so external changes (patch load) update the display
    this.unsubscribe = eventBus.on(EventType.GLOBAL_BPM_CHANGED, (data) => {
      this.input.value = String((data as GlobalBpmChangedPayload).bpm);
    });

    // Assemble
    this.container.style.cssText = 'display:flex;align-items:center;gap:4px;margin-right:50px';
    this.container.appendChild(label);
    this.container.appendChild(this.input);
    this.container.appendChild(tapBtn);
  }

  /**
   * Handle a tap event for tap-tempo calculation.
   * Pushes the current timestamp, discards old entries outside the window,
   * then computes the average interval BPM if enough taps have been received.
   */
  private handleTap(): void {
    const now = Date.now();

    // Add current tap
    this.tapTimes.push(now);

    // Discard entries older than TAP_TEMPO_WINDOW_MS
    this.tapTimes = this.tapTimes.filter((t) => now - t <= TAP_TEMPO_WINDOW_MS);

    if (this.tapTimes.length >= TAP_TEMPO_MIN_TAPS) {
      // Compute average interval between consecutive taps
      let totalInterval = 0;
      for (let i = 1; i < this.tapTimes.length; i++) {
        totalInterval += this.tapTimes[i]! - this.tapTimes[i - 1]!;
      }
      const avgIntervalMs = totalInterval / (this.tapTimes.length - 1);
      const bpm = Math.round(60000 / avgIntervalMs);
      globalBpmController.setBpm(bpm);
    }
  }

  /**
   * Detach event listeners (call when the widget is removed from the DOM).
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
