/**
 * FactoryPatchLoader - Loads factory patches from static JSON files
 */

import { PatchData } from '../core/types';

/**
 * State of the factory patch loader
 */
type LoaderState = 'NOT_LOADED' | 'LOADING' | 'READY' | 'ERROR';

/**
 * Loads and manages factory patches from static JSON files
 */
export class FactoryPatchLoader {
  private patches: Map<string, PatchData> = new Map();
  private state: LoaderState = 'NOT_LOADED';

  /**
   * Load all factory patches from known filenames
   */
  async loadAll(): Promise<PatchData[]> {
    this.state = 'LOADING';

    // Known factory patch filenames
    const patchFiles = [
      'basic-oscillator.json',
      'two-oscillator-setup.json',
      'pad-sound.json',
    ];

    try {
      // Use Promise.allSettled for resilient loading
      const results = await Promise.allSettled(
        patchFiles.map((filename) => this.loadPatch(filename))
      );

      // Filter out failed promises and collect successful patches
      const loaded = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<PatchData>).value);

      this.state = 'READY';
      return loaded;
    } catch (error) {
      this.state = 'ERROR';
      console.error('Failed to load factory patches:', error);
      return [];
    }
  }

  /**
   * Load a single factory patch from file
   */
  private async loadPatch(filename: string): Promise<PatchData> {
    const response = await fetch(`/patches/factory/${filename}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${filename}`);
    }

    const data = await response.json();

    if (!this.validatePatch(data)) {
      throw new Error(`Invalid patch format: ${filename}`);
    }

    this.patches.set(filename, data);
    return data;
  }

  /**
   * Validate patch data against PatchData schema
   */
  private validatePatch(data: any): data is PatchData {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.name === 'string' &&
      typeof data.version === 'string' &&
      Array.isArray(data.components) &&
      Array.isArray(data.connections) &&
      (data.description === undefined || typeof data.description === 'string')
    );
  }

  /**
   * Get all loaded factory patches
   */
  getAll(): PatchData[] {
    return Array.from(this.patches.values());
  }

  /**
   * Check if loader is ready (patches loaded successfully)
   */
  isReady(): boolean {
    return this.state === 'READY';
  }
}

/**
 * Singleton instance for global access
 */
export const factoryPatchLoader = new FactoryPatchLoader();
