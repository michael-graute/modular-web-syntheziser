import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MidiToolbar } from '../../src/ui/MidiToolbar';
import { midiEngine } from '../../src/midi/MidiEngine';
import { eventBus } from '../../src/core/EventBus';
import { EventType } from '../../src/core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mountPoint(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'midi-toolbar';
  document.body.appendChild(el);
  return el;
}

function resetEngine(): void {
  midiEngine.clearAllMappings();
  if (midiEngine.isLearnActive()) midiEngine.cancelLearn();
  (midiEngine as any).midiAccess = null;
  (midiEngine as any).learnModeEnabled = false;
  (midiEngine as any).learnSession = null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MidiToolbar', () => {
  let mount: HTMLDivElement;
  let toolbar: MidiToolbar;

  beforeEach(() => {
    resetEngine();
    mount = mountPoint();
    toolbar = new MidiToolbar();
  });

  afterEach(() => {
    toolbar.destroy();
    mount.remove();
  });

  // -------------------------------------------------------------------------
  // Initial render
  // -------------------------------------------------------------------------

  it('renders inside #midi-toolbar', () => {
    const inner = document.getElementById('midi-toolbar');
    expect(inner).toBeTruthy();
    expect(inner!.querySelector('.midi-toolbar')).toBeTruthy();
  });

  it('renders a status indicator element', () => {
    const status = document.querySelector('.midi-status');
    expect(status).toBeTruthy();
  });

  it('renders a device select element', () => {
    const select = document.querySelector('.midi-device-select') as HTMLSelectElement;
    expect(select).toBeTruthy();
  });

  it('renders a MIDI Learn button', () => {
    const btn = document.querySelector('.midi-learn-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('MIDI Learn');
  });

  it('renders a Mappings button', () => {
    const btn = document.querySelector('.midi-mappings-open-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Mappings');
  });

  // -------------------------------------------------------------------------
  // Status when no MIDI access
  // -------------------------------------------------------------------------

  it('MIDI Learn button is disabled when no MIDI access', () => {
    const btn = document.querySelector('.midi-learn-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('status indicator shows unavailable class when no MIDI access', () => {
    const status = document.querySelector('.midi-status');
    expect(status!.className).toContain('midi-status--unavailable');
  });

  it('device select shows "No device" option when no devices', () => {
    const select = document.querySelector('.midi-device-select') as HTMLSelectElement;
    expect(select.options[0]?.text).toBe('No device');
  });

  // -------------------------------------------------------------------------
  // Device picker refresh on MIDI_DEVICE_CONNECTED
  // -------------------------------------------------------------------------

  it('device picker refreshes on MIDI_DEVICE_CONNECTED event', () => {
    // Simulate a device being available by setting midiAccess with one input
    const input = {
      id: 'dev-1',
      name: 'Test Keyboard',
      type: 'input',
      state: 'connected',
      connection: 'open',
      manufacturer: '',
      version: '',
      onmidimessage: null,
      onstatechange: null,
      open: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MIDIInput;

    const inputMap = new Map([['dev-1', input]]);
    (midiEngine as any).midiAccess = {
      inputs: inputMap,
      outputs: new Map(),
      sysexEnabled: false,
      onstatechange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    eventBus.emit(EventType.MIDI_DEVICE_CONNECTED, { deviceName: 'Test Keyboard' });

    const select = document.querySelector('.midi-device-select') as HTMLSelectElement;
    expect(select.options).toHaveLength(1);
    expect(select.options[0]!.text).toBe('Test Keyboard');
  });

  // -------------------------------------------------------------------------
  // MIDI Learn button state
  // -------------------------------------------------------------------------

  it('MIDI Learn button gains "active" class on MIDI_LEARN_STARTED', () => {
    const btn = document.querySelector('.midi-learn-btn') as HTMLButtonElement;
    eventBus.emit(EventType.MIDI_LEARN_STARTED, { componentId: '', parameterName: '' });
    expect(btn.classList.contains('active')).toBe(true);
    expect(btn.textContent).toBe('Cancel Learn');
  });

  it('MIDI Learn button loses "active" class on MIDI_LEARN_COMPLETED', () => {
    eventBus.emit(EventType.MIDI_LEARN_STARTED, { componentId: '', parameterName: '' });
    eventBus.emit(EventType.MIDI_LEARN_COMPLETED, {});

    const btn = document.querySelector('.midi-learn-btn') as HTMLButtonElement;
    expect(btn.classList.contains('active')).toBe(false);
    expect(btn.textContent).toBe('MIDI Learn');
  });

  it('MIDI Learn button resets on MIDI_LEARN_CANCELLED', () => {
    eventBus.emit(EventType.MIDI_LEARN_STARTED, { componentId: '', parameterName: '' });
    eventBus.emit(EventType.MIDI_LEARN_CANCELLED, {});

    const btn = document.querySelector('.midi-learn-btn') as HTMLButtonElement;
    expect(btn.classList.contains('active')).toBe(false);
    expect(btn.textContent).toBe('MIDI Learn');
  });

  // -------------------------------------------------------------------------
  // destroy()
  // -------------------------------------------------------------------------

  it('destroy() does not throw', () => {
    expect(() => toolbar.destroy()).not.toThrow();
  });

  it('after destroy() event subscriptions are removed (no side effects)', () => {
    toolbar.destroy();
    // Emitting events should not cause errors after destroy
    expect(() => {
      eventBus.emit(EventType.MIDI_DEVICE_CONNECTED, { deviceName: 'X' });
      eventBus.emit(EventType.MIDI_LEARN_STARTED, { componentId: '', parameterName: '' });
    }).not.toThrow();
  });
});
