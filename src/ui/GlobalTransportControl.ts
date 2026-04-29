/**
 * GlobalTransportControl — toolbar widget for the global transport.
 *
 * Renders a ▶/■ toggle button and a bar.beat position display.
 * Mirrors GlobalBpmControl's DOM construction and EventBus subscription pattern.
 */

import { globalTransportController, TransportState } from '../core/GlobalTransportController';
import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';
import type { TransportBeatPayload } from '../core/types';

export class GlobalTransportControl {
  private container: HTMLElement;
  private button: HTMLButtonElement;
  private positionSpan: HTMLSpanElement;
  private unsubscribePlay: (() => void) | null = null;
  private unsubscribeStop: (() => void) | null = null;
  private unsubscribeBeat: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // Toggle button
    this.button = document.createElement('button');
    this.button.textContent = '▶';
    this.button.setAttribute('aria-label', 'Play transport');
    this.button.title = 'Play / Stop transport';

    // Position display — initialised to "1.1" before first play
    this.positionSpan = document.createElement('span');
    this.positionSpan.textContent = '1.1';
    this.positionSpan.style.cssText = 'font-size:12px;color:var(--color-text-secondary,#aaa);min-width:28px;text-align:center;';

    // Wire click
    this.button.addEventListener('click', () => {
      if (globalTransportController.getState() === TransportState.PLAYING) {
        globalTransportController.stop();
      } else {
        globalTransportController.play();
      }
    });

    // Stay in sync with programmatic state changes (T012)
    this.unsubscribePlay = eventBus.on(EventType.TRANSPORT_PLAY, () => {
      this.button.textContent = '■';
      this.button.setAttribute('aria-label', 'Stop transport');
    });

    this.unsubscribeStop = eventBus.on(EventType.TRANSPORT_STOP, () => {
      this.button.textContent = '▶';
      this.button.setAttribute('aria-label', 'Play transport');
      this.positionSpan.textContent = '1.1';
    });

    // Beat display (T015)
    this.unsubscribeBeat = eventBus.on(EventType.TRANSPORT_BEAT, (data) => {
      const { bar, beat } = data as TransportBeatPayload;
      this.positionSpan.textContent = `${bar}.${beat}`;
    });

    // Assemble
    this.container.style.cssText = 'display:flex;align-items:center;gap:6px;margin-right:12px;';
    this.container.appendChild(this.button);
    this.container.appendChild(this.positionSpan);
  }

  /** Detach event listeners (call when the widget is removed from the DOM). */
  destroy(): void {
    this.unsubscribePlay?.();
    this.unsubscribeStop?.();
    this.unsubscribeBeat?.();
    this.unsubscribePlay = null;
    this.unsubscribeStop = null;
    this.unsubscribeBeat = null;
  }
}
