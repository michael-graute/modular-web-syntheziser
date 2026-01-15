/**
 * Assertion Helper Contracts
 *
 * TypeScript interfaces for reusable test assertions.
 * Based on data-model.md assertion helper schemas.
 *
 * Feature: 008-test-coverage
 * Date: 2026-01-12
 */

import type { SynthComponent, Patch, Connection } from '../../../src/types';
import type { MockAudioNode, MockAudioContext } from './mock-contracts';

/**
 * Component assertion helpers
 */
export interface ComponentAssertions {
  /**
   * Assert two components are deeply equal
   */
  expectComponentsEqual(actual: SynthComponent, expected: SynthComponent): void;

  /**
   * Assert component has valid structure (required fields, valid types)
   */
  expectValidComponent(component: SynthComponent): void;

  /**
   * Assert component has specific parameter value
   */
  expectParameter(component: SynthComponent, paramName: string, expectedValue: any): void;

  /**
   * Assert component position matches expected coordinates
   */
  expectPosition(component: SynthComponent, x: number, y: number): void;

  /**
   * Assert component has expected number of inputs/outputs
   */
  expectPorts(component: SynthComponent, inputs: number, outputs: number): void;
}

/**
 * Connection assertion helpers
 */
export interface ConnectionAssertions {
  /**
   * Assert connection exists between two components
   */
  expectConnection(connections: Connection[], fromId: string, toId: string): void;

  /**
   * Assert connection count matches expected
   */
  expectConnectionCount(connections: Connection[], expected: number): void;

  /**
   * Assert connection has valid structure (non-null IDs, valid port indices)
   */
  expectValidConnection(connection: Connection): void;

  /**
   * Assert no duplicate connections exist
   */
  expectNoDuplicateConnections(connections: Connection[]): void;
}

/**
 * Patch assertion helpers
 */
export interface PatchAssertions {
  /**
   * Assert patch serialization preserves all data
   */
  expectPatchIntegrity(original: Patch, restored: Patch): void;

  /**
   * Assert patch JSON is valid (can be parsed, has required fields)
   */
  expectValidPatchJSON(json: string): void;

  /**
   * Assert patch has expected number of components
   */
  expectComponentCount(patch: Patch, expected: number): void;

  /**
   * Assert all connections in patch reference existing components
   */
  expectValidConnectionReferences(patch: Patch): void;

  /**
   * Assert patch name is non-empty string
   */
  expectValidPatchName(patch: Patch): void;
}

/**
 * Audio assertion helpers
 */
export interface AudioAssertions {
  /**
   * Assert audio node is connected to another node
   */
  expectAudioConnection(from: MockAudioNode, to: MockAudioNode): void;

  /**
   * Assert AudioContext state matches expected
   */
  expectContextState(context: MockAudioContext, state: AudioContextState): void;

  /**
   * Assert audio node has expected number of connections
   */
  expectConnectionCount(node: MockAudioNode, expected: number): void;

  /**
   * Assert audio parameter has expected value
   */
  expectParamValue(param: AudioParam, expectedValue: number, tolerance?: number): void;
}

/**
 * Serialization assertion helpers
 */
export interface SerializationAssertions {
  /**
   * Assert JSON string is valid and parseable
   */
  expectValidJSON(json: string): void;

  /**
   * Assert serialized data contains all required fields
   */
  expectRequiredFields(obj: any, fields: string[]): void;

  /**
   * Assert deserialized object matches original (deep equality)
   */
  expectDeserializationIntegrity<T>(original: T, deserialized: T): void;

  /**
   * Assert serialization handles edge cases (null, undefined, empty arrays)
   */
  expectEdgeCaseHandling(serializer: any, data: any): void;
}

/**
 * Canvas interaction assertion helpers
 */
export interface CanvasAssertions {
  /**
   * Assert component was moved to expected position
   */
  expectComponentMoved(component: SynthComponent, expectedX: number, expectedY: number): void;

  /**
   * Assert viewport transform matches expected values
   */
  expectViewportTransform(
    viewport: any,
    expectedZoom: number,
    expectedPanX: number,
    expectedPanY: number
  ): void;

  /**
   * Assert component snaps to grid correctly
   */
  expectGridSnap(position: { x: number; y: number }, gridSize: number): void;

  /**
   * Assert drag operation was successful
   */
  expectDragSuccess(startPos: { x: number; y: number }, endPos: { x: number; y: number }): void;
}

/**
 * Complete assertion helper registry
 */
export interface AssertionHelpers
  extends ComponentAssertions,
    ConnectionAssertions,
    PatchAssertions,
    AudioAssertions,
    SerializationAssertions,
    CanvasAssertions {}

/**
 * Configuration for custom assertion behavior
 */
export interface AssertionConfig {
  /**
   * Tolerance for floating-point comparisons
   */
  floatTolerance: number;

  /**
   * Whether to show diffs in assertion failures
   */
  showDiffs: boolean;

  /**
   * Custom error message prefix
   */
  errorPrefix?: string;
}

/**
 * Factory for creating assertion helpers with custom config
 */
export type AssertionHelperFactory = (config?: Partial<AssertionConfig>) => AssertionHelpers;
