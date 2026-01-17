/**
 * Assertion Helper Functions
 *
 * Reusable assertion functions for common test scenarios.
 * Based on data-model.md assertion helper schemas
 */

import { expect } from 'vitest';
import { ComponentData, Connection, PatchData } from '../../src/core/types';
import type { MockAudioNode, MockAudioContext } from '../mocks/WebAudioAPI.mock';

/**
 * Component Assertions
 */

export function expectComponentsEqual(actual: ComponentData, expected: ComponentData): void {
  expect(actual.id).toBe(expected.id);
  expect(actual.type).toBe(expected.type);
  expect(actual.position).toEqual(expected.position);
  expect(actual.parameters).toEqual(expected.parameters);
  expect(actual.isBypassed).toBe(expected.isBypassed);
}

export function expectValidComponent(component: ComponentData): void {
  expect(component.id).toBeTruthy();
  expect(component.type).toBeTruthy();
  expect(component.position).toBeDefined();
  expect(component.position.x).toBeTypeOf('number');
  expect(component.position.y).toBeTypeOf('number');
  expect(component.parameters).toBeTypeOf('object');
}

export function expectParameter(component: ComponentData, paramName: string, expectedValue: number): void {
  expect(component.parameters).toHaveProperty(paramName);
  expect(component.parameters[paramName]).toBe(expectedValue);
}

export function expectPosition(component: ComponentData, x: number, y: number): void {
  expect(component.position.x).toBe(x);
  expect(component.position.y).toBe(y);
}

/**
 * Connection Assertions
 */

export function expectConnection(
  connections: Connection[],
  sourceId: string,
  targetId: string
): void {
  const connection = connections.find(
    conn => conn.sourceComponentId === sourceId && conn.targetComponentId === targetId
  );
  expect(connection).toBeDefined();
}

export function expectConnectionCount(connections: Connection[], expected: number): void {
  expect(connections).toHaveLength(expected);
}

export function expectValidConnection(connection: Connection): void {
  expect(connection.id).toBeTruthy();
  expect(connection.sourceComponentId).toBeTruthy();
  expect(connection.targetComponentId).toBeTruthy();
  expect(connection.sourcePortId).toBeTruthy();
  expect(connection.targetPortId).toBeTruthy();
  expect(connection.signalType).toBeTruthy();
}

export function expectNoDuplicateConnections(connections: Connection[]): void {
  const connectionKeys = new Set<string>();

  for (const conn of connections) {
    const key = `${conn.sourceComponentId}:${conn.sourcePortId}->${conn.targetComponentId}:${conn.targetPortId}`;
    expect(connectionKeys.has(key)).toBe(false);
    connectionKeys.add(key);
  }
}

/**
 * Patch Assertions
 */

export function expectPatchIntegrity(original: PatchData, restored: PatchData): void {
  expect(restored.name).toBe(original.name);
  expect(restored.components).toHaveLength(original.components.length);
  expect(restored.connections).toHaveLength(original.connections.length);

  // Verify each component
  for (let i = 0; i < original.components.length; i++) {
    expectComponentsEqual(restored.components[i], original.components[i]);
  }

  // Verify each connection
  for (let i = 0; i < original.connections.length; i++) {
    expect(restored.connections[i]).toEqual(original.connections[i]);
  }
}

export function expectValidPatchJSON(json: string): void {
  expect(() => JSON.parse(json)).not.toThrow();

  const parsed = JSON.parse(json);
  expect(parsed).toHaveProperty('name');
  expect(parsed).toHaveProperty('components');
  expect(parsed).toHaveProperty('connections');
  expect(Array.isArray(parsed.components)).toBe(true);
  expect(Array.isArray(parsed.connections)).toBe(true);
}

export function expectComponentCount(patch: PatchData, expected: number): void {
  expect(patch.components).toHaveLength(expected);
}

export function expectValidConnectionReferences(patch: PatchData): void {
  const componentIds = new Set(patch.components.map(c => c.id));

  for (const conn of patch.connections) {
    expect(componentIds.has(conn.sourceComponentId)).toBe(true);
    expect(componentIds.has(conn.targetComponentId)).toBe(true);
  }
}

export function expectValidPatchName(patch: PatchData): void {
  expect(patch.name).toBeTruthy();
  expect(patch.name.length).toBeGreaterThan(0);
  expect(typeof patch.name).toBe('string');
}

/**
 * Audio Assertions
 */

export function expectAudioConnection(from: MockAudioNode, to: MockAudioNode): void {
  expect(from.isConnectedTo(to as any)).toBe(true);
}

export function expectContextState(context: MockAudioContext, state: AudioContextState): void {
  expect(context.state).toBe(state);
}

export function expectAudioConnectionCount(node: MockAudioNode, expected: number): void {
  expect(node.getConnections()).toHaveLength(expected);
}

export function expectParamValue(param: AudioParam | any, expectedValue: number, tolerance: number = 0.001): void {
  expect(Math.abs(param.value - expectedValue)).toBeLessThan(tolerance);
}

/**
 * Serialization Assertions
 */

export function expectValidJSON(json: string): void {
  expect(() => JSON.parse(json)).not.toThrow();
}

export function expectRequiredFields(obj: any, fields: string[]): void {
  for (const field of fields) {
    expect(obj).toHaveProperty(field);
  }
}

export function expectDeserializationIntegrity<T>(original: T, deserialized: T): void {
  expect(deserialized).toEqual(original);
}

/**
 * Canvas Interaction Assertions
 */

export function expectComponentMoved(component: ComponentData, expectedX: number, expectedY: number): void {
  expect(component.position.x).toBe(expectedX);
  expect(component.position.y).toBe(expectedY);
}

export function expectGridSnap(position: { x: number; y: number }, gridSize: number): void {
  expect(position.x % gridSize).toBe(0);
  expect(position.y % gridSize).toBe(0);
}

export function expectDragSuccess(
  startPos: { x: number; y: number },
  endPos: { x: number; y: number }
): void {
  expect(endPos.x).not.toBe(startPos.x);
  expect(endPos.y).not.toBe(startPos.y);
}
