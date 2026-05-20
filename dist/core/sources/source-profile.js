"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSourceProfiles = createSourceProfiles;
exports.sourceMarkerWeight = sourceMarkerWeight;
const SOURCE_DIAGNOSTIC_BOOST_PATTERNS = {
    typescript: [/\bTS\d{4}\b/u],
    pytest: [/^E\s+/u, /\bFAILED\b/u],
    nginx: [/\[(?:error|crit|alert|emerg)\]/iu],
    kubernetes: [/\b(?:BackOff|Failed|ErrImagePull|CrashLoopBackOff)\b/u],
    'github-actions': [/^::(?:error|warning)\b/u],
};
function createSourceProfiles(signatures) {
    return signatures.map(([name, markers]) => ({
        name,
        markers: markers.map((marker) => ({
            value: marker.toLowerCase(),
            weight: sourceMarkerWeight(marker),
        })),
        diagnosticBoostPatterns: SOURCE_DIAGNOSTIC_BOOST_PATTERNS[name] ?? [],
    }));
}
function sourceMarkerWeight(marker) {
    const normalized = marker.trim();
    if (normalized.length <= 3) {
        return 6;
    }
    if (normalized.length >= 12 || /[^a-z0-9]/iu.test(normalized)) {
        return 16;
    }
    return 12;
}
