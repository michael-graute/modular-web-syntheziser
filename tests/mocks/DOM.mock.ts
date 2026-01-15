/**
 * DOM Event Mocks
 *
 * Factory functions for creating mouse and touch events for canvas interaction testing.
 * Based on research.md RT-002 decision: Use manual MouseEvent construction
 */

export interface MouseEventConfig {
  clientX: number;
  clientY: number;
  button?: number; // 0=left, 1=middle, 2=right
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export interface TouchConfig {
  identifier: number;
  clientX: number;
  clientY: number;
  pageX?: number;
  pageY?: number;
  screenX?: number;
  screenY?: number;
}

/**
 * Create a mouse event for testing canvas interactions
 */
export function createMouseEvent(
  type: 'mousedown' | 'mousemove' | 'mouseup' | 'click' | 'dblclick',
  config: MouseEventConfig
): MouseEvent {
  return new MouseEvent(type, {
    clientX: config.clientX,
    clientY: config.clientY,
    button: config.button || 0,
    buttons: config.button !== undefined ? 1 << config.button : 1,
    ctrlKey: config.ctrlKey || false,
    shiftKey: config.shiftKey || false,
    altKey: config.altKey || false,
    metaKey: config.metaKey || false,
    bubbles: true,
    cancelable: true,
  });
}

/**
 * Create a touch event for testing mobile canvas interactions
 */
export function createTouchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  touches: TouchConfig[]
): TouchEvent {
  // Note: TouchEvent constructor may not be available in all test environments
  // This is a simplified mock that works with happy-dom
  const touchList = touches.map(touch => ({
    identifier: touch.identifier,
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.pageX || touch.clientX,
    pageY: touch.pageY || touch.clientY,
    screenX: touch.screenX || touch.clientX,
    screenY: touch.screenY || touch.clientY,
    target: null as any,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
  }));

  // Create a mock TouchEvent
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as any;

  event.touches = touchList;
  event.changedTouches = touchList;
  event.targetTouches = touchList;

  return event as TouchEvent;
}
