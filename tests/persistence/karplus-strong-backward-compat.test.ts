/**
 * Backward compatibility test for the Karplus-Strong feature (T037).
 *
 * Verifies that a patch predating this feature (no Karplus-Strong component,
 * unaware of the new ComponentType.KARPLUS_STRONG enum member) still
 * serializes and deserializes without error now that the type has been
 * registered. PatchSerializer/PatchManager are type-agnostic over
 * ComponentData, so this mainly guards against any accidental coupling.
 *
 * Feature: 034-karplus-strong-oscillator
 */

import { describe, it, expect } from 'vitest';
import { PatchSerializer } from '../../src/patch/PatchSerializer';
import { createSubtractivePatch } from '../fixtures/patches.fixture';

describe('Karplus-Strong backward compatibility', () => {
  it('a legacy patch with no Karplus-Strong component loads without error', () => {
    const legacyPatch = createSubtractivePatch();

    expect(() => {
      const jsonString = PatchSerializer.toJSON(legacyPatch);
      const restored = PatchSerializer.fromJSON(jsonString);
      expect(restored.components).toHaveLength(legacyPatch.components.length);
      expect(restored.connections).toHaveLength(legacyPatch.connections.length);
    }).not.toThrow();
  });

  it('a legacy patch contains no reference to the karplus-strong type', () => {
    const legacyPatch = createSubtractivePatch();
    const types = legacyPatch.components.map((c) => c.type);
    expect(types).not.toContain('karplus-strong');
  });

  it('preserves all legacy component types and parameters exactly through a round trip', () => {
    const legacyPatch = createSubtractivePatch();
    const jsonString = PatchSerializer.toJSON(legacyPatch);
    const restored = PatchSerializer.fromJSON(jsonString);

    for (let i = 0; i < legacyPatch.components.length; i++) {
      expect(restored.components[i].type).toBe(legacyPatch.components[i].type);
      expect(restored.components[i].parameters).toEqual(legacyPatch.components[i].parameters);
    }
  });
});
