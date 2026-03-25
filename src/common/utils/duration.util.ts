export function durationToMilliseconds(value: string): number {
  const input = value.trim();

  if (/^\d+$/.test(input)) {
    return Number(input) * 1000;
  }

  const match = /^(\d+)(ms|s|m|h|d)$/i.exec(input);
  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    case 'd':
      return amount * 86_400_000;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}
