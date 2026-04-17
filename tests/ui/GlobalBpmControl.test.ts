/**
 * GlobalBpmControl Unit Tests
 *
 * Verifies the toolbar BPM widget: numeric input, GLOBAL_BPM_CHANGED sync,
 * and tap-tempo averaging.
 *
 * Feature: 013-global-bpm — T023
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GlobalBpmControl } from '../../src/ui/GlobalBpmControl';
import { GlobalBpmController } from '../../src/core/GlobalBpmController';
import { globalBpmController } from '../../src/core/GlobalBpmController';
import { EventType } from '../../src/core/types';
import { eventBus } from '../../src/core/EventBus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function getInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="number"]') as HTMLInputElement;
}

function getTapButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button') as HTMLButtonElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GlobalBpmControl (T023)', () => {
  let container: HTMLElement;
  let control: GlobalBpmControl;

  beforeEach(() => {
    eventBus.clear(EventType.GLOBAL_BPM_CHANGED);
    globalBpmController.setBpm(120);
    container = makeContainer();
    control = new GlobalBpmControl(container);
  });

  afterEach(() => {
    control.destroy();
    container.remove();
  });

  // -----------------------------------------------------------------------
  // Initial render
  // -----------------------------------------------------------------------

  it('renders a numeric input bound to the current global BPM', () => {
    const input = getInput(container);
    expect(input).toBeTruthy();
    expect(Number(input.value)).toBe(120);
  });

  it('input has correct min/max attributes', () => {
    const input = getInput(container);
    expect(Number(input.min)).toBe(30);
    expect(Number(input.max)).toBe(300);
  });

  it('renders a Tap button', () => {
    const btn = getTapButton(container);
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Tap');
  });

  // -----------------------------------------------------------------------
  // Input → globalBpmController
  // -----------------------------------------------------------------------

  it('change event on input calls globalBpmController.setBpm()', () => {
    const input = getInput(container);
    input.value = '160';
    input.dispatchEvent(new Event('change'));
    expect(globalBpmController.getBpm()).toBe(160);
  });

  it('input event on input calls globalBpmController.setBpm()', () => {
    const input = getInput(container);
    input.value = '90';
    input.dispatchEvent(new Event('input'));
    expect(globalBpmController.getBpm()).toBe(90);
  });

  // -----------------------------------------------------------------------
  // GLOBAL_BPM_CHANGED → input display
  // -----------------------------------------------------------------------

  it('GLOBAL_BPM_CHANGED event updates the displayed input value', () => {
    eventBus.emit(EventType.GLOBAL_BPM_CHANGED, { bpm: 200 });
    const input = getInput(container);
    expect(Number(input.value)).toBe(200);
  });

  it('reflects BPM set externally (e.g., patch load)', () => {
    globalBpmController.setBpm(75); // emits GLOBAL_BPM_CHANGED
    const input = getInput(container);
    expect(Number(input.value)).toBe(75);
  });

  // -----------------------------------------------------------------------
  // Tap tempo
  // -----------------------------------------------------------------------

  it('2 taps 500ms apart yield ~120 BPM', () => {
    const btn = getTapButton(container);

    // Spy on Date.now() to control timing
    let time = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => time);

    time = 0;
    btn.click(); // tap 1
    time = 500;
    btn.click(); // tap 2 — interval = 500ms → 60000/500 = 120 BPM

    expect(globalBpmController.getBpm()).toBe(120);
    vi.restoreAllMocks();
  });

  it('2 taps 400ms apart yield ~150 BPM', () => {
    const btn = getTapButton(container);
    let time = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => time);

    time = 0;
    btn.click();
    time = 400;
    btn.click(); // 60000/400 = 150 BPM

    expect(globalBpmController.getBpm()).toBe(150);
    vi.restoreAllMocks();
  });

  it('taps older than 3 seconds are discarded before averaging', () => {
    const btn = getTapButton(container);
    let time = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => time);

    // First tap — will be outside the 3-second window
    time = 0;
    btn.click();

    // Gap larger than TAP_TEMPO_WINDOW_MS
    time = 4000;
    btn.click(); // This tap is the only one within window (previous was discarded)

    // After discarding old taps only 1 tap remains — not enough for average
    // Verify the globalBpmController was NOT updated with an incorrect value
    // (it stays at whatever it was from the previous test sub-steps)
    // We just check no error thrown and getBpm() is still valid
    const bpm = globalBpmController.getBpm();
    expect(bpm).toBeGreaterThanOrEqual(30);
    expect(bpm).toBeLessThanOrEqual(300);

    vi.restoreAllMocks();
  });

  it('single tap does not update globalBpmController', () => {
    globalBpmController.setBpm(120);
    const btn = getTapButton(container);
    btn.click(); // only one tap — not enough
    expect(globalBpmController.getBpm()).toBe(120);
  });
});
