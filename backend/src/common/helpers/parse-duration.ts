const UNITS_MS = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

type Unit = keyof typeof UNITS_MS;

const PATTERN = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i;

export function parseDurationMs(input: string): number {
  const match = PATTERN.exec(input.trim());
  if (!match) {
    throw new Error(
      `Invalid duration "${input}". Expected e.g. "30m", "1h", "7d", "500ms".`,
    );
  }
  const value = Number(match[1]);
  const unit = match[2].toLowerCase() as Unit;
  return Math.round(value * UNITS_MS[unit]);
}