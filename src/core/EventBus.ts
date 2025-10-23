/**
 * EventBus - Custom event system for component communication
 * Implements publish-subscribe pattern for loose coupling
 */

import { EventType } from './types';

type EventCallback = (data?: unknown) => void;

/**
 * EventBus class for application-wide event handling
 */
export class EventBus {
  private listeners: Map<string, EventCallback[]>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param event - Event type to listen for
   * @param callback - Function to call when event is emitted
   * @returns Unsubscribe function
   */
  on(event: EventType | string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.push(callback);
    }

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param event - Event type to stop listening to
   * @param callback - Callback function to remove
   */
  off(event: EventType | string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) {
      return;
    }

    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }

    // Clean up empty listener arrays
    if (callbacks.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event type to emit
   * @param data - Optional data to pass to listeners
   */
  emit(event: EventType | string, data?: unknown): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks || callbacks.length === 0) {
      return;
    }

    // Call all callbacks with the provided data
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error);
      }
    });
  }

  /**
   * Subscribe to an event that will only fire once
   * @param event - Event type to listen for
   * @param callback - Function to call when event is emitted
   * @returns Unsubscribe function
   */
  once(event: EventType | string, callback: EventCallback): () => void {
    const wrappedCallback = (data?: unknown) => {
      callback(data);
      this.off(event, wrappedCallback);
    };

    return this.on(event, wrappedCallback);
  }

  /**
   * Remove all listeners for a specific event or all events
   * @param event - Optional event type to clear. If omitted, clears all events
   */
  clear(event?: EventType | string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for a specific event
   * @param event - Event type to count listeners for
   * @returns Number of listeners
   */
  listenerCount(event: EventType | string): number {
    const callbacks = this.listeners.get(event);
    return callbacks ? callbacks.length : 0;
  }

  /**
   * Check if there are any listeners for a specific event
   * @param event - Event type to check
   * @returns True if there are listeners, false otherwise
   */
  hasListeners(event: EventType | string): boolean {
    return this.listenerCount(event) > 0;
  }
}

// Export singleton instance
export const eventBus = new EventBus();
