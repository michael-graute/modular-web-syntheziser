/**
 * Runtime Validation for Centralized Animation Loop Migration
 * Feature: 007-visual-update-scheduler
 *
 * Validation rules and assertions for scheduler-component integration.
 */

import type {
  FrameCallback,
  SubscriptionMetadata,
  CallbackErrorContext,
} from './types';

/**
 * Validation errors
 */
export class SchedulerValidationError extends Error {
  constructor(message: string) {
    super(`[VisualUpdateScheduler] ${message}`);
    this.name = 'SchedulerValidationError';
  }
}

/**
 * Validate frame callback function
 * @throws SchedulerValidationError if callback is invalid
 */
export function validateCallback(callback: unknown): asserts callback is FrameCallback {
  if (typeof callback !== 'function') {
    throw new SchedulerValidationError(
      `Callback must be a function, got ${typeof callback}`
    );
  }

  // Check function arity (should accept 1 parameter: deltaMs)
  if (callback.length !== 1) {
    console.warn(
      `[VisualUpdateScheduler] Callback should accept 1 parameter (deltaMs), got ${callback.length}`
    );
  }
}

/**
 * Validate component ID (if provided)
 * @throws SchedulerValidationError if componentId is invalid
 */
export function validateComponentId(componentId: unknown): asserts componentId is string {
  if (componentId !== undefined) {
    if (typeof componentId !== 'string') {
      throw new SchedulerValidationError(
        `ComponentId must be a string if provided, got ${typeof componentId}`
      );
    }

    if (componentId.trim().length === 0) {
      throw new SchedulerValidationError('ComponentId cannot be empty string');
    }
  }
}

/**
 * Validate subscription metadata
 * @throws SchedulerValidationError if metadata is invalid
 */
export function validateSubscriptionMetadata(
  metadata: unknown
): asserts metadata is SubscriptionMetadata {
  if (!metadata || typeof metadata !== 'object') {
    throw new SchedulerValidationError(
      `Subscription metadata must be an object, got ${typeof metadata}`
    );
  }

  const meta = metadata as Partial<SubscriptionMetadata>;

  validateCallback(meta.callback);

  if (meta.componentId !== undefined) {
    validateComponentId(meta.componentId);
  }
}

/**
 * Assert scheduler is not currently iterating callbacks
 * Used to prevent concurrent modification
 */
export function assertNotIterating(isIterating: boolean, operation: string): void {
  if (isIterating) {
    throw new SchedulerValidationError(
      `Cannot ${operation} while iterating callbacks. Use deferred removal pattern.`
    );
  }
}

/**
 * Assert scheduler is running before certain operations
 */
export function assertRunning(isRunning: boolean, operation: string): void {
  if (!isRunning) {
    throw new SchedulerValidationError(
      `Cannot ${operation} when scheduler is not running. Call start() first.`
    );
  }
}

/**
 * Validate FPS value
 */
export function validateFPS(fps: number): void {
  if (!Number.isFinite(fps)) {
    throw new SchedulerValidationError(`FPS must be a finite number, got ${fps}`);
  }

  if (fps <= 0) {
    throw new SchedulerValidationError(`FPS must be positive, got ${fps}`);
  }

  if (fps > 240) {
    console.warn(
      `[VisualUpdateScheduler] FPS ${fps} is unusually high. Typical values: 30-60.`
    );
  }
}

/**
 * Format error context for logging (FR-012)
 */
export function formatCallbackError(context: CallbackErrorContext): string {
  const identifier = context.componentId || `callback-${context.subscriptionId}`;
  const timestamp = new Date(context.timestamp).toISOString();

  return [
    `Error in frame callback [${identifier}]:`,
    `  Frame: ${context.frameNumber}`,
    `  Time: ${timestamp}`,
    `  Error: ${context.error.message}`,
    `  Stack: ${context.error.stack || '(no stack trace)'}`,
  ].join('\n');
}

/**
 * Check for memory leaks by tracking callback count
 * Warning if callback count keeps growing
 */
export class LeakDetector {
  private maxCallbackCount: number = 0;
  private growthCounter: number = 0;
  private readonly GROWTH_THRESHOLD = 10; // Warn after 10 consecutive growths

  /**
   * Update callback count and check for leaks
   * @param currentCount - Current number of registered callbacks
   */
  update(currentCount: number): void {
    if (currentCount > this.maxCallbackCount) {
      this.maxCallbackCount = currentCount;
      this.growthCounter++;

      if (this.growthCounter >= this.GROWTH_THRESHOLD) {
        console.warn(
          `[VisualUpdateScheduler] Possible memory leak detected: ` +
            `Callback count has grown to ${currentCount} without decreasing. ` +
            `Ensure components call unsubscribe() in destroy() method.`
        );
        this.growthCounter = 0; // Reset to avoid spam
      }
    } else if (currentCount < this.maxCallbackCount) {
      // Count decreased, reset growth counter
      this.growthCounter = 0;
    }
  }

  /**
   * Reset detector (e.g., after intentional bulk subscription)
   */
  reset(): void {
    this.maxCallbackCount = 0;
    this.growthCounter = 0;
  }
}

/**
 * Validate component implements destroy pattern correctly
 * For testing/development use
 */
export function validateComponentDestroyPattern(component: {
  subscription: unknown;
  destroy: unknown;
}): void {
  if (typeof component.destroy !== 'function') {
    throw new SchedulerValidationError(
      'Component must implement destroy() method for cleanup'
    );
  }

  // Check subscription is null or SubscriptionHandle
  if (
    component.subscription !== null &&
    (!component.subscription ||
      typeof (component.subscription as { unsubscribe?: unknown }).unsubscribe !==
        'function')
  ) {
    throw new SchedulerValidationError(
      'Component subscription must be null or SubscriptionHandle with unsubscribe() method'
    );
  }
}

/**
 * Performance assertion: Verify single animation loop
 * For testing/validation
 */
export function assertSingleAnimationLoop(): void {
  // This is a conceptual check - in practice, would need to track RAF calls
  // Implementation detail: Could add counter in VisualUpdateScheduler
  // For now, manual verification in Chrome DevTools Performance tab
  console.log(
    '[VisualUpdateScheduler] Validation: Check Chrome DevTools Performance tab for single requestAnimationFrame loop'
  );
}

/**
 * Performance assertion: Verify callback count matches expected
 */
export function assertCallbackCount(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new SchedulerValidationError(
      `Expected ${expected} callbacks, got ${actual}. Possible memory leak or missing unsubscribe.`
    );
  }
}

/**
 * Validation summary for development/testing
 */
export interface ValidationReport {
  /** Total validations performed */
  totalValidations: number;

  /** Total validation errors */
  totalErrors: number;

  /** Warnings issued */
  warnings: string[];

  /** Is validation passing? */
  isPassing: boolean;
}

/**
 * Create validation report
 */
export function createValidationReport(): ValidationReport {
  return {
    totalValidations: 0,
    totalErrors: 0,
    warnings: [],
    isPassing: true,
  };
}
