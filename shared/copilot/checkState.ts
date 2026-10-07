/** Same-day draft keys survive a rebuilt brief. Cancellation memory does not survive a new world. */

const raised = new Set<string>();
const issued = new Set<string>();

export function cancellationRaised(code: string): boolean {
  return raised.has(code);
}

export function markCancellation(code: string): void {
  raised.add(code);
}

export function resetCancellations(): void {
  raised.clear();
}

export function draftsAlreadyIssued(key: string): boolean {
  return issued.has(key);
}

export function markDraftsIssued(key: string): void {
  issued.add(key);
}
