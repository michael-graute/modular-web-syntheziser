/**
 * AcceptanceStorage - Manages terms acceptance persistence
 */

import { isLocalStorageAvailable } from '../utils/validators';

/**
 * Record of user's terms and conditions acceptance
 */
export interface AcceptanceRecord {
  /**
   * Whether the user accepted the terms
   */
  accepted: boolean;

  /**
   * Version of terms that were accepted
   * Format: semantic version string (e.g., "1.0", "1.1")
   * Used to re-prompt users when terms are updated
   */
  version: string;

  /**
   * Timestamp when acceptance was recorded
   * Format: ISO 8601 date string
   */
  timestamp: string;
}

/**
 * Manages persistence of terms acceptance records
 */
export class AcceptanceStorage {
  private static readonly STORAGE_KEY = 'modular-synth:terms-acceptance';
  private static readonly CURRENT_VERSION = '1.0';
  private static sessionMemory: AcceptanceRecord | null = null;

  /**
   * Get current acceptance record
   * Returns null if no record exists, record is corrupted, or storage unavailable
   */
  static getAcceptance(): AcceptanceRecord | null {
    // Try localStorage first
    if (isLocalStorageAvailable()) {
      try {
        const json = localStorage.getItem(this.STORAGE_KEY);
        if (json) {
          const record = JSON.parse(json);
          if (this.isValid(record)) {
            return record;
          }
        }
      } catch (error) {
        console.warn('Failed to read acceptance record:', error);
      }
    }

    // Fallback to session memory
    return this.sessionMemory;
  }

  /**
   * Save acceptance record
   * Returns true if saved to localStorage, false if fallback to session memory
   */
  static saveAcceptance(accepted: boolean): boolean {
    const record: AcceptanceRecord = {
      accepted,
      version: this.CURRENT_VERSION,
      timestamp: new Date().toISOString(),
    };

    // Try localStorage
    if (isLocalStorageAvailable()) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(record));
        console.log(`✅ Terms acceptance saved: ${accepted}`);
        return true;
      } catch (error) {
        console.warn('Failed to save acceptance record:', error);
      }
    }

    // Fallback to session memory
    this.sessionMemory = record;
    console.warn('⚠️  Terms acceptance saved to session memory only (not persistent)');
    return false;
  }

  /**
   * Check if current version is accepted
   */
  static hasValidAcceptance(): boolean {
    const record = this.getAcceptance();
    return (
      record !== null &&
      record.accepted &&
      record.version === this.CURRENT_VERSION
    );
  }

  /**
   * Clear acceptance (for testing)
   */
  static clearAcceptance(): void {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
    this.sessionMemory = null;
  }

  /**
   * Validate acceptance record structure
   */
  private static isValid(record: any): record is AcceptanceRecord {
    return (
      record !== null &&
      typeof record === 'object' &&
      typeof record.accepted === 'boolean' &&
      typeof record.version === 'string' &&
      record.version.length > 0 &&
      typeof record.timestamp === 'string' &&
      !isNaN(Date.parse(record.timestamp))
    );
  }
}
