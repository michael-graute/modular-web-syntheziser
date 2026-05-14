import { midiEngine } from '../midi/MidiEngine';
import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';
import type { MidiDeviceInfo } from '../core/types';

export class MidiToolbar {
  private container: HTMLElement;
  private statusEl: HTMLSpanElement;
  private select: HTMLSelectElement;
  private learnBtn: HTMLButtonElement;
  private unsubConnected: (() => void) | null = null;
  private unsubDisconnected: (() => void) | null = null;

  constructor() {
    const mount = document.getElementById('midi-toolbar');
    if (!mount) throw new Error('MidiToolbar: #midi-toolbar not found');

    this.container = document.createElement('div');
    this.container.className = 'midi-toolbar';

    // Status indicator
    this.statusEl = document.createElement('span');
    this.statusEl.className = 'midi-status';

    // Device picker
    this.select = document.createElement('select');
    this.select.className = 'midi-device-select';
    this.select.title = 'MIDI Input Device';

    // MIDI Learn button (inactive in Phase 3 — wired in Phase 4)
    this.learnBtn = document.createElement('button');
    this.learnBtn.className = 'midi-learn-btn';
    this.learnBtn.textContent = 'MIDI Learn';
    this.learnBtn.disabled = true;
    this.learnBtn.title = 'MIDI Learn (available after device connected)';

    this.container.appendChild(this.statusEl);
    this.container.appendChild(this.select);
    this.container.appendChild(this.learnBtn);
    mount.appendChild(this.container);

    this.select.addEventListener('change', () => {
      const val = this.select.value;
      midiEngine.setActiveInput(val || null);
    });

    this.unsubConnected = eventBus.on(EventType.MIDI_DEVICE_CONNECTED, () => this.refresh());
    this.unsubDisconnected = eventBus.on(EventType.MIDI_DEVICE_DISCONNECTED, () => this.refresh());

    this.refresh();
  }

  private refresh(): void {
    const inputs = midiEngine.getAvailableInputs();
    const currentId = midiEngine.activeInputId;

    // Rebuild options
    this.select.innerHTML = '';
    if (inputs.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No device';
      this.select.appendChild(opt);
    } else {
      inputs.forEach((device: MidiDeviceInfo) => {
        const opt = document.createElement('option');
        opt.value = device.id;
        opt.textContent = device.name;
        if (device.id === currentId) opt.selected = true;
        this.select.appendChild(opt);
      });
    }

    this.updateStatus(inputs);
  }

  private updateStatus(inputs: MidiDeviceInfo[]): void {
    if (!midiEngine.midiAccess) {
      this.statusEl.className = 'midi-status midi-status--unavailable';
      this.statusEl.title = 'MIDI unavailable';
      this.learnBtn.disabled = true;
    } else if (inputs.length === 0) {
      this.statusEl.className = 'midi-status midi-status--no-device';
      this.statusEl.title = 'No MIDI device connected';
      this.learnBtn.disabled = true;
    } else {
      this.statusEl.className = 'midi-status midi-status--connected';
      const name = inputs.find((d) => d.id === midiEngine.activeInputId)?.name ?? inputs[0]!.name;
      this.statusEl.title = `Connected: ${name}`;
      this.learnBtn.disabled = false;
    }
  }

  destroy(): void {
    this.unsubConnected?.();
    this.unsubDisconnected?.();
    this.unsubConnected = null;
    this.unsubDisconnected = null;
  }
}
