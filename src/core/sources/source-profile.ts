export interface SourceMarker {
  value: string;
  weight: number;
}

export interface SourceProfile {
  name: string;
  markers: readonly SourceMarker[];
  diagnosticBoostPatterns: readonly RegExp[];
}

const SOURCE_DIAGNOSTIC_BOOST_PATTERNS: Readonly<
  Record<string, readonly RegExp[]>
> = {
  typescript: [/\bTS\d{4}\b/u],
  pytest: [/^E\s+/u, /\bFAILED\b/u],
  nginx: [/\[(?:error|crit|alert|emerg)\]/iu],
  'apache-httpd': [
    /\[(?:error|crit|alert|emerg)\]/iu,
    /\bAH\d{5}\b/u,
    /\b(?:Directory index forbidden|client denied|mod_jk)\b/iu,
  ],
  kubernetes: [/\b(?:BackOff|Failed|ErrImagePull|CrashLoopBackOff)\b/u],
  'github-actions': [/^::(?:error|warning)\b/u],
};

export function createSourceProfiles(
  signatures: readonly (readonly [string, readonly string[]])[],
): readonly SourceProfile[] {
  return signatures.map(([name, markers]) => ({
    name,
    markers: markers.map((marker) => ({
      value: marker.toLowerCase(),
      weight: sourceMarkerWeight(marker),
    })),
    diagnosticBoostPatterns: SOURCE_DIAGNOSTIC_BOOST_PATTERNS[name] ?? [],
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
