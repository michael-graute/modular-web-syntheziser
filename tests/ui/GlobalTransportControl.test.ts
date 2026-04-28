/**
 * GlobalTransportControl Unit Tests
 * Feature: 016-global-transport — T014, T017 (US1, US2)
 *
 * Tests DOM construction, click → play/stop, button text sync,
 * and position display updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GlobalTransportControl } from '../../src/ui/GlobalTransportControl';
import { globalTransportController, TransportState } from '../../src/core/GlobalTransportController';
import { eventBus } from '../../src/core/EventBus';
import { EventType } from '../../src/core/types';
import { audioEngine } from '../../src/core/AudioEngine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function getButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button') as HTMLButtonElement;
}

function getPositionSpan(container: HTMLElement): HTMLSpanElement {
  return container.querySelector('span') as HTMLSpanElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GlobalTransportControl (T014)', () => {
  let container: HTMLElement;
  let control: GlobalTransportControl;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(audioEngine, 'getContext').mockReturnValue({ currentTime: 0 } as AudioContext);
    // Ensure transport starts stopped
    globalTransportController.stop();
    eventBus.clear(EventType.TRANSPORT_PLAY);
    eventBus.clear(EventType.TRANSPORT_STOP);
    eventBus.clear(EventType.TRANSPORT_BEAT);
    container = makeContainer();
    control = new GlobalTransportControl(container);
  });

  afterEach(() => {
    control.destroy();
    globalTransportController.stop();
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Initial render (T010)
  // -------------------------------------------------------------------------

  it('renders a button with ▶ text when transport is stopped', () => {
    const btn = getButton(container);
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('▶');
  });

  it('button has aria-label="Play transport" initially', () => {
    const btn = getButton(container);
    expect(btn.getAttribute('aria-label')).toBe('Play transport');
  });

  it('renders position span initialised to "1.1"', () => {
    const span = getPositionSpan(container);
    expect(span).toBeTruthy();
    expect(span.textContent).toBe('1.1');
  });

  // -------------------------------------------------------------------------
  // Click → play / stop (T011)
  // -------------------------------------------------------------------------

  it('clicking ▶ button calls globalTransportController.play()', () => {
    const playSpy = vi.spyOn(globalTransportController, 'play');
    getButton(container).click();
    expect(playSpy).toHaveBeenCalledOnce();
  });

  it('button changes to ■ after clicking play', () => {
    getButton(container).click(); // play
    expect(getButton(container).textContent).toBe('■');
  });

  it('button has aria-label="Stop transport" while playing', () => {
    getButton(container).click(); // play
    expect(getButton(container).getAttribute('aria-label')).toBe('Stop transport');
  });

  it('clicking ■ button calls globalTransportController.stop()', () => {
    getButton(container).click(); // play → state PLAYING
    const stopSpy = vi.spyOn(globalTransportController, 'stop');
    getButton(container).click(); // stop
    expect(stopSpy).toHaveBeenCalledOnce();
  });

  it('button returns to ▶ after clicking stop', () => {
    getButton(container).click(); // play
    getButton(container).click(); // stop
    expect(getButton(container).textContent).toBe('▶');
  });

  // -------------------------------------------------------------------------
  // Programmatic state sync (T012)
  // -------------------------------------------------------------------------

  it('button changes to ■ when TRANSPORT_PLAY event is emitted directly', () => {
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);
    expect(getButton(container).textContent).toBe('■');
  });

  it('button returns to ▶ when TRANSPORT_STOP event is emitted directly', () => {
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);
    eventBus.emit(EventType.TRANSPORT_STOP, undefined);
    expect(getButton(container).textContent).toBe('▶');
  });

  // -------------------------------------------------------------------------
  // Beat position display (T015, T016 — US2)
  // -------------------------------------------------------------------------

  it('position span updates on TRANSPORT_BEAT event', () => {
    eventBus.emit(EventType.TRANSPORT_BEAT, { bar: 2, beat: 3 });
    expect(getPositionSpan(container).textContent).toBe('2.3');
  });

  it('position span resets to "1.1" on TRANSPORT_STOP', () => {
    eventBus.emit(EventType.TRANSPORT_BEAT, { bar: 3, beat: 4 });
    eventBus.emit(EventType.TRANSPORT_STOP, undefined);
    expect(getPositionSpan(container).textContent).toBe('1.1');
  });

  it('position span advances through beats as TRANSPORT_BEAT fires', () => {
    const span = getPositionSpan(container);
    eventBus.emit(EventType.TRANSPORT_BEAT, { bar: 1, beat: 1 });
    expect(span.textContent).toBe('1.1');
    eventBus.emit(EventType.TRANSPORT_BEAT, { bar: 1, beat: 2 });
    expect(span.textContent).toBe('1.2');
    eventBus.emit(EventType.TRANSPORT_BEAT, { bar: 1, beat: 3 });
    expect(span.textContent).toBe('1.3');
    eventBus.emit(EventType.TRANSPORT_BEAT, { bar: 1, beat: 4 });
    expect(span.textContent).toBe('1.4');
    eventBus.emit(EventType.TRANSPORT_BEAT, { bar: 2, beat: 1 });
    expect(span.textContent).toBe('2.1');
  });

  // -------------------------------------------------------------------------
  // Cleanup (destroy)
  // -------------------------------------------------------------------------

  it('destroy() stops listening to TRANSPORT_BEAT', () => {
    control.destroy();
    eventBus.emit(EventType.TRANSPORT_BEAT, { bar: 5, beat: 2 });
    // Position should remain at last value before destroy, not update
    expect(getPositionSpan(container).textContent).toBe('1.1');
  });

  it('destroy() stops listening to TRANSPORT_PLAY / TRANSPORT_STOP', () => {
    control.destroy();
    eventBus.emit(EventType.TRANSPORT_PLAY, undefined);
    expect(getButton(container).textContent).toBe('▶'); // unchanged
  });
});
