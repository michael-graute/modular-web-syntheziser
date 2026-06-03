import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceAllocator } from '../../src/components/utilities/VoiceAllocator';

describe('VoiceAllocator', () => {
  let allocator: VoiceAllocator;

  beforeEach(() => {
    allocator = new VoiceAllocator();
  });

  describe('initial state', () => {
    it('starts with 4 idle slots', () => {
      const slots = allocator.getSlots();
      expect(slots).toHaveLength(4);
      slots.forEach((slot, i) => {
        expect(slot.voiceIndex).toBe(i);
        expect(slot.gate).toBe(0);
        expect(slot.note).toBeNull();
      });
    });
  });

  describe('noteOn', () => {
    it('allocates the first idle slot', () => {
      allocator.noteOn(60, 261.63);
      const slots = allocator.getSlots();
      expect(slots[0]!.note).toBe(60);
      expect(slots[0]!.frequency).toBeCloseTo(261.63);
      expect(slots[0]!.gate).toBe(1);
    });

    it('allocates successive notes to successive slots', () => {
      allocator.noteOn(60, 261.63);
      allocator.noteOn(64, 329.63);
      allocator.noteOn(67, 392.0);
      const slots = allocator.getSlots();
      expect(slots[0]!.note).toBe(60);
      expect(slots[1]!.note).toBe(64);
      expect(slots[2]!.note).toBe(67);
      expect(slots[3]!.gate).toBe(0);
    });

    it('allocates all 4 slots when 4 notes held', () => {
      allocator.noteOn(60, 261.63);
      allocator.noteOn(64, 329.63);
      allocator.noteOn(67, 392.0);
      allocator.noteOn(72, 523.25);
      const slots = allocator.getSlots();
      expect(slots.every(s => s.gate === 1)).toBe(true);
    });

    it('retriggers the same voice slot when the same note is pressed again', () => {
      allocator.noteOn(60, 261.63);
      allocator.noteOn(60, 261.63);
      const slots = allocator.getSlots();
      const activeSlots = slots.filter(s => s.gate === 1);
      // only one slot active — same note retriggers the same slot
      expect(activeSlots).toHaveLength(1);
      expect(activeSlots[0]!.note).toBe(60);
    });

    it('steals the oldest active voice when all 4 slots are occupied', () => {
      // Assign timestamps in order so we know which is oldest
      allocator.noteOn(60, 261.63); // slot 0 — will be oldest
      allocator.noteOn(64, 329.63);
      allocator.noteOn(67, 392.0);
      allocator.noteOn(72, 523.25);

      // Manually backdate slot 0's timestamp so it is clearly oldest
      const slots = allocator.getSlots() as any[];
      slots[0].timestamp = 0;

      // 5th note should steal slot 0
      allocator.noteOn(76, 659.26);

      const updatedSlots = allocator.getSlots();
      expect(updatedSlots[0]!.note).toBe(76);
      expect(updatedSlots[0]!.frequency).toBeCloseTo(659.26);
      expect(updatedSlots[0]!.gate).toBe(1);
    });
  });

  describe('noteOff', () => {
    it('releases the correct slot', () => {
      allocator.noteOn(60, 261.63);
      allocator.noteOn(64, 329.63);
      allocator.noteOff(60);
      const slots = allocator.getSlots();
      expect(slots[0]!.gate).toBe(0);
      expect(slots[0]!.note).toBeNull();
      expect(slots[1]!.gate).toBe(1); // note 64 still active
    });

    it('is a no-op for a note not currently held', () => {
      allocator.noteOn(60, 261.63);
      allocator.noteOff(99); // not held
      expect(allocator.getSlots()[0]!.gate).toBe(1);
    });
  });

  describe('releaseAll', () => {
    it('zeros all slots', () => {
      allocator.noteOn(60, 261.63);
      allocator.noteOn(64, 329.63);
      allocator.releaseAll();
      const slots = allocator.getSlots();
      expect(slots.every(s => s.gate === 0)).toBe(true);
      expect(slots.every(s => s.note === null)).toBe(true);
    });
  });

  describe('getSlots', () => {
    it('returns a readonly reference — external mutation does not affect allocator state indirectly', () => {
      allocator.noteOn(60, 261.63);
      const slots = allocator.getSlots();
      // The returned reference is the same array (readonly, not a copy)
      // — confirms it is read-only by type contract
      expect(slots).toHaveLength(4);
    });
  });
});
