/**
 * ICVOutput - Audio CV/Gate output interface
 *
 * Handles CV (Control Voltage) and Gate signal generation using Web Audio API.
 * Implements 1V/octave CV standard with timed gate envelopes for collision events.
 *
 * Implementation notes:
 * - Uses ConstantSourceNode for DC offset CV signals
 * - Exponential ramps prevent audio clicks on CV changes
 * - Gate envelope: 0V → 5V → 0V (attack-hold-release)
 * - Sample-accurate scheduling via AudioContext.currentTime
 * - CV range: -5V to +5V (10 octave Eurorack standard)
 *
 * @see research.md section 5 for Web Audio implementation details
 * @see data-model.md for GateOutput type
 */

/**
 * CV/Gate output interface for audio signal generation
 */
export interface ICVOutput {
  /**
   * Trigger a note with CV and gate timing
   *
   * Schedules sample-accurate CV and gate signals for a collision event.
   * CV changes use exponential ramps to prevent clicks.
   * Gate uses linear attack/release for clean envelope.
   *
   * @param frequency - Note frequency in Hz (for reference/debugging)
   * @param cvVoltage - CV voltage in volts (1V/octave, range: -5V to +5V)
   * @param duration - Gate duration in milliseconds
   *
   * @example
   * ```typescript
   * // Trigger middle C (261.63 Hz) with 500ms gate
   * cvOutput.triggerNote(261.63, 0, 500);
   *
   * // Trigger G4 (392 Hz, +0.583V) with 250ms gate
   * cvOutput.triggerNote(392, 0.583, 250);
   * ```
   */
  triggerNote(frequency: number, cvVoltage: number, duration: number): void;

  /**
   * Stop all active gates immediately
   *
   * Cancels any scheduled gate envelopes and resets CV to 0V.
   * Used when simulation is stopped or reset.
   *
   * @example
   * ```typescript
   * // Stop simulation
   * cvOutput.stopAll();
   * console.log('All gates stopped');
   * ```
   */
  stopAll(): void;

  /**
   * Check if CV output is currently active
   *
   * @returns true if audio nodes are connected and running
   *
   * @example
   * ```typescript
   * if (cvOutput.isActive()) {
   *   console.log('CV output is running');
   * } else {
   *   console.log('CV output is stopped');
   * }
   * ```
   */
  isActive(): boolean;

  /**
   * Get CV output AudioNode
   *
   * Returns the ConstantSourceNode for CV signal.
   * Can be connected to AudioParams or other audio destinations.
   *
   * @returns CV output node (ConstantSourceNode.offset)
   *
   * @example
   * ```typescript
   * const cvNode = cvOutput.getCVNode();
   * cvNode.connect(oscillator.frequency); // Modulate oscillator pitch
   * ```
   */
  getCVNode(): AudioNode;

  /**
   * Get Gate output AudioNode
   *
   * Returns the ConstantSourceNode for gate signal.
   * Can be connected to gain nodes or envelope followers.
   *
   * @returns Gate output node (ConstantSourceNode.offset)
   *
   * @example
   * ```typescript
   * const gateNode = cvOutput.getGateNode();
   * gateNode.connect(vca.gain); // Trigger VCA with gate
   * ```
   */
  getGateNode(): AudioNode;

  /**
   * Initialize audio nodes
   *
   * Creates and starts ConstantSourceNodes for CV and Gate.
   * Must be called before triggering notes.
   *
   * @param audioContext - Web Audio API context
   *
   * @example
   * ```typescript
   * const ctx = new AudioContext();
   * cvOutput.initialize(ctx);
   * // Now ready to trigger notes
   * ```
   */
  initialize(audioContext: AudioContext): void;

  /**
   * Cleanup audio nodes
   *
   * Stops and disconnects all audio nodes.
   * Call when component is destroyed or simulation ends.
   *
   * @example
   * ```typescript
   * // Component cleanup
   * cvOutput.cleanup();
   * console.log('CV output cleaned up');
   * ```
   */
  cleanup(): void;

  /**
   * Get current CV voltage
   *
   * @returns Current CV value in volts
   *
   * @example
   * ```typescript
   * const cv = cvOutput.getCurrentCV();
   * console.log(`Current CV: ${cv.toFixed(3)}V`);
   * ```
   */
  getCurrentCV(): number;

  /**
   * Get current gate state
   *
   * @returns true if gate is currently high (>0V)
   *
   * @example
   * ```typescript
   * if (cvOutput.isGateHigh()) {
   *   console.log('Gate active');
   * }
   * ```
   */
  isGateHigh(): boolean;

  /**
   * Set CV attack/release time
   *
   * Configures the ramp time for CV changes to prevent clicks.
   * Default: 1ms (below perception threshold).
   *
   * @param timeMs - Ramp time in milliseconds (0.5-10ms recommended)
   *
   * @example
   * ```typescript
   * cvOutput.setCVRampTime(0.5); // Very fast (may click)
   * cvOutput.setCVRampTime(2.0);  // Smooth (recommended)
   * ```
   */
  setCVRampTime(timeMs: number): void;

  /**
   * Set gate attack time
   *
   * Configures gate envelope attack time.
   * Default: 1ms.
   *
   * @param timeMs - Attack time in milliseconds
   *
   * @example
   * ```typescript
   * cvOutput.setGateAttackTime(0.5); // Instant
   * cvOutput.setGateAttackTime(5.0);  // Smooth fade-in
   * ```
   */
  setGateAttackTime(timeMs: number): void;

  /**
   * Set gate release time
   *
   * Configures gate envelope release time.
   * Default: 5ms.
   *
   * @param timeMs - Release time in milliseconds
   *
   * @example
   * ```typescript
   * cvOutput.setGateReleaseTime(10); // Longer tail
   * ```
   */
  setGateReleaseTime(timeMs: number): void;
}
