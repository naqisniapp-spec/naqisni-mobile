/**
 * Hands a result from a full-screen picker (barcode scanner, camera) back to
 * the screen that opened it. The opener calls `waitFor`, pushes the picker,
 * and the picker calls `deliver` before going back.
 */
type Kind = 'barcode' | 'photo';

const waiting = new Map<Kind, (value: string) => void>();

export function waitFor(kind: Kind, onValue: (value: string) => void) {
  waiting.set(kind, onValue);
}

/** True when a screen is waiting for this kind of result. */
export function isWaiting(kind: Kind): boolean {
  return waiting.has(kind);
}

export function deliver(kind: Kind, value: string) {
  const cb = waiting.get(kind);
  waiting.delete(kind);
  cb?.(value);
}

export function stopWaiting(kind: Kind) {
  waiting.delete(kind);
}
