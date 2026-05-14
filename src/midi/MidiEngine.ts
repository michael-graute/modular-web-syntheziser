import type { MidiMapping, MidiLearnSession, PatchData } from '../core/types';
import { mappingKey, sanitiseMidiMappings } from './midiValidation';

class MidiEngine {
  private mappings: Map<string, MidiMapping> = new Map();
  private learnSession: MidiLearnSession | null = null;
  activeInputId: string | null = null;
  midiAccess: MIDIAccess | null = null;

  isLearnActive(): boolean {
    return this.learnSession !== null;
  }

  saveToPatch(patch: PatchData): void {
    patch.midiMappings = Array.from(this.mappings.values());
  }

  loadFromPatch(patch: PatchData): void {
    const validated = sanitiseMidiMappings(patch.midiMappings ?? []);
    this.mappings.clear();
    for (const m of validated) {
      this.mappings.set(mappingKey(m.componentId, m.parameterName), m);
    }
  }
}

export const midiEngine = new MidiEngine();
