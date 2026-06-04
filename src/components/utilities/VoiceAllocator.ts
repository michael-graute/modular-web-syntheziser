export interface VoiceSlot {
  readonly voiceIndex: 0 | 1 | 2 | 3;
  frequency: number;
  gate: 0 | 1;
  note: number | null;
  timestamp: number;
}

const VOICE_COUNT = 4 as const;

function findVoiceForNote(slots: VoiceSlot[], note: number): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]!.note === note) return i;
  }
  return -1;
}

function findIdleVoice(slots: VoiceSlot[]): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]!.gate === 0) return i;
  }
  return -1;
}

function findOldestVoice(slots: VoiceSlot[]): number {
  let oldestIndex = -1;
  let oldestTimestamp = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    if (slot.gate === 1 && slot.timestamp < oldestTimestamp) {
      oldestTimestamp = slot.timestamp;
      oldestIndex = i;
    }
  }
  return oldestIndex;
}

export class VoiceAllocator {
  private slots: VoiceSlot[];

  constructor() {
    this.slots = Array.from({ length: VOICE_COUNT }, (_, i) => ({
      voiceIndex: i as 0 | 1 | 2 | 3,
      frequency: 0,
      gate: 0 as const,
      note: null,
      timestamp: 0,
    }));
  }

  noteOn(note: number, frequency: number): void {
    // Retrigger if this note is already held in a slot
    const existingIndex = findVoiceForNote(this.slots, note);
    if (existingIndex !== -1) {
      const slot = this.slots[existingIndex]!;
      slot.frequency = frequency;
      slot.gate = 1;
      slot.timestamp = performance.now();
      return;
    }

    // Assign to first idle slot
    const idleIndex = findIdleVoice(this.slots);
    if (idleIndex !== -1) {
      const slot = this.slots[idleIndex]!;
      slot.note = note;
      slot.frequency = frequency;
      slot.gate = 1;
      slot.timestamp = performance.now();
      return;
    }

    // All 4 active — steal the oldest voice (FR-005)
    const stealIndex = findOldestVoice(this.slots);
    if (stealIndex !== -1) {
      const slot = this.slots[stealIndex]!;
      slot.note = note;
      slot.frequency = frequency;
      slot.gate = 1;
      slot.timestamp = performance.now();
    }
  }

  noteOff(note: number): void {
    const index = findVoiceForNote(this.slots, note);
    if (index !== -1) {
      const slot = this.slots[index]!;
      slot.gate = 0;
      slot.note = null;
    }
  }

  releaseAll(): void {
    for (const slot of this.slots) {
      slot.gate = 0;
      slot.note = null;
    }
  }

  getSlots(): Readonly<VoiceSlot[]> {
    return this.slots;
  }
}
