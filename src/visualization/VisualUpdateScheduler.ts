/**
 * VisualUpdateScheduler - Frame-based animation scheduler
 * Manages requestAnimationFrame loop for visual updates
 * Provides FPS monitoring and frame callbacks
 */

import { IVisualUpdateScheduler, SubscriptionHandle } from './types';

type FrameCallback = (deltaMs: number) => void;

export class VisualUpdateScheduler implements IVisualUpdateScheduler {
  private interpolationEnabled: boolean = true;
  private callbacks: Map<number, FrameCallback> = new Map();
  private nextCallbackId: number = 0;
  private isRunning: boolean = false;
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
    console.log(
      `✓ VisualUpdateScheduler initialized (target: ${_targetFPS} FPS, interpolation: ${interpolationEnabled})`
    );
  }

  /**
   * Subscribe to frame updates
   * @returns Unsubscribe function
   */
  onFrame(callback: FrameCallback): SubscriptionHandle {
    const id = this.nextCallbackId++;
    this.callbacks.set(id, callback);

    console.log(`✓ Frame callback registered (id: ${id})`);

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.callbacks.delete(id);
        console.log(`✓ Frame callback unregistered (id: ${id})`);
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

    // Call all registered callbacks
    this.callbacks.forEach((callback) => {
      try {
        callback(deltaMs);
      } catch (error) {
        console.error('Error in frame callback:', error);
      }
    });

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
}
