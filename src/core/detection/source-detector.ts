import {
  createSourceProfiles,
  type SourceProfile,
} from '../sources/source-profile.js';
import { LOG_SOURCE_SIGNATURES } from '../sources/catalog.js';

export const SOURCE_ACTIVE_CONFIDENCE = 12;
export const SOURCE_DIAGNOSTIC_BOOST = 40;

export interface SourceDetectionHit {
  hits: number;
  confidence: number;
  matchedMarkers: Set<string>;
}

export interface SourceDetectionState {
  hits: Map<string, SourceDetectionHit>;
  profiles: readonly SourceProfile[];
}

export function createSourceDetectionState(
  sources: readonly (readonly [string, readonly string[]])[] = LOG_SOURCE_SIGNATURES,
): SourceDetectionState {
  return {
    hits: new Map<string, SourceDetectionHit>(),
    profiles: createSourceProfiles(sources),
  };
}

export function collectDetectedSourceHits(
  line: string,
  state: SourceDetectionState,
): void {
  const normalized = line.toLowerCase();

  for (const profile of state.profiles) {
    for (const marker of profile.markers) {
      if (!normalized.includes(marker.value)) {
        continue;
      }

      const hit = state.hits.get(profile.name) ?? {
        hits: 0,
        confidence: 0,
        matchedMarkers: new Set<string>(),
      };

      hit.hits += 1;
      hit.confidence += marker.weight;
      hit.matchedMarkers.add(marker.value);
      state.hits.set(profile.name, hit);
      break;
    }
  }
}

export function rankDetectedSources(
  state: SourceDetectionState,
  limit = 12,
): readonly string[] {
  if (limit <= 0) {
    return [];
  }

  return [...state.hits.entries()]
    .sort((left, right) => {
      const hitsDelta = right[1].hits - left[1].hits;
      if (hitsDelta !== 0) return hitsDelta;

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([source]) => source);
}

export function detectLogSources(
  input: string | readonly string[],
  limit = 12,
): readonly string[] {
  const state = createSourceDetectionState();
  const lines =
    typeof input === 'string' ? input.split(/\r?\n/u) : [...input];

  for (const line of lines) {
    collectDetectedSourceHits(line, state);
  }

  return rankDetectedSources(state, limit);
}

export function scoreSourceDiagnosticBoost(
  line: string,
  state: SourceDetectionState,
): number {
  for (const profile of state.profiles) {
    const hit = state.hits.get(profile.name);
    if (hit === undefined || hit.confidence < SOURCE_ACTIVE_CONFIDENCE) {
      continue;
    }

    if (profile.diagnosticBoostPatterns.some((pattern) => pattern.test(line))) {
      return SOURCE_DIAGNOSTIC_BOOST;
    }
  }

  return 0;
}
