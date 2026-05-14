import type { MidiMapping, MidiLearnSession, MidiDeviceInfo, PatchData } from '../core/types';
import { EventType } from '../core/types';
import { eventBus } from '../core/EventBus';
import { NoteMapper } from '../keyboard/NoteMapper';
import { mappingKey, sanitiseMidiMappings } from './midiValidation';

class MidiEngine {
  private mappings: Map<string, MidiMapping> = new Map();
  private learnSession: MidiLearnSession | null = null;
  activeInputId: string | null = null;
  midiAccess: MIDIAccess | null = null;

  isLearnActive(): boolean {
    return this.learnSession !== null;
  }

  async init(): Promise<void> {
    if (!navigator.requestMIDIAccess) {
      this.midiAccess = null;
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      this.midiAccess = null;
      return;
    }

    // Emit connected event for each input already present
    this.midiAccess.inputs.forEach((input) => {
      eventBus.emit(EventType.MIDI_DEVICE_CONNECTED, { deviceName: input.name ?? input.id });
    });

    // Auto-select the first available device
    const inputs = Array.from(this.midiAccess.inputs.values());
    if (inputs.length > 0) {
      this.setActiveInput(inputs[0]!.id);
    }

    // Hot-plug
    this.midiAccess.onstatechange = (e) => {
      const port = e.port;
      if (!port || port.type !== 'input') return;
      if (port.state === 'connected') {
        eventBus.emit(EventType.MIDI_DEVICE_CONNECTED, { deviceName: port.name ?? port.id });
        // Auto-select if nothing is currently active
        if (!this.activeInputId) {
          this.setActiveInput(port.id);
        }
      } else {
        eventBus.emit(EventType.MIDI_DEVICE_DISCONNECTED, { deviceName: port.name ?? port.id });
        if (this.activeInputId === port.id) {
          this.activeInputId = null;
        }
      }
    };
  }

  getAvailableInputs(): MidiDeviceInfo[] {
    if (!this.midiAccess) return [];
    const result: MidiDeviceInfo[] = [];
    this.midiAccess.inputs.forEach((input) => {
      result.push({
        id: input.id,
        name: input.name ?? input.id,
        connected: input.state === 'connected',
      });
    });
    return result;
  }

  setActiveInput(deviceId: string | null): void {
    // Unregister previous listener
    if (this.activeInputId && this.midiAccess) {
      const prev = this.midiAccess.inputs.get(this.activeInputId);
      if (prev) prev.onmidimessage = null;
    }

    this.activeInputId = deviceId;

    if (deviceId && this.midiAccess) {
      const input = this.midiAccess.inputs.get(deviceId);
      if (input) {
        input.onmidimessage = (e) => this.handleMidiMessage(e);
      }
    }
  }

  private handleMidiMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0]!;
    const byte1 = data[1]!;
    const byte2 = data.length > 2 ? data[2]! : 0;

    const msgType = status & 0xf0;

    if (msgType === 0x90 && byte2 > 0) {
      // Note On
      const frequency = NoteMapper.midiToFrequency(byte1);
      eventBus.emit(EventType.NOTE_ON, { note: byte1, velocity: byte2 / 127, frequency });
    } else if (msgType === 0x80 || (msgType === 0x90 && byte2 === 0)) {
      // Note Off
      eventBus.emit(EventType.NOTE_OFF, { note: byte1 });
    }
    // CC handling deferred to Phase 4 (T020)
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
