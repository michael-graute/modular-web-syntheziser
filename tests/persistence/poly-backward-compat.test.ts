/**
 * Backward compatibility tests for the polyphony feature (T027).
 *
 * Verifies that existing patches saved before the polyMode parameter existed
 * load correctly as mono mode — no migration logic required.
 * Satisfies FR-015 and SC-007.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KeyboardInput } from '../../src/components/utilities/KeyboardInput';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';
import { audioEngine } from '../../src/core/AudioEngine';
import { ComponentType } from '../../src/core/types';
import type { ComponentData } from '../../src/core/types';

describe('Polyphony backward compatibility', () => {
  let kbd: KeyboardInput;

  beforeEach(() => {
    const ctx = new MockAudioContext();
    (audioEngine as any).context = ctx;
    (audioEngine as any).isInitialized = true;
    kbd = new KeyboardInput('kbd-legacy', { x: 0, y: 0 });
    kbd.activate();
  });

  afterEach(() => {
    kbd.deactivate();
    (audioEngine as any).context = null;
    (audioEngine as any).isInitialized = false;
    (audioEngine as any).nodes = new Map();
  });

  it('legacy patch without polyMode field deserializes as mono (SC-007)', () => {
    // Simulate a ComponentData from a patch saved before the polyMode parameter existed
    const legacyData: ComponentData = {
      id: 'kbd-legacy',
      type: ComponentType.KEYBOARD_INPUT,
      position: { x: 100, y: 200 },
      parameters: {
        // No polyMode key — as it would be in any pre-feature patch
      },
    };

    kbd.deserialize(legacyData);

    // Should default to mono (0) because addParameter default value = 0
    expect(kbd.isPolyMode()).toBe(false);
    expect(kbd.getParameter('polyMode')?.getValue()).toBe(0);
  });

  it('legacy patch with only known parameters (no polyMode) plays mono notes correctly', () => {
    const legacyData: ComponentData = {
      id: 'kbd-legacy',
      type: ComponentType.KEYBOARD_INPUT,
      position: { x: 0, y: 0 },
      parameters: {},
    };

    kbd.deserialize(legacyData);

    // Mono behaviour: triggerNoteOn populates activeNotes, not voice allocator
    kbd.triggerNoteOn(60, 261.63, 1.0);
    expect(kbd.getGateValue()).toBe(1);
    expect(kbd.getCurrentFrequency()).toBeCloseTo(261.63, 1);
    expect(kbd.getVoiceSlots().every(s => s.gate === 0)).toBe(true);
  });

  it('new patch with polyMode=0 serializes and deserializes identically to legacy behaviour', () => {
    // Explicit mono: same as legacy but polyMode is present and 0
    const data = kbd.serialize();
    expect(data.parameters['polyMode']).toBe(0);

    const kbd2 = new KeyboardInput('kbd-new', { x: 0, y: 0 });
    kbd2.activate();
    kbd2.deserialize(data);

    expect(kbd2.isPolyMode()).toBe(false);
    kbd2.deactivate();
  });

  it('poly patch round-trips correctly and restores in poly mode', () => {
    kbd.setPolyMode(1);
    const data = kbd.serialize();
    expect(data.parameters['polyMode']).toBe(1);

    const kbd2 = new KeyboardInput('kbd-poly-restored', { x: 0, y: 0 });
    kbd2.activate();
    kbd2.deserialize(data);

    expect(kbd2.isPolyMode()).toBe(true);
    kbd2.deactivate();
  });
});
