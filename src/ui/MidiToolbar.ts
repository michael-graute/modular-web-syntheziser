import { midiEngine } from '../midi/MidiEngine';
import { MidiMappingsModal } from './MidiMappingsModal';
import { MidiMonitorWindow } from './MidiMonitorWindow';
import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';
import type { MidiDeviceInfo } from '../core/types';

export class MidiToolbar {
  private container: HTMLElement;
  private statusEl: HTMLSpanElement;
  private select: HTMLSelectElement;
  private learnBtn: HTMLButtonElement;
  private mappingsBtn: HTMLButtonElement;
  private monitorBtn: HTMLButtonElement;
  private mappingsModal: MidiMappingsModal;
  private monitorWindow: MidiMonitorWindow;
  private unsubConnected: (() => void) | null = null;
  private unsubDisconnected: (() => void) | null = null;
  private unsubLearnStarted: (() => void) | null = null;
  private unsubLearnCompleted: (() => void) | null = null;
  private unsubLearnCancelled: (() => void) | null = null;

  constructor() {
    const mount = document.getElementById('midi-toolbar');
    if (!mount) throw new Error('MidiToolbar: #midi-toolbar not found');

    this.mappingsModal = new MidiMappingsModal();
    this.monitorWindow = new MidiMonitorWindow();

    this.container = document.createElement('div');
    this.container.className = 'midi-toolbar';

    this.statusEl = document.createElement('span');
    this.statusEl.className = 'midi-status';

    this.select = document.createElement('select');
    this.select.className = 'midi-device-select';
    this.select.title = 'MIDI Input Device';

    this.learnBtn = document.createElement('button');
    this.learnBtn.className = 'midi-learn-btn';
    this.learnBtn.textContent = 'MIDI Learn';
    this.learnBtn.disabled = true;
    this.learnBtn.title = 'Click to enter MIDI Learn mode, then click a knob';

    this.mappingsBtn = document.createElement('button');
    this.mappingsBtn.className = 'midi-mappings-open-btn';
    this.mappingsBtn.textContent = 'Mappings';
    this.mappingsBtn.title = 'View and manage MIDI CC mappings';

    this.monitorBtn = document.createElement('button');
    this.monitorBtn.className = 'midi-monitor-open-btn';
    this.monitorBtn.textContent = 'MIDI Monitor';
    this.monitorBtn.title = 'Open the MIDI Monitor to view incoming MIDI events';

    this.container.appendChild(this.statusEl);
    this.container.appendChild(this.select);
    this.container.appendChild(this.learnBtn);
    this.container.appendChild(this.mappingsBtn);
    this.container.appendChild(this.monitorBtn);
    mount.appendChild(this.container);

    this.select.addEventListener('change', () => {
      const val = this.select.value;
      midiEngine.setActiveInput(val || null);
    });

    this.learnBtn.addEventListener('click', () => {
      if (midiEngine.isLearnActive()) {
        midiEngine.cancelLearn();
      } else {
        midiEngine.enableLearnMode();
      }
    });

    this.mappingsBtn.addEventListener('click', () => {
      this.mappingsModal.open();
    });

    this.monitorBtn.addEventListener('click', () => {
      this.monitorWindow.open();
    });

    this.unsubConnected = eventBus.on(EventType.MIDI_DEVICE_CONNECTED, () => this.refresh());
    this.unsubDisconnected = eventBus.on(EventType.MIDI_DEVICE_DISCONNECTED, () => this.refresh());

    this.unsubLearnStarted = eventBus.on(EventType.MIDI_LEARN_STARTED, () => {
      this.learnBtn.classList.add('active');
      this.learnBtn.textContent = 'Cancel Learn';
    });

    this.unsubLearnCompleted = eventBus.on(EventType.MIDI_LEARN_COMPLETED, () => {
      this.learnBtn.classList.remove('active');
      this.learnBtn.textContent = 'MIDI Learn';
    });

    this.unsubLearnCancelled = eventBus.on(EventType.MIDI_LEARN_CANCELLED, () => {
      this.learnBtn.classList.remove('active');
      this.learnBtn.textContent = 'MIDI Learn';
    });

    this.refresh();
  }

  private refresh(): void {
    const inputs = midiEngine.getAvailableInputs();
    const currentId = midiEngine.activeInputId;

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
    this.unsubLearnStarted?.();
    this.unsubLearnCompleted?.();
    this.unsubLearnCancelled?.();
    this.unsubConnected = null;
    this.unsubDisconnected = null;
    this.unsubLearnStarted = null;
    this.unsubLearnCompleted = null;
    this.unsubLearnCancelled = null;
  }
}
