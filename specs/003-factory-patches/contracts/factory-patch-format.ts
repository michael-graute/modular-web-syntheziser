/**
 * Factory Patch Format Contract
 *
 * This file documents the TypeScript interfaces for factory patches.
 * These are reference types for implementation guidance.
 */

/**
 * Extended PatchData interface with optional description field
 */
export interface PatchData {
  /** Display name of the patch */
  name: string;

  /** Patch format version (semver: x.y.z) */
  version: string;

  /** ISO timestamp of creation */
  created: string;

  /** ISO timestamp of last modification */
  modified: string;

  /** Optional 1-2 sentence description of the sound (factory patches only) */
  description?: string;

  /** Array of synthesizer components */
  components: ComponentData[];

  /** Array of signal connections between components */
  connections: Connection[];
}

/**
 * Metadata wrapper for factory patches
 */
export interface FactoryPatchMetadata {
  /** Filename of the JSON file (e.g., "bass-synth.json") */
  filename: string;

  /** Source discriminator */
  source: 'factory';

  /** The patch data */
  patch: PatchData;

  /** Timestamp when patch was loaded (for cache management) */
  loadedAt: Date;
}

/**
 * Patch category discriminator
 */
export type PatchCategory = 'user' | 'factory';

/**
 * Validation result for factory patch loading
 */
export interface ValidationResult {
  /** Whether the patch is valid */
  valid: boolean;

  /** Array of validation error messages */
  errors: string[];

  /** The validated patch data (if valid) */
  patch?: PatchData;
}

/**
 * Factory patch loader configuration
 */
export interface FactoryPatchLoaderConfig {
  /** Base path to factory patches folder (default: '/patches/factory') */
  basePath?: string;

  /** List of patch filenames to load (if not using manifest) */
  patchFiles?: string[];

  /** Whether to use manifest.json for discovery (default: false) */
  useManifest?: boolean;

  /** Timeout for fetch requests in ms (default: 5000) */
  timeout?: number;
}

/**
 * Factory patch loader state
 */
export type LoaderState = 'NOT_LOADED' | 'LOADING' | 'READY' | 'ERROR';

/**
 * Example factory patch JSON structure
 *
 * @example
 * {
 *   "name": "Bass Synth",
 *   "version": "1.0.0",
 *   "description": "A warm bass sound using a sawtooth oscillator and lowpass filter.",
 *   "created": "2025-10-31T00:00:00Z",
 *   "modified": "2025-10-31T00:00:00Z",
 *   "components": [
 *     {
 *       "id": "osc-1",
 *       "type": "OSCILLATOR",
 *       "position": { "x": 100, "y": 100 },
 *       "parameters": {
 *         "waveform": 2,
 *         "frequency": 55,
 *         "detune": 0
 *       }
 *     },
 *     {
 *       "id": "filter-1",
 *       "type": "FILTER",
 *       "position": { "x": 300, "y": 100 },
 *       "parameters": {
 *         "type": 0,
 *         "cutoff": 800,
 *         "resonance": 0.7
 *       }
 *     },
 *     {
 *       "id": "master-1",
 *       "type": "MASTER_OUTPUT",
 *       "position": { "x": 500, "y": 100 },
 *       "parameters": {
 *         "volume": 0.8
 *       }
 *     }
 *   ],
 *   "connections": [
 *     {
 *       "id": "conn-1",
 *       "sourceId": "osc-1",
 *       "sourcePort": "audio-out",
 *       "targetId": "filter-1",
 *       "targetPort": "audio-in"
 *     },
 *     {
 *       "id": "conn-2",
 *       "sourceId": "filter-1",
 *       "sourcePort": "audio-out",
 *       "targetId": "master-1",
 *       "targetPort": "audio-in"
 *     }
 *   ]
 * }
 */

/**
 * Component data structure (existing - for reference)
 */
export interface ComponentData {
  id: string;
  type: string;
  position: { x: number; y: number };
  parameters: Record<string, any>;
}

/**
 * Connection data structure (existing - for reference)
 */
export interface Connection {
  id: string;
  sourceId: string;
  sourcePort: string;
  targetId: string;
  targetPort: string;
}
