/**
 * HelpSidebar - Resizable sidebar for displaying help and user manual
 */

/**
 * Sidebar for displaying help documentation
 */
export class HelpSidebar {
  private container: HTMLDivElement;
  private resizeHandle: HTMLDivElement;
  private navContainer: HTMLDivElement;
  private contentContainer: HTMLDivElement;
  private closeButton: HTMLButtonElement;
  private currentSection: string;
  private isVisible: boolean;
  private isResizing: boolean;
  private startX: number;
  private startWidth: number;

  constructor() {
    this.currentSection = 'quickstart';
    this.isVisible = false;
    this.isResizing = false;
    this.startX = 0;
    this.startWidth = 0;

    this.container = this.createContainer();
    this.resizeHandle = this.createResizeHandle();
    this.navContainer = this.createNavigation();
    this.contentContainer = this.createContentArea();
    this.closeButton = this.createCloseButton();

    this.setupStructure();
    this.setupEventListeners();
  }

  /**
   * Create main container
   */
  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'help-sidebar';
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: -600px;
      width: 600px;
      height: 100vh;
      background: var(--bg-primary, #2a2a2a);
      border-left: 1px solid var(--border-color, #444);
      display: flex;
      flex-direction: column;
      z-index: 9999;
      transition: right 0.3s ease;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    `;
    return container;
  }

  /**
   * Create resize handle
   */
  private createResizeHandle(): HTMLDivElement {
    const handle = document.createElement('div');
    handle.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 5px;
      height: 100%;
      cursor: ew-resize;
      background: transparent;
      z-index: 10;
    `;

    handle.addEventListener('mouseenter', () => {
      handle.style.background = 'var(--accent-color, #0066cc)';
    });

    handle.addEventListener('mouseleave', () => {
      if (!this.isResizing) {
        handle.style.background = 'transparent';
      }
    });

    return handle;
  }

  /**
   * Create close button
   */
  private createCloseButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.innerHTML = '&times;';
    button.setAttribute('aria-label', 'Close');
    button.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      color: var(--text-secondary, #aaa);
      font-size: 2rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
      z-index: 11;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = 'var(--bg-hover, #3a3a3a)';
      button.style.color = 'var(--text-primary, #ffffff)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'none';
      button.style.color = 'var(--text-secondary, #aaa)';
    });

    button.addEventListener('click', () => this.close());

    return button;
  }

  /**
   * Setup sidebar structure
   */
  private setupStructure(): void {
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid var(--border-color, #444);
      flex-shrink: 0;
      position: relative;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Help & User Manual';
    title.style.cssText = `
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary, #ffffff);
    `;

    header.appendChild(title);
    header.appendChild(this.closeButton);

    // Create body with navigation and content
    const body = document.createElement('div');
    body.style.cssText = `
      display: flex;
      flex: 1;
      overflow: hidden;
    `;

    body.appendChild(this.navContainer);
    body.appendChild(this.contentContainer);

    // Assemble
    this.container.appendChild(this.resizeHandle);
    this.container.appendChild(header);
    this.container.appendChild(body);

    // Add to DOM
    document.body.appendChild(this.container);
  }

  /**
   * Create navigation sidebar
   */
  private createNavigation(): HTMLDivElement {
    const nav = document.createElement('div');
    nav.style.cssText = `
      width: 200px;
      background: var(--bg-secondary, #1a1a1a);
      border-right: 1px solid var(--border-color, #444);
      padding: 20px;
      overflow-y: auto;
      flex-shrink: 0;
    `;

    const sections = [
      { id: 'quickstart', label: 'Quickstart' },
      { id: 'interface', label: 'Interface' },
      { id: 'components', label: 'Components' },
      { id: 'connections', label: 'Connections' },
      { id: 'keyboard', label: 'Keyboard' },
      { id: 'patches', label: 'Patches' },
      { id: 'shortcuts', label: 'Shortcuts' },
      { id: 'tips', label: 'Tips & Tricks' },
    ];

    sections.forEach(section => {
      const button = document.createElement('button');
      button.textContent = section.label;
      button.dataset.section = section.id;
      button.style.cssText = `
        display: block;
        width: 100%;
        text-align: left;
        padding: 10px;
        margin-bottom: 5px;
        background: ${this.currentSection === section.id ? 'var(--accent-color, #0066cc)' : 'transparent'};
        border: none;
        border-radius: 4px;
        color: var(--text-primary, #ffffff);
        cursor: pointer;
        font-size: 0.875rem;
        transition: background 0.2s;
      `;

      button.addEventListener('click', () => {
        this.currentSection = section.id;
        this.updateContent();
      });

      button.addEventListener('mouseenter', () => {
        if (this.currentSection !== section.id) {
          button.style.background = 'var(--bg-hover, #2a2a2a)';
        }
      });

      button.addEventListener('mouseleave', () => {
        if (this.currentSection !== section.id) {
          button.style.background = 'transparent';
        }
      });

      nav.appendChild(button);
    });

    return nav;
  }

  /**
   * Create content area
   */
  private createContentArea(): HTMLDivElement {
    const content = document.createElement('div');
    content.id = 'help-sidebar-content';
    content.style.cssText = `
      flex: 1;
      padding: 20px 30px;
      overflow-y: auto;
      line-height: 1.6;
    `;

    // Add initial content
    content.innerHTML = this.getContentForSection(this.currentSection);

    return content;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Resize functionality
    this.resizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      this.startX = e.clientX;
      this.startWidth = this.container.offsetWidth;
      this.resizeHandle.style.background = 'var(--accent-color, #0066cc)';
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;

      const deltaX = this.startX - e.clientX;
      const newWidth = Math.min(Math.max(400, this.startWidth + deltaX), window.innerWidth - 100);

      this.container.style.width = `${newWidth}px`;
      if (this.isVisible) {
        this.container.style.right = '0';
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        this.resizeHandle.style.background = 'transparent';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.close();
      }
    });
  }

  /**
   * Update content when section changes
   */
  private updateContent(): void {
    this.contentContainer.innerHTML = this.getContentForSection(this.currentSection);

    // Update navigation button states
    const buttons = this.navContainer.querySelectorAll('button');
    buttons.forEach((button) => {
      const section = (button as HTMLElement).dataset.section;
      if (section === this.currentSection) {
        (button as HTMLElement).style.background = 'var(--accent-color, #0066cc)';
      } else {
        (button as HTMLElement).style.background = 'transparent';
      }
    });
  }

  /**
   * Open the sidebar
   */
  open(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    this.container.style.right = '0';
  }

  /**
   * Close the sidebar
   */
  close(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.container.style.right = `-${this.container.offsetWidth}px`;
  }

  /**
   * Toggle sidebar visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Get content HTML for a specific section
   */
  private getContentForSection(section: string): string {
    switch (section) {
      case 'quickstart':
        return this.getQuickstartContent();
      case 'interface':
        return this.getInterfaceContent();
      case 'components':
        return this.getComponentsContent();
      case 'connections':
        return this.getConnectionsContent();
      case 'keyboard':
        return this.getKeyboardContent();
      case 'patches':
        return this.getPatchesContent();
      case 'shortcuts':
        return this.getShortcutsContent();
      case 'tips':
        return this.getTipsContent();
      default:
        return '<h2>Section not found</h2>';
    }
  }

  /**
   * Quickstart section content
   */
  private getQuickstartContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Quickstart Guide</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Getting Started in 5 Minutes</h3>

      <ol style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Enable Audio:</strong>
          Click anywhere on the page to activate the audio context.
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Load a Factory Preset:</strong>
          Click on "Load" in the Top Menu, then select "Factory" and load a preset by clicking it.
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">OR:</strong>
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Add Components:</strong>
          Drag components from the left sidebar onto the canvas (e.g., Keyboard, Oscillator, Filter, Master Output).
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Make Connections:</strong>
          Click on an output port (right side, circle) and then click on an input port (left side, circle) to create a connection.
          <ul style="margin-top: 8px;">
            <li>Green cables = Audio signals</li>
            <li>Blue cables = CV (Control Voltage) signals</li>
            <li>Red cables = Gate signals</li>
          </ul>
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Adjust Parameters:</strong>
          Click and drag knobs or sliders to change values. Click dropdowns to select options.
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Play:</strong>
          Use the keyboard at the bottom to play notes, or use your computer keyboard (A-L keys for white keys, W-O for black keys).
        </li>
      </ol>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Basic Patch Example</h4>
        <p style="color: var(--text-secondary, #cccccc); margin-bottom: 8px;">Try this simple setup:</p>
        <ol style="color: var(--text-secondary, #cccccc); margin: 0;">
          <li>Add: Keyboard → Oscillator → ADSR → VCA → Master Output</li>
          <li>Connect: Keyboard Frequency → Oscillator Frequency CV</li>
          <li>Connect: Keyboard Gate → ADSR Gate In</li>
          <li>Connect: ADSR CV Out → VCA CV In/li>
          <li>Connect Oscillator Audio Out → VCA Audio In</li>
          <li>Connect: VCA Audio Out → Master Output Audio In</li>
          <li>Play notes on the keyboard!</li>
        </ol>
      </div>
    `;
  }

  /**
   * Interface section content
   */
  private getInterfaceContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Interface Overview</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Top Bar</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong style="color: var(--text-primary, #ffffff);">Patch Name:</strong> Shows and edits the current patch name</li>
        <li><strong style="color: var(--text-primary, #ffffff);">New:</strong> Clear the canvas and start a new patch</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Save:</strong> Save the current patch to browser storage</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Load:</strong> Load a previously saved patch</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Export:</strong> Export patch as JSON file</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Import:</strong> Import a patch from JSON file</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Help:</strong> Open this help dialog</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Component Library (Left Sidebar)</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        Browse and drag components onto the canvas. Components are organized into categories:
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong style="color: var(--text-primary, #ffffff);">Generators:</strong> Oscillators, LFOs, Noise</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Processors:</strong> Filters, VCA, Envelopes</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Effects:</strong> Delay, Reverb, Distortion, Chorus</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Utilities:</strong> Keyboard, Mixer, Sequencer</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Analyzers:</strong> Oscilloscope</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Canvas Area</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        The main workspace where you build your synthesizer patches:
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>Drag the background to pan around</li>
        <li>Scroll wheel to zoom in/out</li>
        <li>Grid helps align components (toggle with ~ key)</li>
        <li>Bottom right shows zoom level, pan position, and snap status</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Keyboard Section</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        Interactive piano keyboard for playing notes:
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>Click keys with mouse</li>
        <li>Use computer keyboard keys</li>
        <li>Octave +/- buttons to change octave</li>
        <li>Panic button to stop all notes</li>
      </ul>
    `;
  }

  /**
   * Components section content
   */
  private getComponentsContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Component Reference</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Generators</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Oscillator</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Generates audio waveforms at a specified frequency.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Waveform:</strong> Sine, Square, Sawtooth, Triangle</li>
        <li><strong>Frequency:</strong> Base frequency (Hz)</li>
        <li><strong>Detune:</strong> Fine tuning in cents</li>
        <li><strong>Inputs:</strong> Frequency CV, Detune CV, Gate</li>
        <li><strong>Output:</strong> Audio signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">LFO (Low Frequency Oscillator)</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Generates slow modulation signals for controlling other parameters.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Waveform:</strong> Sine, Square, Sawtooth, Triangle</li>
        <li><strong>Rate:</strong> Oscillation speed (Hz)</li>
        <li><strong>Depth:</strong> Modulation amount</li>
        <li><strong>Output:</strong> CV signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Noise Generator</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Generates random noise signals.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Type:</strong> White, Pink</li>
        <li><strong>Amplitude:</strong> Output level</li>
        <li><strong>Output:</strong> Audio signal</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Processors</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Filter</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Shapes the frequency content of audio signals.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Type:</strong> Lowpass, Highpass, Bandpass, Notch</li>
        <li><strong>Cutoff:</strong> Filter frequency (Hz)</li>
        <li><strong>Resonance:</strong> Emphasis at cutoff frequency</li>
        <li><strong>Inputs:</strong> Audio in, Cutoff CV, Resonance CV</li>
        <li><strong>Output:</strong> Filtered audio signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">VCA (Voltage Controlled Amplifier)</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Controls the volume/amplitude of audio signals.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Gain:</strong> Output level (0-1)</li>
        <li><strong>Inputs:</strong> Audio in, CV (for envelopes)</li>
        <li><strong>Output:</strong> Amplified audio signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">ADSR Envelope</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Generates envelope curves for shaping sound over time.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Attack:</strong> Rise time (0-2s)</li>
        <li><strong>Decay:</strong> Fall time to sustain (0-2s)</li>
        <li><strong>Sustain:</strong> Hold level (0-1)</li>
        <li><strong>Release:</strong> Fall time after note off (0-5s)</li>
        <li><strong>Input:</strong> Gate trigger</li>
        <li><strong>Output:</strong> CV envelope signal</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Effects</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Delay</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Creates echo effects by repeating the input signal.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Time:</strong> Delay time (ms)</li>
        <li><strong>Feedback:</strong> Number of repeats</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Reverb</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Simulates acoustic space and reflections.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Room Size:</strong> Space dimensions</li>
        <li><strong>Decay:</strong> Tail length</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Distortion</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Adds harmonic saturation and grit.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Drive:</strong> Amount of distortion</li>
        <li><strong>Tone:</strong> Frequency shaping</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Chorus</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Creates thickness by detuning copies of the signal.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Rate:</strong> Modulation speed</li>
        <li><strong>Depth:</strong> Modulation amount</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Utilities</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Keyboard Input</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Receives note input from the on-screen or computer keyboard.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Outputs:</strong> Frequency CV, Gate, Velocity CV</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Mixer</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Combines multiple audio signals with individual level control.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Channels:</strong> 4 input channels</li>
        <li><strong>Gain 1-4:</strong> Individual channel levels</li>
        <li><strong>Master:</strong> Overall output level</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Step Sequencer</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Creates rhythmic patterns and sequences.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>BPM:</strong> Tempo</li>
        <li><strong>Note Value:</strong> Step duration</li>
        <li><strong>16 Steps:</strong> Click to enable/disable</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Master Output</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Final output to speakers/headphones. Required for hearing audio.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Volume:</strong> Master level</li>
        <li><strong>Limiter:</strong> Prevents clipping</li>
      </ul>
    `;
  }

  /**
   * Connections section content
   */
  private getConnectionsContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Working with Connections</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Creating Connections</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click on an <strong style="color: var(--text-primary, #ffffff);">output port</strong> (right side of a component)</li>
        <li>You'll see a cable following your cursor</li>
        <li>Click on an <strong style="color: var(--text-primary, #ffffff);">input port</strong> (left side of another component)</li>
        <li>The connection is created if the signal types match</li>
      </ol>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Signal Types</h3>
      <p style="color: var(--text-secondary, #cccccc);">Connections are color-coded by signal type:</p>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <div style="margin-bottom: 12px;">
          <span style="display: inline-block; width: 20px; height: 20px; background: #4CAF50; border-radius: 50%; vertical-align: middle; margin-right: 8px;"></span>
          <strong style="color: var(--text-primary, #ffffff);">Green - Audio:</strong>
          <span style="color: var(--text-secondary, #cccccc);"> Main audio signals (oscillators, filters, effects)</span>
        </div>

        <div style="margin-bottom: 12px;">
          <span style="display: inline-block; width: 20px; height: 20px; background: #2196F3; border-radius: 50%; vertical-align: middle; margin-right: 8px;"></span>
          <strong style="color: var(--text-primary, #ffffff);">Blue - CV (Control Voltage):</strong>
          <span style="color: var(--text-secondary, #cccccc);"> Modulation signals (LFOs, envelopes, frequency)</span>
        </div>

        <div>
          <span style="display: inline-block; width: 20px; height: 20px; background: #F44336; border-radius: 50%; vertical-align: middle; margin-right: 8px;"></span>
          <strong style="color: var(--text-primary, #ffffff);">Red - Gate:</strong>
          <span style="color: var(--text-secondary, #cccccc);"> Trigger signals (note on/off, sequencer triggers)</span>
        </div>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Deleting Connections</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>Hold <strong style="color: var(--text-primary, #ffffff);">Shift</strong> and click on a cable to delete it</li>
        <li>Deleting a component automatically removes all its connections</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Connection Rules</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>Signal types must match (e.g., audio to audio, CV to CV)</li>
        <li>One output can connect to multiple inputs</li>
        <li>Each input can only have one connection</li>
        <li>Cables curve to show signal flow direction</li>
      </ul>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid #FFC107; margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Tip</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          Hover over a cable to see it highlighted. This helps identify connections in complex patches.
        </p>
      </div>
    `;
  }

  /**
   * Keyboard section content
   */
  private getKeyboardContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Keyboard Control</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">On-Screen Piano</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        Click the piano keys at the bottom of the screen to play notes.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Computer Keyboard Layout</h3>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h4 style="color: var(--text-primary, #ffffff); margin-top: 0;">White Keys (Natural Notes)</h4>
        <p style="color: var(--text-secondary, #cccccc); font-family: monospace; font-size: 1.1em;">
          A  S  D  F  G  H  J  K  L  ;  '<br>
          C  D  E  F  G  A  B  C  D  E  F
        </p>

        <h4 style="color: var(--text-primary, #ffffff); margin-top: 16px;">Black Keys (Sharps/Flats)</h4>
        <p style="color: var(--text-secondary, #cccccc); font-family: monospace; font-size: 1.1em;">
          W  E     T  Y  U     O  P<br>
          C# D#    F# G# A#    C# D#
        </p>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Keyboard Controls</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong style="color: var(--text-primary, #ffffff);">Z key:</strong> Lower octave by 1</li>
        <li><strong style="color: var(--text-primary, #ffffff);">X key:</strong> Raise octave by 1</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Spacebar:</strong> Sustain pedal (hold notes)</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Octave -/+ buttons:</strong> Change octave range</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Panic button:</strong> Stop all playing notes immediately</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Setting Up Keyboard Control</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Add a <strong style="color: var(--text-primary, #ffffff);">Keyboard Input</strong> component to your patch</li>
        <li>Connect its outputs to control other components:
          <ul style="margin-top: 8px;">
            <li><strong>Frequency CV →</strong> Oscillator frequency CV (for pitch)</li>
            <li><strong>Gate →</strong> Oscillator gate or Envelope gate (for note on/off)</li>
            <li><strong>Velocity CV →</strong> VCA or envelope (for dynamics)</li>
          </ul>
        </li>
        <li>Now keyboard input will trigger your patch!</li>
      </ol>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Note</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          You can have multiple Keyboard Input components in one patch, each controlling different oscillators or voices.
        </p>
      </div>
    `;
  }

  /**
   * Patches section content
   */
  private getPatchesContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Managing Patches</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">What is a Patch?</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        A patch is a complete snapshot of your synthesizer setup, including:
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>All components and their positions</li>
        <li>All connections between components</li>
        <li>All parameter values (knobs, sliders, dropdowns)</li>
        <li>Canvas viewport (zoom, pan)</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Saving Patches</h3>

      <h4 style="color: var(--text-primary, #ffffff);">To Browser Storage</h4>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">Save</strong> button in the top bar</li>
        <li>Enter a name for your patch (or keep the existing name)</li>
        <li>Click Save</li>
      </ol>
      <p style="color: var(--text-secondary, #cccccc);">
        Patches are stored in your browser's localStorage and persist between sessions.
      </p>

      <h4 style="color: var(--text-primary, #ffffff);">To File (Export)</h4>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">Export</strong> button</li>
        <li>A JSON file will be downloaded to your computer</li>
        <li>Share this file with others or keep as backup</li>
      </ol>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Loading Patches</h3>

      <h4 style="color: var(--text-primary, #ffffff);">From Browser Storage</h4>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">Load</strong> button</li>
        <li>Select a patch from the list</li>
        <li>Click Load to restore it</li>
        <li>Delete unwanted patches with the trash icon</li>
      </ol>

      <h4 style="color: var(--text-primary, #ffffff);">From File (Import)</h4>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">Import</strong> button</li>
        <li>Select a .json patch file</li>
        <li>The patch will load immediately</li>
      </ol>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Creating New Patches</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">New</strong> button</li>
        <li>This clears the canvas for a fresh start</li>
        <li>Your previous work is not lost unless you save over it</li>
      </ol>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid #FFC107; margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Important</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          Patches are stored locally in your browser. Clearing browser data will delete saved patches.
          Use Export to create backup files of important patches.
        </p>
      </div>
    `;
  }

  /**
   * Shortcuts section content
   */
  private getShortcutsContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Keyboard Shortcuts</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Canvas Navigation</h3>
      <table style="width: 100%; border-collapse: collapse; color: var(--text-secondary, #cccccc);">
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Action</td>
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Shortcut</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Pan canvas</td>
          <td style="padding: 12px 0; font-family: monospace;">Click + Drag on empty space</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Zoom in/out</td>
          <td style="padding: 12px 0; font-family: monospace;">Mouse Wheel</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Toggle grid visibility</td>
          <td style="padding: 12px 0; font-family: monospace;">Shift + \` (~)</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Toggle snap to grid</td>
          <td style="padding: 12px 0; font-family: monospace;">\` (backtick)</td>
        </tr>
      </table>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Component Operations</h3>
      <table style="width: 100%; border-collapse: collapse; color: var(--text-secondary, #cccccc);">
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Action</td>
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Shortcut</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Select component</td>
          <td style="padding: 12px 0; font-family: monospace;">Click</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Multi-select</td>
          <td style="padding: 12px 0; font-family: monospace;">Ctrl/Cmd + Click</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Move component</td>
          <td style="padding: 12px 0; font-family: monospace;">Click + Drag</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Delete component</td>
          <td style="padding: 12px 0; font-family: monospace;">Delete or Backspace</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Add component</td>
          <td style="padding: 12px 0; font-family: monospace;">Drag from sidebar</td>
        </tr>
      </table>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Connection Operations</h3>
      <table style="width: 100%; border-collapse: collapse; color: var(--text-secondary, #cccccc);">
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Action</td>
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Shortcut</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Create connection</td>
          <td style="padding: 12px 0; font-family: monospace;">Click output → Click input</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Delete connection</td>
          <td style="padding: 12px 0; font-family: monospace;">Shift + Click cable</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Cancel connection</td>
          <td style="padding: 12px 0; font-family: monospace;">Click empty space</td>
        </tr>
      </table>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Keyboard/MIDI Input</h3>
      <table style="width: 100%; border-collapse: collapse; color: var(--text-secondary, #cccccc);">
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Action</td>
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Shortcut</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Play white keys</td>
          <td style="padding: 12px 0; font-family: monospace;">A S D F G H J K L ; '</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Play black keys</td>
          <td style="padding: 12px 0; font-family: monospace;">W E T Y U O P</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Octave down</td>
          <td style="padding: 12px 0; font-family: monospace;">Z</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Octave up</td>
          <td style="padding: 12px 0; font-family: monospace;">X</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Sustain pedal</td>
          <td style="padding: 12px 0; font-family: monospace;">Spacebar</td>
        </tr>
      </table>
    `;
  }

  /**
   * Tips section content
   */
  private getTipsContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Tips & Tricks</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Sound Design Tips</h3>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h4 style="color: var(--text-primary, #ffffff); margin-top: 0;">Classic Bass Synth</h4>
        <ul style="color: var(--text-secondary, #cccccc); margin: 0;">
          <li>Use a sawtooth or square wave oscillator</li>
          <li>Add a lowpass filter with medium resonance</li>
          <li>Use an ADSR envelope to control the filter cutoff</li>
          <li>Short attack, medium decay, low sustain, short release</li>
        </ul>
      </div>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h4 style="color: var(--text-primary, #ffffff); margin-top: 0;">Pad Sounds</h4>
        <ul style="color: var(--text-secondary, #cccccc); margin: 0;">
          <li>Layer multiple oscillators with slight detuning</li>
          <li>Use sine or triangle waves for smoothness</li>
          <li>Long attack and release times on envelope</li>
          <li>Add reverb and chorus for depth</li>
        </ul>
      </div>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h4 style="color: var(--text-primary, #ffffff); margin-top: 0;">Lead Sounds</h4>
        <ul style="color: var(--text-secondary, #cccccc); margin: 0;">
          <li>Start with a sawtooth wave</li>
          <li>Add filter with envelope for movement</li>
          <li>Use an LFO to modulate filter cutoff or oscillator pitch</li>
          <li>Add delay for space</li>
        </ul>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Workflow Tips</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Start Simple:</strong>
          Build your patch gradually, testing at each step
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Use the Grid:</strong>
          Enable snap-to-grid (backtick key) for organized layouts
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Color Code Cables:</strong>
          Remember: Green=Audio, Blue=CV, Red=Gate
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Save Often:</strong>
          Use Save frequently to avoid losing work
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Export Backups:</strong>
          Export important patches as JSON files
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Master Output Required:</strong>
          Always connect to Master Output to hear audio
        </li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Modulation Ideas</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Vibrato:</strong>
          Connect LFO (sine, slow rate) to oscillator frequency CV
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Tremolo:</strong>
          Connect LFO to VCA CV input
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Filter Sweep:</strong>
          Connect LFO to filter cutoff CV
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Auto-Pan:</strong>
          Use LFO to modulate separate VCAs for left/right
        </li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Performance Tips</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>
          <strong style="color: var(--text-primary, #ffffff);">CPU Usage:</strong>
          Each component uses processing power. Remove unused components.
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Feedback Loops:</strong>
          Avoid connecting outputs back to inputs in the same signal chain
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Panic Button:</strong>
          Use the Panic button if notes get stuck
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Volume Control:</strong>
          Keep Master Output volume reasonable to avoid distortion
        </li>
      </ul>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Pro Tip</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          Experiment! The best way to learn synthesis is by trying different combinations of components and connections.
          There are no wrong answers in sound design.
        </p>
      </div>
    `;
  }
}
