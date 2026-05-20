import type { Aggressiveness, StaticAggressiveness } from '../types.js';

export const STATIC_AGGRESSIVENESS_LEVELS: readonly StaticAggressiveness[] = [
  'low',
  'medium',
  'high',
  'aggressive',
];

export const AGGRESSIVENESS_LEVELS: readonly Aggressiveness[] = [
  ...STATIC_AGGRESSIVENESS_LEVELS,
  'auto',
];

export function parseAggressiveness(value: string | undefined): Aggressiveness {
  const normalized = (value ?? 'high').toLowerCase();

  if ((AGGRESSIVENESS_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as Aggressiveness;
  }

  throw new Error(
    `Unsupported aggressiveness "${value}". Expected one of: ${AGGRESSIVENESS_LEVELS.join(', ')}.`,
  );
}

export function toStaticAggressiveness(
  aggressiveness: Aggressiveness,
): StaticAggressiveness {
  return aggressiveness === 'auto' ? 'high' : aggressiveness;
}
