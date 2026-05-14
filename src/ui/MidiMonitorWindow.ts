import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';
import type { MidiRawMessagePayload } from '../core/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LOG_ENTRIES = 500;

const MIDI_TYPE_LABELS: Record<number, string> = {
  0x80: 'Note Off',
  0x90: 'Note On',
  0xa0: 'Aftertouch (Poly)',
  0xb0: 'Control Change',
  0xc0: 'Program Change',
  0xd0: 'Aftertouch (Ch)',
  0xe0: 'Pitch Bend',
  0xf0: 'SysEx',
  0xf2: 'Song Position',
  0xf3: 'Song Select',
  0xf8: 'Clock',
  0xfa: 'Start',
  0xfb: 'Continue',
  0xfc: 'Stop',
  0xff: 'Reset',
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// ---------------------------------------------------------------------------
// Pure formatting helpers (inline from contracts/validation.ts)
// ---------------------------------------------------------------------------

export function midiNoteToName(note: number): string {
  const name = NOTE_NAMES[note % 12]!;
  const octave = Math.floor(note / 12) - 1;
  return `${name}${octave} (${note})`;
}

export function formatWallClock(date: Date): string {
  const hms = date.toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hms}.${ms}`;
}

export function parseMidiType(status: number): string {
  if (status >= 0xf0) {
    return MIDI_TYPE_LABELS[status] ?? 'Unknown';
  }
  const nibble = status & 0xf0;
  return MIDI_TYPE_LABELS[nibble] ?? 'Unknown';
}

export function parseMidiChannel(status: number): string {
  if (status >= 0xf0) return '—';
  return String((status & 0x0f) + 1);
}

export function formatData1(status: number, byte1: number): string {
  const nibble = status & 0xf0;
  if (nibble === 0x80 || nibble === 0x90) {
    return midiNoteToName(byte1);
  }
  if (nibble === 0xb0) {
    return `CC ${byte1}`;
  }
  if (status >= 0xf0) return '';
  return String(byte1);
}

export function formatData2(status: number, byte2: number): string {
  if (status >= 0xf0) return '';
  const nibble = status & 0xf0;
  if (nibble === 0xc0 || nibble === 0xd0) return '';
  return String(byte2);
}

export function formatMidiLogEntry(payload: MidiRawMessagePayload): {
  wallTime: string;
  type: string;
  channel: string;
  data1: string;
  data2: string;
} {
  const { status, byte1, byte2 } = payload;
  return {
    wallTime: formatWallClock(new Date()),
    type: parseMidiType(status),
    channel: parseMidiChannel(status),
    data1: formatData1(status, byte1),
    data2: formatData2(status, byte2),
  };
}

// ---------------------------------------------------------------------------
// MidiMonitorWindow
// ---------------------------------------------------------------------------

export class MidiMonitorWindow {
  private window: HTMLElement | null = null;
  private logContainer: HTMLElement | null = null;
  private entries: MidiRawMessagePayload[] = [];
  private unsubscribe: (() => void) | null = null;
  private autoScroll = true;

  isOpen = false;

  open(): void {
    if (this.isOpen) {
      this.window?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      this.window?.focus();
      return;
    }

    if (!this.window) {
      this.buildDom();
    }

    this.window!.style.display = 'flex';
    this.isOpen = true;

    this.unsubscribe = eventBus.on(EventType.MIDI_MESSAGE_RECEIVED, (payload) => {
      this.appendEntry(payload as MidiRawMessagePayload);
    });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.window!.style.display = 'none';
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDom(): void {
    const win = document.createElement('div');
    win.className = 'midi-monitor-window';
    win.style.display = 'none';

    // Title bar
    const header = document.createElement('div');
    header.className = 'midi-monitor-window__header';
    header.textContent = 'MIDI Monitor';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'midi-monitor-window__close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close MIDI Monitor');
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    // Log area
    const log = document.createElement('div');
    log.className = 'midi-monitor-window__log';
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');

    // Footer
    const footer = document.createElement('div');
    footer.className = 'midi-monitor-window__footer';
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear Log';
    clearBtn.addEventListener('click', () => this.clearLog());
    footer.appendChild(clearBtn);

    win.appendChild(header);
    win.appendChild(log);
    win.appendChild(footer);
    document.body.appendChild(win);

    this.window = win;
    this.logContainer = log;

    this.setupDrag(header, win);
    this.setupAutoScrollDetection(log);
    this.setupKeyboardClose(win);
  }

  // ---------------------------------------------------------------------------
  // Drag (T005)
  // ---------------------------------------------------------------------------

  private setupDrag(handle: HTMLElement, win: HTMLElement): void {
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      handle.setPointerCapture(e.pointerId);
      const rect = win.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    handle.addEventListener('pointermove', (e: PointerEvent) => {
      if (!handle.hasPointerCapture(e.pointerId)) return;
      win.style.left = `${e.clientX - offsetX}px`;
      win.style.top = `${e.clientY - offsetY}px`;
    });

    handle.addEventListener('pointerup', (e: PointerEvent) => {
      handle.releasePointerCapture(e.pointerId);
    });
  }

  // ---------------------------------------------------------------------------
  // Auto-scroll detection (T012)
  // ---------------------------------------------------------------------------

  private setupAutoScrollDetection(log: HTMLElement): void {
    log.addEventListener('scroll', () => {
      const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 2;
      this.autoScroll = atBottom;
    });
  }

  // ---------------------------------------------------------------------------
  // Keyboard close (T023 — added here for completeness in Phase 3)
  // ---------------------------------------------------------------------------

  private setupKeyboardClose(win: HTMLElement): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
    // Make window focusable
    win.setAttribute('tabindex', '-1');
  }

  // ---------------------------------------------------------------------------
  // Log management (T010, T014)
  // ---------------------------------------------------------------------------

  appendEntry(payload: MidiRawMessagePayload): void {
    if (!this.logContainer) return;

    const entry = formatMidiLogEntry(payload);

    if (this.entries.length >= MAX_LOG_ENTRIES) {
      this.logContainer.firstChild && this.logContainer.removeChild(this.logContainer.firstChild);
      this.entries.shift();
    }

    this.entries.push(payload);

    const row = document.createElement('div');
    row.className = 'midi-monitor-entry';

    const cols = [entry.wallTime, entry.type, entry.channel, entry.data1, entry.data2];
    for (const col of cols) {
      const cell = document.createElement('span');
      cell.textContent = col;
      row.appendChild(cell);
    }

    this.logContainer.appendChild(row);

    if (this.autoScroll) {
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
  }

  clearLog(): void {
    this.entries = [];
    if (this.logContainer) {
      this.logContainer.innerHTML = '';
    }
    this.autoScroll = true;
  }
}
