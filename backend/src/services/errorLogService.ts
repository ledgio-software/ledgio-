export interface ErrorEntry {
  ts: string;
  method: string;
  path: string;
  status: number;
  error: string;
  stack?: string;
}

const MAX = 100;
const buffer: ErrorEntry[] = [];

export function recordError(entry: ErrorEntry): void {
  if (buffer.length >= MAX) buffer.shift();
  buffer.push(entry);
}

export function getErrors(): ErrorEntry[] {
  return [...buffer].reverse();
}

export function clearErrors(): void {
  buffer.length = 0;
}
