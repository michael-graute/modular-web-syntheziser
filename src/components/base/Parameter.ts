/**
 * Parameter - Component parameter with value constraints
 */

/**
 * Parameter class for synth component parameters
 */
export class Parameter {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;

  // Modulation visualization properties
  isModulated: boolean = false;
  modulatedValue: number = 0;
  baseValue: number = 0;

  constructor(
    id: string,
    name: string,
    defaultValue: number,
    min: number,
    max: number,
    step: number = 0.01,
    unit: string = ''
  ) {
    this.id = id;
    this.name = name;
    this.defaultValue = defaultValue;
    this.value = defaultValue;
    this.min = min;
    this.max = max;
    this.step = step;
    this.unit = unit;

    // Initialize modulation properties
    this.baseValue = defaultValue;
    this.modulatedValue = defaultValue;
  }

  /**
   * Set parameter value with clamping
   */
  setValue(value: number): void {
    this.value = this.clamp(value);
    // Update base value when user manually adjusts parameter
    if (!this.isModulated) {
      this.baseValue = this.value;
    }
  }

  /**
   * Get current parameter value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Get normalized value (0-1)
   */
  getNormalizedValue(): number {
    if (this.max === this.min) {
      return 0;
    }
    return (this.value - this.min) / (this.max - this.min);
  }

  /**
   * Get modulated value (returns modulatedValue if modulated, otherwise value)
   */
  getModulatedValue(): number {
    return this.isModulated ? this.modulatedValue : this.value;
  }

  /**
   * Set modulated value (called by visualization system)
   */
  setModulatedValue(value: number): void {
    this.modulatedValue = this.clamp(value);
  }

  /**
   * Set value from normalized (0-1)
   */
  setNormalizedValue(normalized: number): void {
    const clamped = Math.max(0, Math.min(1, normalized));
    this.value = this.min + clamped * (this.max - this.min);
  }

  /**
   * Reset to default value
   */
  reset(): void {
    this.value = this.defaultValue;
  }

  /**
   * Clamp value to min/max range
   */
  private clamp(value: number): number {
    return Math.max(this.min, Math.min(this.max, value));
  }

  /**
   * Get display value with unit
   */
  getDisplayValue(): string {
    const rounded = Math.round(this.value / this.step) * this.step;
    return `${rounded.toFixed(2)}${this.unit}`;
  }

  /**
   * Increment value by step
   */
  increment(): void {
    this.setValue(this.value + this.step);
  }

  /**
   * Decrement value by step
   */
  decrement(): void {
    this.setValue(this.value - this.step);
  }

  /**
   * Check if value is at minimum
   */
  isAtMin(): boolean {
    return this.value === this.min;
  }

  /**
   * Check if value is at maximum
   */
  isAtMax(): boolean {
    return this.value === this.max;
  }

  /**
   * Serialize parameter data
   */
  serialize(): {
    id: string;
    name: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
  } {
    return {
      id: this.id,
      name: this.name,
      value: this.value,
      min: this.min,
      max: this.max,
      step: this.step,
      unit: this.unit,
    };
  }

  /**
   * Deserialize parameter data
   */
  static deserialize(data: {
    id: string;
    name: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
  }): Parameter {
    const param = new Parameter(
      data.id,
      data.name,
      data.value,
      data.min,
      data.max,
      data.step,
      data.unit
    );
    param.setValue(data.value);
    return param;
  }
}
