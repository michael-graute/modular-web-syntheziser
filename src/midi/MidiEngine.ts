import type { MidiMapping, MidiLearnSession, MidiDeviceInfo, PatchData, MidiRawMessagePayload } from '../core/types';
import { EventType } from '../core/types';
import { eventBus } from '../core/EventBus';
import { NoteMapper } from '../keyboard/NoteMapper';
import { mappingKey, scaleCcToParam, sanitiseMidiMappings } from './midiValidation';
import type { SynthComponent } from '../components/base/SynthComponent';

class MidiEngine {
  private mappings: Map<string, MidiMapping> = new Map();
  private learnSession: MidiLearnSession | null = null;
  // True while the toolbar "MIDI Learn" button is toggled but no control has been clicked yet
  learnModeEnabled: boolean = false;
  activeInputId: string | null = null;
  midiAccess: MIDIAccess | null = null;

  // Injected by main.ts after canvas is ready
  private componentResolver: ((id: string) => SynthComponent | null) | null = null;

  setComponentResolver(fn: (id: string) => SynthComponent | null): void {
    this.componentResolver = fn;
  }

  /** True when the toolbar has toggled learn mode (waiting for a control click) */
  isLearnActive(): boolean {
    return this.learnModeEnabled || this.learnSession !== null;
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

    this.midiAccess.inputs.forEach((input) => {
      eventBus.emit(EventType.MIDI_DEVICE_CONNECTED, { deviceName: input.name ?? input.id });
    });

    const inputs = Array.from(this.midiAccess.inputs.values());
    if (inputs.length > 0) {
      this.setActiveInput(inputs[0]!.id);
    }

    this.midiAccess.onstatechange = (e) => {
      const port = e.port;
      if (!port || port.type !== 'input') return;
      if (port.state === 'connected') {
        eventBus.emit(EventType.MIDI_DEVICE_CONNECTED, { deviceName: port.name ?? port.id });
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

  enableLearnMode(): void {
    this.learnModeEnabled = true;
    this.learnSession = null;
    eventBus.emit(EventType.MIDI_LEARN_STARTED, { componentId: '', parameterName: '' });
  }

  startLearn(componentId: string, parameterName: string): void {
    this.learnModeEnabled = false;
    this.learnSession = { componentId, parameterName };
    eventBus.emit(EventType.MIDI_LEARN_STARTED, { componentId, parameterName });
  }

  cancelLearn(): void {
    this.learnModeEnabled = false;
    this.learnSession = null;
    eventBus.emit(EventType.MIDI_LEARN_CANCELLED, {});
  }

  getMappings(): MidiMapping[] {
    return Array.from(this.mappings.values());
  }

  removeMapping(componentId: string, parameterName: string): void {
    this.mappings.delete(mappingKey(componentId, parameterName));
    eventBus.emit(EventType.MIDI_MAPPINGS_CHANGED, {});
  }

  clearAllMappings(): void {
    this.mappings.clear();
    eventBus.emit(EventType.MIDI_MAPPINGS_CHANGED, {});
  }

  private handleMidiMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0]!;
    const byte1 = data[1]!;
    const byte2 = data.length > 2 ? data[2]! : 0;

    const rawPayload: MidiRawMessagePayload = { status, byte1, byte2, timestamp: performance.now() };
    eventBus.emit(EventType.MIDI_MESSAGE_RECEIVED, rawPayload);

    const msgType = status & 0xf0;
    const channel = status & 0x0f;

    if (msgType === 0x90 && byte2 > 0) {
      const frequency = NoteMapper.midiToFrequency(byte1);
      eventBus.emit(EventType.NOTE_ON, { note: byte1, velocity: byte2 / 127, frequency });
    } else if (msgType === 0x80 || (msgType === 0x90 && byte2 === 0)) {
      eventBus.emit(EventType.NOTE_OFF, { note: byte1 });
    } else if (msgType === 0xb0) {
      // CC message
      const cc = byte1;
      const ccValue = byte2;

      if (this.learnSession) {
        // Complete learn: resolve parameter range, create mapping
        const { componentId, parameterName } = this.learnSession;
        const component = this.componentResolver?.(componentId) ?? null;
        const range = component
          ? component.getParameterRange(parameterName)
          : { min: 0, max: 1 };

        const mapping: MidiMapping = {
          componentId,
          parameterName,
          channel,
          cc,
          minValue: range.min,
          maxValue: range.max,
        };

        this.mappings.set(mappingKey(componentId, parameterName), mapping);
        this.learnSession = null;
        eventBus.emit(EventType.MIDI_LEARN_COMPLETED, { mapping });
        eventBus.emit(EventType.MIDI_MAPPINGS_CHANGED, {});
      } else {
        this.dispatchCc(channel, cc, ccValue);
      }
    }
  }

  private dispatchCc(channel: number, cc: number, value: number): void {
    this.mappings.forEach((mapping) => {
      // channel 0 = omni: match any channel
      if (mapping.cc !== cc) return;
      if (mapping.channel !== 0 && mapping.channel !== channel) return;

      const scaled = scaleCcToParam(value, mapping.minValue, mapping.maxValue);
      const component = this.componentResolver?.(mapping.componentId) ?? null;
      if (!component) return;

      component.setParameterValue(mapping.parameterName, scaled);
      eventBus.emit(EventType.PARAMETER_CHANGED, {
        componentId: mapping.componentId,
        parameterId: mapping.parameterName,
        value: scaled,
      });
    });
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
