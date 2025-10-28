/**
 * PatchStorage - Manages patch persistence using localStorage
 */

import { PatchData } from '../core/types';
import { PatchSerializer } from './PatchSerializer';

/**
 * Storage key prefix for patches
 */
const STORAGE_PREFIX = 'modular-synth-patch:';
const PATCH_LIST_KEY = 'modular-synth:patch-list';
const STORAGE_QUOTA_WARNING = 0.9; // Warn at 90% quota usage

/**
 * Patch metadata for listing
 */
export interface PatchMetadata {
  name: string;
  created: string;
  modified: string;
  componentCount: number;
  connectionCount: number;
  size: number; // Size in bytes
}

/**
 * Storage result
 */
export interface StorageResult {
  success: boolean;
  error?: string;
  quotaWarning?: boolean;
}

/**
 * Manages patch storage using browser localStorage
 */
export class PatchStorage {
  /**
   * Save a patch to localStorage
   */
  static save(patch: PatchData): StorageResult {
    try {
      // Update modified timestamp
      const updatedPatch = PatchSerializer.updatePatchTimestamp(patch);

      // Serialize to JSON
      const jsonString = PatchSerializer.toJSON(updatedPatch);

      // Check storage quota before saving
      const quotaCheck = this.checkStorageQuota(jsonString.length);
      if (!quotaCheck.hasSpace) {
        return {
          success: false,
          error: `Storage quota exceeded. Need ${jsonString.length} bytes, but only ${quotaCheck.available} bytes available.`,
        };
      }

      // Save patch data
      const storageKey = this.getPatchKey(patch.name);
      localStorage.setItem(storageKey, jsonString);

      // Update patch list
      this.updatePatchList(patch.name);

      console.log(`💾 Patch "${patch.name}" saved successfully`);

      return {
        success: true,
        quotaWarning: quotaCheck.warningLevel,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return {
          success: false,
          error: 'Storage quota exceeded. Please delete some patches to free up space.',
        };
      }
      return {
        success: false,
        error: `Failed to save patch: ${error}`,
      };
    }
  }

  /**
   * Load a patch from localStorage
   */
  static load(patchName: string): { success: boolean; patch?: PatchData; error?: string } {
    try {
      const storageKey = this.getPatchKey(patchName);
      const jsonString = localStorage.getItem(storageKey);

      if (!jsonString) {
        return {
          success: false,
          error: `Patch "${patchName}" not found`,
        };
      }

      // Deserialize from JSON
      const patch = PatchSerializer.fromJSON(jsonString);

      console.log(`📂 Patch "${patchName}" loaded successfully`);

      return {
        success: true,
        patch,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load patch: ${error}`,
      };
    }
  }

  /**
   * Delete a patch from localStorage
   */
  static delete(patchName: string): StorageResult {
    try {
      const storageKey = this.getPatchKey(patchName);

      // Check if patch exists
      if (!localStorage.getItem(storageKey)) {
        return {
          success: false,
          error: `Patch "${patchName}" not found`,
        };
      }

      // Delete patch data
      localStorage.removeItem(storageKey);

      // Remove from patch list
      this.removePatchFromList(patchName);

      console.log(`🗑️ Patch "${patchName}" deleted successfully`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete patch: ${error}`,
      };
    }
  }

  /**
   * List all saved patches
   */
  static list(): PatchMetadata[] {
    try {
      const patchNames = this.getPatchList();
      const patches: PatchMetadata[] = [];

      for (const name of patchNames) {
        const storageKey = this.getPatchKey(name);
        const jsonString = localStorage.getItem(storageKey);

        if (jsonString) {
          try {
            const patch = PatchSerializer.fromJSON(jsonString);
            patches.push({
              name: patch.name,
              created: patch.created,
              modified: patch.modified,
              componentCount: patch.components.length,
              connectionCount: patch.connections.length,
              size: jsonString.length,
            });
          } catch (error) {
            console.warn(`Failed to parse patch "${name}":`, error);
          }
        }
      }

      // Sort by modified date (newest first)
      patches.sort(
        (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
      );

      return patches;
    } catch (error) {
      console.error('Failed to list patches:', error);
      return [];
    }
  }

  /**
   * Check if a patch exists
   */
  static exists(patchName: string): boolean {
    const storageKey = this.getPatchKey(patchName);
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * Get storage usage statistics
   */
  static getStorageStats(): {
    used: number;
    available: number;
    total: number;
    percentage: number;
    patchCount: number;
  } {
    let used = 0;

    // Calculate total storage used by patches
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }
    }

    // Estimate total localStorage quota (typically 5-10MB, we assume 5MB)
    const total = 5 * 1024 * 1024; // 5MB in bytes
    const available = total - used;
    const percentage = (used / total) * 100;

    return {
      used,
      available,
      total,
      percentage,
      patchCount: this.getPatchList().length,
    };
  }

  /**
   * Clear all patches (with confirmation requirement)
   */
  static clearAll(): StorageResult {
    try {
      const patchNames = this.getPatchList();

      // Delete all patches
      for (const name of patchNames) {
        const storageKey = this.getPatchKey(name);
        localStorage.removeItem(storageKey);
      }

      // Clear patch list
      localStorage.removeItem(PATCH_LIST_KEY);

      console.log(`🗑️ All patches cleared (${patchNames.length} patches deleted)`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to clear patches: ${error}`,
      };
    }
  }

  /**
   * Export patch to downloadable JSON file
   */
  static exportToFile(patch: PatchData): void {
    const jsonString = PatchSerializer.toJSON(patch);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create temporary download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `${patch.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);

    console.log(`📥 Patch "${patch.name}" exported to file`);
  }

  /**
   * Import patch from JSON file
   */
  static async importFromFile(file: File): Promise<{
    success: boolean;
    patch?: PatchData;
    error?: string;
  }> {
    try {
      const text = await file.text();
      const patch = PatchSerializer.fromJSON(text);

      // Check if patch with same name already exists
      if (this.exists(patch.name)) {
        // Add timestamp to make it unique
        const timestamp = new Date().getTime();
        patch.name = `${patch.name} (imported ${timestamp})`;
      }

      // Save imported patch
      const saveResult = this.save(patch);

      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error,
        };
      }

      console.log(`📤 Patch imported from file: "${patch.name}"`);

      return {
        success: true,
        patch,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to import patch: ${error}`,
      };
    }
  }

  /**
   * Private: Get storage key for a patch
   */
  private static getPatchKey(patchName: string): string {
    return `${STORAGE_PREFIX}${patchName}`;
  }

  /**
   * Private: Get list of all patch names
   */
  private static getPatchList(): string[] {
    const listJson = localStorage.getItem(PATCH_LIST_KEY);
    if (!listJson) {
      return [];
    }

    try {
      const list = JSON.parse(listJson);
      return Array.isArray(list) ? list : [];
    } catch (error) {
      console.error('Failed to parse patch list:', error);
      return [];
    }
  }

  /**
   * Private: Update patch list with a new patch name
   */
  private static updatePatchList(patchName: string): void {
    const list = this.getPatchList();

    // Add patch name if not already in list
    if (!list.includes(patchName)) {
      list.push(patchName);
      localStorage.setItem(PATCH_LIST_KEY, JSON.stringify(list));
    }
  }

  /**
   * Private: Remove patch name from list
   */
  private static removePatchFromList(patchName: string): void {
    const list = this.getPatchList();
    const filtered = list.filter((name) => name !== patchName);
    localStorage.setItem(PATCH_LIST_KEY, JSON.stringify(filtered));
  }

  /**
   * Private: Check storage quota
   */
  private static checkStorageQuota(requiredBytes: number): {
    hasSpace: boolean;
    available: number;
    warningLevel: boolean;
  } {
    const stats = this.getStorageStats();
    const hasSpace = stats.available >= requiredBytes;
    const warningLevel = stats.percentage >= STORAGE_QUOTA_WARNING * 100;

    return {
      hasSpace,
      available: stats.available,
      warningLevel,
    };
  }
}
