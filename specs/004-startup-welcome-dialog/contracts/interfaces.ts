/**
 * TypeScript Interface Contracts for Startup Welcome Dialog Feature
 *
 * This file defines the public interfaces and types for the welcome dialog system.
 * These contracts serve as the API boundary between components.
 *
 * Feature: 004-startup-welcome-dialog
 * Date: 2025-11-06
 */

import { ModalOptions } from '../../../src/ui/Modal';

// ============================================================================
// Data Structures
// ============================================================================

/**
 * Record of user's terms and conditions acceptance
 *
 * Stored in localStorage under key: 'modular-synth:terms-acceptance'
 */
export interface AcceptanceRecord {
  /**
   * Whether the user accepted the terms
   */
  accepted: boolean;

  /**
   * Version of terms that were accepted
   *
   * Format: Semantic version string (e.g., "1.0", "1.1")
   * Used to re-prompt users when terms are updated
   *
   * @example "1.0"
   */
  version: string;

  /**
   * Timestamp when acceptance was recorded
   *
   * Format: ISO 8601 date string
   *
   * @example "2025-11-06T14:30:00.000Z"
   */
  timestamp: string;
}

/**
 * Options for configuring the WelcomeDialog
 *
 * Extends base ModalOptions from Modal class
 */
export interface WelcomeDialogOptions extends ModalOptions {
  /**
   * Whether dialog is in review mode (non-blocking)
   *
   * When true:
   * - No acceptance is recorded
   * - Only "Close" button is shown (no Accept/Decline)
   * - User can close with Escape key or overlay click
   *
   * When false (default):
   * - First-time acceptance mode (blocking)
   * - Accept and Decline buttons shown
   * - Cannot close without making a choice
   *
   * @default false
   */
  reviewMode?: boolean;
}

// ============================================================================
// Storage API
// ============================================================================

/**
 * Public API for AcceptanceStorage
 *
 * Manages persistence of terms acceptance records
 */
export interface IAcceptanceStorage {
  /**
   * Retrieve the current acceptance record
   *
   * Returns null if:
   * - No record exists (first launch)
   * - Record is corrupted/invalid
   * - localStorage is unavailable and session memory is empty
   *
   * @returns AcceptanceRecord if found and valid, null otherwise
   */
  getAcceptance(): AcceptanceRecord | null;

  /**
   * Save acceptance record to storage
   *
   * Attempts to save to localStorage first.
   * Falls back to session memory if localStorage fails.
   *
   * @param accepted - Whether user accepted terms
   * @returns true if saved to localStorage, false if fallback to session memory
   */
  saveAcceptance(accepted: boolean): boolean;

  /**
   * Clear acceptance record from storage
   *
   * Removes from both localStorage and session memory.
   * Used for testing or reset scenarios.
   */
  clearAcceptance(): void;

  /**
   * Check if acceptance record exists and is valid for current version
   *
   * @returns true if user has accepted current version of terms
   */
  hasValidAcceptance(): boolean;
}

// ============================================================================
// Dialog Component API
// ============================================================================

/**
 * Callback type for acceptance actions
 */
export type AcceptanceCallback = () => void;

/**
 * Public API for WelcomeDialog component
 *
 * Extends base Modal functionality
 */
export interface IWelcomeDialog {
  /**
   * Open the welcome dialog
   *
   * In first-time mode: Shows blocking modal with Accept/Decline
   * In review mode: Shows non-blocking modal with Close button
   */
  open(): void;

  /**
   * Close the welcome dialog
   *
   * In first-time mode: Can only be called via Accept/Decline
   * In review mode: Can be called by user or programmatically
   */
  close(): void;

  /**
   * Register callback for Accept button click
   *
   * @param callback - Function to call when user accepts terms
   */
  onAccept(callback: AcceptanceCallback): void;

  /**
   * Register callback for Decline button click
   *
   * @param callback - Function to call when user declines terms
   */
  onDecline(callback: AcceptanceCallback): void;

  /**
   * Destroy the dialog and clean up resources
   *
   * Removes from DOM, releases event listeners, restores focus
   */
  destroy(): void;

  /**
   * Check if dialog is currently open
   *
   * @returns true if dialog is visible
   */
  isOpen(): boolean;
}

// ============================================================================
// Initialization API
// ============================================================================

/**
 * Result of welcome dialog check
 */
export interface WelcomeDialogResult {
  /**
   * Whether user accepted the terms
   */
  accepted: boolean;

  /**
   * Whether dialog was shown
   * (false if already accepted in previous session)
   */
  dialogShown: boolean;

  /**
   * Whether acceptance was stored persistently
   * (false if using session memory fallback)
   */
  persistent: boolean;
}

/**
 * Public API for initialization helper
 *
 * Used by main.ts during app startup
 */
export interface IWelcomeInitializer {
  /**
   * Check acceptance and show dialog if needed
   *
   * Async function that:
   * 1. Checks if user has accepted current version
   * 2. Shows dialog if needed
   * 3. Waits for user decision
   * 4. Saves acceptance record
   * 5. Returns result
   *
   * @returns Promise resolving to result of dialog interaction
   */
  checkAndShowWelcomeDialog(): Promise<WelcomeDialogResult>;

  /**
   * Force show welcome dialog in review mode
   *
   * Used for "View Terms" menu option (P2 requirement)
   */
  showReviewDialog(): void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Storage key for acceptance record
 */
export const ACCEPTANCE_STORAGE_KEY = 'modular-synth:terms-acceptance';

/**
 * Current version of terms and conditions
 *
 * Increment this when terms are updated to re-prompt users
 */
export const TERMS_VERSION = '1.0';

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Type guard for AcceptanceRecord
 *
 * @param value - Value to check
 * @returns true if value is a valid AcceptanceRecord
 */
export function isValidAcceptanceRecord(value: unknown): value is AcceptanceRecord {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<AcceptanceRecord>;

  return (
    typeof record.accepted === 'boolean' &&
    typeof record.version === 'string' &&
    record.version.length > 0 &&
    typeof record.timestamp === 'string' &&
    !isNaN(Date.parse(record.timestamp))
  );
}

/**
 * Check if acceptance record is for current version
 *
 * @param record - Acceptance record to check
 * @returns true if record is for current terms version
 */
export function isCurrentVersion(record: AcceptanceRecord): boolean {
  return record.version === TERMS_VERSION;
}

// ============================================================================
// Content Types
// ============================================================================

/**
 * Terms and conditions content structure
 *
 * Allows for structured content management
 */
export interface TermsContent {
  /**
   * Welcome message section
   */
  welcome: {
    title: string;
    paragraphs: string[];
  };

  /**
   * Terms sections
   */
  terms: {
    title: string;
    sections: Array<{
      heading: string;
      paragraphs: string[];
    }>;
  };
}

/**
 * Default terms content
 *
 * Can be overridden or loaded from external source
 */
export const DEFAULT_TERMS_CONTENT: TermsContent = {
  welcome: {
    title: 'Welcome to Modular Synth',
    paragraphs: [
      'Modular Synth is a browser-based modular synthesizer that brings the power of analog synthesis to your web browser.',
      'Create complex sounds by connecting virtual modules, just like a hardware modular synthesizer. Experiment with oscillators, filters, envelopes, effects, and more.',
      'Before you begin, please review and accept our terms and conditions.',
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    sections: [
      {
        heading: '1. No Warranty',
        paragraphs: [
          'This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement.',
        ],
      },
      {
        heading: '2. Limitation of Liability',
        paragraphs: [
          'In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.',
        ],
      },
      {
        heading: '3. Open Source License',
        paragraphs: [
          'This software is open source and distributed under the MIT License. You are free to use, modify, and distribute this software in accordance with the terms of the license.',
          'The full license text is available in the project repository.',
        ],
      },
      {
        heading: '4. User Responsibility',
        paragraphs: [
          'You are responsible for your use of this software. Please be mindful of audio levels to protect your hearing and equipment.',
          'Audio synthesis can produce loud or unexpected sounds. Start with low volume levels and adjust carefully.',
        ],
      },
    ],
  },
};

// ============================================================================
// Events
// ============================================================================

/**
 * Event types emitted by welcome dialog
 *
 * Can be used for analytics or logging
 */
export enum WelcomeDialogEvent {
  /**
   * Dialog was opened
   */
  OPENED = 'welcome:opened',

  /**
   * User accepted terms
   */
  ACCEPTED = 'welcome:accepted',

  /**
   * User declined terms
   */
  DECLINED = 'welcome:declined',

  /**
   * Dialog was closed (review mode)
   */
  CLOSED = 'welcome:closed',

  /**
   * Storage failed, using session memory
   */
  STORAGE_FALLBACK = 'welcome:storage-fallback',
}
