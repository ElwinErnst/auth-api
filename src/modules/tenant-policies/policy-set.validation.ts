import { BadRequestException } from '@nestjs/common';

/**
 * Structural validation for a compiled Zero Trust policy set. The authoritative
 * schema lives in zerotrust-api (which re-validates on read); auth-api only
 * needs to reject obviously-malformed input before persisting. Kept
 * intentionally light so the two services don't drift on every schema tweak.
 */
export function assertValidPolicySet(input: unknown): Record<string, unknown> {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestException('Policy set must be an object');
  }
  const p = input as Record<string, unknown>;

  if (p.version !== 1) errors.push('version must be 1');
  if (p.default !== 'allow' && p.default !== 'deny') {
    errors.push("default must be 'allow' or 'deny'");
  }

  if (!Array.isArray(p.rules)) {
    errors.push('rules must be an array');
  } else {
    if (p.rules.length > 50) errors.push('rules may not exceed 50 entries');
    p.rules.forEach((rule, i) => {
      if (typeof rule !== 'object' || rule === null) {
        errors.push(`rules[${i}] must be an object`);
        return;
      }
      const r = rule as Record<string, unknown>;
      if (r.effect !== 'allow' && r.effect !== 'deny') {
        errors.push(`rules[${i}].effect must be 'allow' or 'deny'`);
      }
      if (typeof r.when !== 'object' || r.when === null) {
        errors.push(`rules[${i}].when is required`);
      } else if (
        typeof (r.when as Record<string, unknown>).upstream !== 'string'
      ) {
        errors.push(`rules[${i}].when.upstream must be a string`);
      }
    });
  }

  if (errors.length > 0) {
    throw new BadRequestException({ message: 'Invalid policy set', errors });
  }

  return p;
}
