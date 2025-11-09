/**
 * VisualUpdateScheduler - Frame-based animation scheduler
 * Manages requestAnimationFrame loop for visual updates
 * Provides FPS monitoring and frame callbacks
 */

import { IVisualUpdateScheduler, SubscriptionHandle } from './types';

type FrameCallback = (deltaMs: number) => void;

/**
 * Subscription metadata including callback and optional component ID for error tracking
 */
interface SubscriptionMetadata {
  callback: FrameCallback;
  componentId?: string;
}

export class VisualUpdateScheduler implements IVisualUpdateScheduler {
  private interpolationEnabled: boolean = true;
  private callbacks: Map<number, SubscriptionMetadata> = new Map();
  private pendingRemovals: Set<number> = new Set();
  private nextCallbackId: number = 0;
  private isRunning: boolean = false;
  private isPausedState: boolean = false;
  private isIterating: boolean = false;
  private animationFrameId: number | null = null;

  // Performance tracking
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateInterval: number = 1000; // Update FPS every 1 second
  private lastFpsUpdateTime: number = 0;
  private currentFPS: number = 0;
  private frameTimes: number[] = []; // Rolling window for FPS calculation

  /**
   * Initialize the scheduler
   */
  initialize(_targetFPS: number = 60, interpolationEnabled: boolean = true): void {
    this.interpolationEnabled = interpolationEnabled;

    // FR-011: Setup Page Visibility API for background tab pause/resume
    this.setupVisibilityHandling();

    console.log(
      `✓ VisualUpdateScheduler initialized (target: ${_targetFPS} FPS, interpolation: ${interpolationEnabled})`
    );
  }

  /**
   * Subscribe to frame updates
   * @param callback - Function to call each frame with delta time
   * @param componentId - Optional component identifier for error logging (FR-012)
   * @returns Unsubscribe handle
   */
  onFrame(callback: FrameCallback, componentId?: string): SubscriptionHandle {
    const id = this.nextCallbackId++;

    // FR-012: Store metadata with componentId for error tracking
    this.callbacks.set(id, { callback, componentId });

    const displayId = componentId || `callback-${id}`;
    console.log(`✓ Frame callback registered [${displayId}]`);

    // FR-013: Return unsubscribe function with deferred removal support
    return {
      unsubscribe: () => {
        if (this.isIterating) {
          // Defer removal until after current frame completes
          this.pendingRemovals.add(id);
        } else {
          this.callbacks.delete(id);
        }
        console.log(`✓ Frame callback unregistered [${displayId}]`);
      },
    };
  }

  /**
   * Start the animation loop
   */
  start(): void {
    if (this.isRunning) {
      console.warn('VisualUpdateScheduler already running');
      return;
    }

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.lastFpsUpdateTime = this.lastFrameTime;
    this.frameCount = 0;
    this.frameTimes = [];

    // Start the animation loop
    this.scheduleNextFrame();

    console.log('✓ VisualUpdateScheduler started');
  }

  /**
   * Stop the animation loop
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Cancel pending animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    console.log('✓ VisualUpdateScheduler stopped');
  }

  /**
   * Get current FPS
   */
  getCurrentFPS(): number {
    return this.currentFPS;
  }

  /**
   * Schedule the next frame
   */
  private scheduleNextFrame(): void {
    if (!this.isRunning) {
      return;
    }

    this.animationFrameId = requestAnimationFrame((timestamp) => {
      this.onAnimationFrame(timestamp);
    });
  }

  /**
   * Handle animation frame
   */
  private onAnimationFrame(timestamp: number): void {
    // Calculate delta time
    const deltaMs = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Update FPS tracking
    this.updateFPS(timestamp, deltaMs);

    // FR-013: Set iteration flag for deferred removal pattern
    this.isIterating = true;

    // FR-012: Call all registered callbacks with error isolation
    this.callbacks.forEach(({ callback, componentId }, id) => {
      // FR-013: Skip callbacks that are pending removal
      if (this.pendingRemovals.has(id)) {
        return;
      }

      try {
        callback(deltaMs);
      } catch (error) {
        // FR-012: Enhanced error logging with component identification
        const identifier = componentId || `callback-${id}`;
        console.error(`Error in frame callback [${identifier}]:`, error);
      }
    });

    // FR-013: Clear iteration flag and process pending removals
    this.isIterating = false;

    // FR-013: Remove callbacks that unsubscribed during iteration
    this.pendingRemovals.forEach((id) => this.callbacks.delete(id));
    this.pendingRemovals.clear();

    // Schedule next frame
    this.scheduleNextFrame();
  }

  /**
   * Update FPS calculation
   */
  private updateFPS(timestamp: number, deltaMs: number): void {
    this.frameCount++;

    // Add frame time to rolling window (keep last 60 frames)
    this.frameTimes.push(deltaMs);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    // Update FPS every second
    if (timestamp - this.lastFpsUpdateTime >= this.fpsUpdateInterval) {
      // Calculate average FPS from rolling window
      const avgFrameTime =
        this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
      this.currentFPS = avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0;

      this.lastFpsUpdateTime = timestamp;
    }
  }

  /**
   * Get the number of registered callbacks
   */
  getCallbackCount(): number {
    return this.callbacks.size;
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get interpolation enabled state
   */
  isInterpolationEnabled(): boolean {
    return this.interpolationEnabled;
  }

  /**
   * Set interpolation enabled state
   */
  setInterpolationEnabled(enabled: boolean): void {
    this.interpolationEnabled = enabled;
    console.log(`✓ Interpolation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * FR-011: Setup Page Visibility API to pause/resume on tab visibility
   */
  private setupVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  /**
   * FR-011: Pause the animation loop (background tab)
   */
  private pause(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.isPausedState = true;
      console.log('⏸️  VisualUpdateScheduler paused (tab backgrounded)');
    }
  }

  /**
   * FR-011: Resume the animation loop (foreground tab)
   */
  private resume(): void {
    if (this.isRunning && this.isPausedState && this.animationFrameId === null) {
      this.isPausedState = false;
      this.lastFrameTime = performance.now();
      this.scheduleNextFrame();
      console.log('▶️  VisualUpdateScheduler resumed (tab foregrounded)');
    }
  }

  /**
   * Check if scheduler is paused (background tab)
   */
  isPaused(): boolean {
    return this.isPausedState;
  }
}
