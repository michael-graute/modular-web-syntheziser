/**
 * PatchSerializer Unit Tests
 *
 * Tests for patch serialization, deserialization, and data integrity.
 * Based on spec.md User Story 2: Reliable State Persistence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PatchSerializer } from '../../src/patch/PatchSerializer';
import { PatchData } from '../../src/core/types';
import {
  createEmptyPatch,
  createSimplePatch,
  createComplexPatch,
  createSubtractivePatch,
} from '../fixtures/patches.fixture';
import {
  expectPatchIntegrity,
  expectValidPatchJSON,
  expectComponentCount,
  expectValidConnectionReferences,
  expectValidPatchName,
} from '../fixtures/assertion-helpers';

describe('PatchSerializer', () => {
  describe('Serialization', () => {
    it('should serialize patch with 5 components and 8 connections without data loss', () => {
      const patch = createComplexPatch();

      // Verify original patch structure
      expect(patch.components).toHaveLength(5);
      expect(patch.connections).toHaveLength(8);

      // Serialize to JSON
      const jsonString = PatchSerializer.toJSON(patch);

      // Verify JSON is valid
      expectValidPatchJSON(jsonString);

      // Parse and verify structure
      const parsed = JSON.parse(jsonString);
      expect(parsed.components).toHaveLength(5);
      expect(parsed.connections).toHaveLength(8);
    });

    it('should serialize empty patch correctly', () => {
      const patch = createEmptyPatch({ name: 'Empty Test' });

      const jsonString = PatchSerializer.toJSON(patch);
      expectValidPatchJSON(jsonString);

      const parsed = JSON.parse(jsonString);
      expect(parsed.name).toBe('Empty Test');
      expect(parsed.components).toHaveLength(0);
      expect(parsed.connections).toHaveLength(0);
    });

    it('should serialize complex patch with multiple component types', () => {
      const patch = createSubtractivePatch();

      // Subtractive patch has oscillator, filter, envelope, VCA, output
      expect(patch.components.length).toBeGreaterThan(0);

      const jsonString = PatchSerializer.toJSON(patch);
      expectValidPatchJSON(jsonString);

      const parsed = JSON.parse(jsonString);
      expect(parsed.components.length).toBe(patch.components.length);
      expect(parsed.connections.length).toBe(patch.connections.length);
    });

    it('should preserve connection port indices during serialization', () => {
      const patch = createSimplePatch();

      const jsonString = PatchSerializer.toJSON(patch);
      const parsed = JSON.parse(jsonString);

      // Verify connection details are preserved
      for (let i = 0; i < patch.connections.length; i++) {
        const original = patch.connections[i];
        const serialized = parsed.connections[i];

        expect(serialized.id).toBe(original.id);
        expect(serialized.sourceComponentId).toBe(original.sourceComponentId);
        expect(serialized.targetComponentId).toBe(original.targetComponentId);
        expect(serialized.sourcePortId).toBe(original.sourcePortId);
        expect(serialized.targetPortId).toBe(original.targetPortId);
        expect(serialized.signalType).toBe(original.signalType);
      }
    });
  });

  describe('Deserialization', () => {
    it('should deserialize patch JSON and restore all components exactly', () => {
      const original = createComplexPatch();
      const jsonString = PatchSerializer.toJSON(original);

      const deserialized = PatchSerializer.fromJSON(jsonString);

      expectComponentCount(deserialized, original.components.length);
      expect(deserialized.connections).toHaveLength(original.connections.length);

      // Verify each component is restored
      for (let i = 0; i < original.components.length; i++) {
        expect(deserialized.components[i].id).toBe(original.components[i].id);
        expect(deserialized.components[i].type).toBe(original.components[i].type);
      }
    });

    it('should preserve parameter values during serialize/deserialize cycle', () => {
      const original = createSimplePatch();

      // Serialize and deserialize
      const jsonString = PatchSerializer.toJSON(original);
      const deserialized = PatchSerializer.fromJSON(jsonString);

      // Verify parameters are preserved
      for (let i = 0; i < original.components.length; i++) {
        expect(deserialized.components[i].parameters).toEqual(
          original.components[i].parameters
        );
      }
    });

    it('should handle complex parameter values (negative, zero, maximum)', () => {
      const patch = createSimplePatch();

      // Modify parameters to include edge cases
      patch.components[0].parameters = {
        frequency: -100, // Negative
        detune: 0, // Zero
        waveform: 3, // Maximum for oscillator
      };

      const jsonString = PatchSerializer.toJSON(patch);
      const deserialized = PatchSerializer.fromJSON(jsonString);

      expect(deserialized.components[0].parameters.frequency).toBe(-100);
      expect(deserialized.components[0].parameters.detune).toBe(0);
      expect(deserialized.components[0].parameters.waveform).toBe(3);
    });

    it('should handle floating-point parameter precision accurately', () => {
      const patch = createSimplePatch();

      // Set floating-point parameters
      patch.components[0].parameters = {
        frequency: 440.123456789,
        detune: 0.000001,
        waveform: 0,
      };

      const jsonString = PatchSerializer.toJSON(patch);
      const deserialized = PatchSerializer.fromJSON(jsonString);

      // JSON serialization maintains precision
      expect(deserialized.components[0].parameters.frequency).toBeCloseTo(440.123456789);
      expect(deserialized.components[0].parameters.detune).toBeCloseTo(0.000001);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when deserializing invalid JSON', () => {
      const invalidJSON = '{ invalid json }';

      expect(() => {
        PatchSerializer.fromJSON(invalidJSON);
      }).toThrow();
    });

    it('should handle missing required fields in patch JSON', () => {
      const invalidPatch = {
        // Missing 'name' field
        components: [],
        connections: [],
      };

      expect(() => {
        PatchSerializer.validatePatchData(invalidPatch);
      }).toThrow('Invalid patch data: name is required');
    });

    it('should throw error for missing components array', () => {
      const invalidPatch = {
        name: 'Test',
        connections: [],
      };

      expect(() => {
        PatchSerializer.validatePatchData(invalidPatch);
      }).toThrow('Invalid patch data: components must be an array');
    });

    it('should throw error for missing connections array', () => {
      const invalidPatch = {
        name: 'Test',
        components: [],
      };

      expect(() => {
        PatchSerializer.validatePatchData(invalidPatch);
      }).toThrow('Invalid patch data: connections must be an array');
    });

    it('should throw error for invalid component data', () => {
      const invalidPatch = {
        name: 'Test',
        components: [
          {
            // Missing 'id' field
            type: 'oscillator',
            position: { x: 100, y: 100 },
            parameters: {},
          },
        ],
        connections: [],
      };

      expect(() => {
        PatchSerializer.validatePatchData(invalidPatch);
      }).toThrow('Invalid component data: missing required fields');
    });

    it('should throw error for invalid position data', () => {
      const invalidPatch = {
        name: 'Test',
        components: [
          {
            id: 'osc1',
            type: 'oscillator',
            position: { x: 'invalid', y: 100 }, // x is not a number
            parameters: {},
          },
        ],
        connections: [],
      };

      expect(() => {
        PatchSerializer.validatePatchData(invalidPatch);
      }).toThrow('Invalid component data: position must have x and y numbers');
    });

    it('should throw error for invalid connection data', () => {
      const invalidPatch = {
        name: 'Test',
        components: [],
        connections: [
          {
            // Missing required connection fields
            id: 'conn1',
          },
        ],
      };

      expect(() => {
        PatchSerializer.validatePatchData(invalidPatch);
      }).toThrow('Invalid connection data: missing required fields');
    });
  });

  describe('Patch Integrity', () => {
    it('should maintain data integrity through serialize/deserialize cycle', () => {
      const original = createSubtractivePatch();
      const jsonString = PatchSerializer.toJSON(original);
      const restored = PatchSerializer.fromJSON(jsonString);

      expectPatchIntegrity(original, restored);
    });

    it('should validate connection references point to existing components', () => {
      const patch = createSimplePatch();
      expectValidConnectionReferences(patch);

      // Serialize and deserialize
      const jsonString = PatchSerializer.toJSON(patch);
      const restored = PatchSerializer.fromJSON(jsonString);

      expectValidConnectionReferences(restored);
    });

    it('should preserve patch name through cycle', () => {
      const patch = createEmptyPatch({ name: 'My Custom Patch' });
      expectValidPatchName(patch);

      const jsonString = PatchSerializer.toJSON(patch);
      const restored = PatchSerializer.fromJSON(jsonString);

      expectValidPatchName(restored);
      expect(restored.name).toBe('My Custom Patch');
    });
  });

  describe('Utility Methods', () => {
    it('should create empty patch with default name', () => {
      const patch = PatchSerializer.createEmptyPatch();

      expect(patch.name).toBe('Untitled');
      expect(patch.components).toHaveLength(0);
      expect(patch.connections).toHaveLength(0);
      expect(patch.version).toBe('1.0');
    });

    it('should create empty patch with custom name', () => {
      const patch = PatchSerializer.createEmptyPatch('My Patch');

      expect(patch.name).toBe('My Patch');
    });

    it('should update patch timestamp', () => {
      const original = createEmptyPatch();
      original.modified = '2024-01-01T00:00:00.000Z'; // Set old timestamp

      const updated = PatchSerializer.updatePatchTimestamp(original);

      expect(updated.modified).not.toBe(original.modified);
      expect(new Date(updated.modified).getTime()).toBeGreaterThan(
        new Date(original.modified).getTime()
      );
    });

    it('should clone patch with new name', () => {
      const original = createSimplePatch();
      original.created = '2024-01-01T00:00:00.000Z'; // Set fixed timestamp

      const cloned = PatchSerializer.clonePatch(original, 'Cloned Patch');

      expect(cloned.name).toBe('Cloned Patch');
      expect(cloned.components).toHaveLength(original.components.length);
      expect(cloned.connections).toHaveLength(original.connections.length);
      // Cloned timestamp should be newer
      expect(new Date(cloned.created).getTime()).toBeGreaterThan(
        new Date(original.created).getTime()
      );
    });

    it('should get patch metadata', () => {
      const patch = createComplexPatch();
      const metadata = PatchSerializer.getPatchMetadata(patch);

      expect(metadata.name).toBe(patch.name);
      expect(metadata.version).toBe(patch.version);
      expect(metadata.componentCount).toBe(5);
      expect(metadata.connectionCount).toBe(8);
    });

    it('should compare patches for equality', () => {
      const patch1 = createSimplePatch();
      // Create a copy with same structure
      const patch2 = JSON.parse(JSON.stringify(patch1));

      expect(PatchSerializer.patchesEqual(patch1, patch2)).toBe(true);
    });

    it('should detect patches are not equal', () => {
      const patch1 = createSimplePatch();
      const patch2 = createComplexPatch();

      expect(PatchSerializer.patchesEqual(patch1, patch2)).toBe(false);
    });
  });

  describe('Version Handling', () => {
    it('should default to version 1.0 if missing', () => {
      const patchData = {
        name: 'Test',
        components: [],
        connections: [],
      };

      const validated = PatchSerializer.validatePatchData(patchData);
      expect(validated.version).toBe('1.0');
    });

    it('should preserve version if provided', () => {
      const patchData = {
        name: 'Test',
        version: '2.0',
        components: [],
        connections: [],
      };

      const validated = PatchSerializer.validatePatchData(patchData);
      expect(validated.version).toBe('2.0');
    });
  });

  describe('Timestamp Handling', () => {
    it('should add timestamps if missing', () => {
      const patchData = {
        name: 'Test',
        components: [],
        connections: [],
      };

      const validated = PatchSerializer.validatePatchData(patchData);
      expect(validated.created).toBeDefined();
      expect(validated.modified).toBeDefined();
    });

    it('should preserve timestamps if provided', () => {
      const created = '2024-01-01T00:00:00.000Z';
      const modified = '2024-01-02T00:00:00.000Z';

      const patchData = {
        name: 'Test',
        created,
        modified,
        components: [],
        connections: [],
      };

      const validated = PatchSerializer.validatePatchData(patchData);
      expect(validated.created).toBe(created);
      expect(validated.modified).toBe(modified);
    });
  });
});
