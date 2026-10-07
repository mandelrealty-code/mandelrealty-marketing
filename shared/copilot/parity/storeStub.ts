/**
 * Parity stand-in for copilot_check_state.
 * A new world clears cancellations. Issued draft keys stay for the rest of the run.
 */

const raised = new Set<string>();
const issued = new Set<string>();

export function parityCancellationRaised(code: string): boolean {
  return raised.has(code);
}

export function parityMarkCancellation(code: string): void {
  raised.add(code);
}

export function resetParityCancellations(): void {
  raised.clear();
}

export function parityDraftsIssued(key: string): boolean {
  return issued.has(key);
}

export function parityMarkDrafts(key: string): void {
  issued.add(key);
}
