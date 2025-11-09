/**
 * Singleton instance of VisualUpdateScheduler
 * Centralized animation frame scheduler for all visual components
 *
 * Initialized at application startup in main.ts
 * Components subscribe to frame updates via visualUpdateScheduler.onFrame()
 */

import { VisualUpdateScheduler } from './VisualUpdateScheduler';

/**
 * Global scheduler singleton
 * Manages all requestAnimationFrame callbacks for visual components
 */
export const visualUpdateScheduler = new VisualUpdateScheduler();
