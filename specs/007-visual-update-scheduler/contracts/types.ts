/**
 * Type Contracts for Centralized Animation Loop Migration
 * Feature: 007-visual-update-scheduler
 *
 * These types define the interface between components and the VisualUpdateScheduler.
 */

/**
 * Callback function executed on each animation frame
 * @param deltaMs - Time elapsed since last frame in milliseconds
 */
export type FrameCallback = (deltaMs: number) => void;

/**
 * Handle returned from subscribing to frame updates
 * Provides ability to unsubscribe when component is destroyed
 */
export interface SubscriptionHandle {
  /**
   * Unsubscribe from frame updates
   * Safe to call multiple times (no-op after first call)
   * MUST be called in component destroy() method to prevent memory leaks
   */
  unsubscribe: () => void;
}

/**
 * Internal metadata for tracking subscriptions
 * Not exported - used only within VisualUpdateScheduler
 */
export interface SubscriptionMetadata {
  /** Callback function to execute each frame */
  callback: FrameCallback;

  /** Optional component identifier for error logging */
  componentId?: string;
}

/**
 * Interface for VisualUpdateScheduler (already exists in src/visualization/types.ts)
 * Documented here for completeness
 */
export interface IVisualUpdateScheduler {
  /**
   * Initialize the scheduler
   * @param targetFPS - Target frames per second (typically 60)
   * @param interpolationEnabled - Enable frame interpolation
   */
  initialize(targetFPS: number, interpolationEnabled: boolean): void;

  /**
   * Subscribe to animation frame updates
   * @param callback - Function to call each frame
   * @param componentId - Optional identifier for error logging (recommended)
   * @returns Handle with unsubscribe function
   *
   * @example
   * this.subscription = scheduler.onFrame(
   *   (deltaMs) => this.render(deltaMs),
   *   'OscilloscopeDisplay'
   * );
   */
  onFrame(callback: FrameCallback, componentId?: string): SubscriptionHandle;

  /**
   * Start the animation loop
   * Typically called once at application startup
   */
  start(): void;

  /**
   * Stop the animation loop
   * Typically called on application shutdown
   */
  stop(): void;

  /**
   * Get current FPS (frames per second)
   * Updated approximately once per second
   */
  getCurrentFPS(): number;

  /**
   * Get number of registered callbacks
   * Useful for debugging and leak detection
   */
  getCallbackCount(): number;

  /**
   * Check if scheduler is actively running
   */
  isActive(): boolean;
}

/**
 * Enhanced scheduler interface with pause/resume for background tab handling
 * These methods will be added to VisualUpdateScheduler as part of FR-011
 */
export interface IVisualUpdateSchedulerEnhanced extends IVisualUpdateScheduler {
  /**
   * Pause animation loop (background tab)
   * Stops requestAnimationFrame, callbacks not fired
   */
  pause(): void;

  /**
   * Resume animation loop (foreground tab)
   * Restarts requestAnimationFrame
   */
  resume(): void;

  /**
   * Check if scheduler is paused
   */
  isPaused(): boolean;
}

/**
 * Component interface requirements for scheduler integration
 * Components migrating to scheduler should follow this pattern
 */
export interface IScheduledComponent {
  /**
   * Subscription handle (stored to unsubscribe on destroy)
   * Should be set in constructor, cleared in destroy
   */
  subscription: SubscriptionHandle | null;

  /**
   * Cleanup method that unsubscribes from scheduler
   * MUST call this.subscription?.unsubscribe()
   *
   * @example
   * destroy(): void {
   *   if (this.subscription) {
   *     this.subscription.unsubscribe();
   *     this.subscription = null;
   *   }
   * }
   */
  destroy(): void;
}

/**
 * Throttling configuration for components
 * Components may implement different target frame rates
 */
export interface ThrottleConfig {
  /** Target frames per second (e.g., 30 for displays, 60 for main canvas) */
  targetFPS: number;

  /** Frame interval in milliseconds (calculated as 1000 / targetFPS) */
  frameInterval: number;

  /** Timestamp of last render (for throttling calculation) */
  lastRenderTime: number;
}

/**
 * Error context provided when callback throws
 * Used for structured error logging (FR-012)
 */
export interface CallbackErrorContext {
  /** Unique subscription ID */
  subscriptionId: number;

  /** Component identifier (if provided) */
  componentId?: string;

  /** Error thrown by callback */
  error: Error;

  /** Timestamp when error occurred */
  timestamp: number;

  /** Frame number when error occurred */
  frameNumber: number;
}

/**
 * Performance metrics tracked by scheduler
 * Useful for validating success criteria
 */
export interface SchedulerMetrics {
  /** Current frames per second */
  currentFPS: number;

  /** Number of active subscriptions */
  activeCallbacks: number;

  /** Total frames rendered since start */
  totalFrames: number;

  /** Total errors caught */
  totalErrors: number;

  /** Is scheduler paused (background tab)? */
  isPaused: boolean;

  /** Is scheduler iterating callbacks? */
  isIterating: boolean;
}
