import { buildSourceBoosterPatterns } from '../scoring/diagnostic-boosters.js';

export interface SourceMarker {
  value: string;
  weight: number;
}

export interface SourceProfile {
  name: string;
  markers: readonly SourceMarker[];
  diagnosticBoostPatterns: readonly RegExp[];
}

const SOURCE_DIAGNOSTIC_BOOST_PATTERNS = buildSourceBoosterPatterns();

export function createSourceProfiles(
  signatures: readonly (readonly [string, readonly string[]])[],
): readonly SourceProfile[] {
  return signatures.map(([name, markers]) => ({
    name,
    markers: markers.map((marker) => ({
      value: marker.toLowerCase(),
      weight: sourceMarkerWeight(marker),
    })),
    diagnosticBoostPatterns: SOURCE_DIAGNOSTIC_BOOST_PATTERNS.get(name) ?? [],
  }));
}

export function sourceMarkerWeight(marker: string): number {
  const normalized = marker.trim();

  if (normalized.length <= 3) {
    return 6;
  }

  if (normalized.length >= 12 || /[^a-z0-9]/iu.test(normalized)) {
    return 16;
  }

  return 12;
}
