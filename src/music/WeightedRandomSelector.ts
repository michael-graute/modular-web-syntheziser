/**
 * WeightedRandomSelector - Weighted random selection utility
 * Implements linear scan weighted random distribution for scale degree assignment
 * Provides 2x weighting for tonic (index 0) and fifth (index 4)
 */

/**
 * Select a random item from an array using weighted distribution
 * @param items - Array of items to select from
 * @param weights - Array of weights (same length as items)
 * @returns Randomly selected item based on weights
 */
export function weightedRandom<T>(items: T[], weights: number[]): T {
  if (items.length === 0) {
    throw new Error('Cannot select from empty array');
  }

  if (items.length !== weights.length) {
    throw new Error('Items and weights arrays must have same length');
  }

  // Calculate total weight
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    throw new Error('Total weight must be positive');
  }

  // Generate random value in range [0, totalWeight)
  let random = Math.random() * totalWeight;

  // Linear scan to find selected item
  for (let i = 0; i < items.length; i++) {
    random -= weights[i] as number;
    if (random <= 0) {
      return items[i] as T;
    }
  }

  // Fallback to last item (should never reach due to floating point precision)
  return items[items.length - 1] as T;
}

/**
 * Select a random scale degree with weighted distribution
 * Tonic (index 0) and fifth (index 4) have 2x weight
 *
 * @param scaleLength - Number of notes in the scale
 * @returns Random scale degree index (0-based)
 */
export function selectWeightedScaleDegree(scaleLength: number): number {
  if (scaleLength < 1) {
    throw new Error('Scale length must be at least 1');
  }

  // Create array of scale degree indices
  const degrees: number[] = [];
  const weights: number[] = [];

  for (let i = 0; i < scaleLength; i++) {
    degrees.push(i);
    // 2x weight for tonic (0) and fifth (4)
    weights.push(i === 0 || i === 4 ? 2 : 1);
  }

  return weightedRandom(degrees, weights);
}

/**
 * Assign scale degrees to multiple colliders using weighted random distribution
 * @param count - Number of colliders to assign notes to
 * @param scaleLength - Number of notes in the scale
 * @returns Array of scale degree indices
 */
export function assignScaleDegrees(count: number, scaleLength: number): number[] {
  const assignments: number[] = [];

  for (let i = 0; i < count; i++) {
    assignments.push(selectWeightedScaleDegree(scaleLength));
  }

  return assignments;
}

/**
 * Calculate expected frequency of each scale degree given weights
 * Useful for testing and validation
 *
 * @param scaleLength - Number of notes in the scale
 * @returns Array of expected probabilities for each degree
 */
export function calculateExpectedProbabilities(scaleLength: number): number[] {
  const weights: number[] = [];
  for (let i = 0; i < scaleLength; i++) {
    weights.push(i === 0 || i === 4 ? 2 : 1);
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  return weights.map(w => w / totalWeight);
}

/**
 * WeightedRandomSelector class for stateful weighted selection
 * Maintains selection history and statistics
 */
export class WeightedRandomSelector {
  private selectionHistory: number[] = [];

  constructor(
    private items: any[],
    private weights: number[]
  ) {
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have same length');
    }

    if (weights.some(w => w < 0)) {
      throw new Error('Weights must be non-negative');
    }
  }

  /**
   * Select next item using weighted random distribution
   * @returns Selected item
   */
  select(): any {
    const selectedIndex = this.selectIndex();
    this.selectionHistory.push(selectedIndex);
    return this.items[selectedIndex];
  }

  /**
   * Select next index using weighted random distribution
   * @returns Selected index
   */
  selectIndex(): number {
    const indices = this.items.map((_, i) => i);
    return weightedRandom(indices, this.weights);
  }

  /**
   * Get selection history
   * @returns Array of selected indices
   */
  getHistory(): readonly number[] {
    return Object.freeze([...this.selectionHistory]);
  }

  /**
   * Get selection frequency statistics
   * @returns Map of index to selection count
   */
  getStatistics(): Map<number, number> {
    const stats = new Map<number, number>();

    for (let i = 0; i < this.items.length; i++) {
      stats.set(i, 0);
    }

    for (const index of this.selectionHistory) {
      stats.set(index, (stats.get(index) || 0) + 1);
    }

    return stats;
  }

  /**
   * Reset selection history
   */
  reset(): void {
    this.selectionHistory = [];
  }

  /**
   * Get total number of selections made
   * @returns Selection count
   */
  get selectionCount(): number {
    return this.selectionHistory.length;
  }
}
