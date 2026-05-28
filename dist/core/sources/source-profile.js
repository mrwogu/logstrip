"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSourceProfiles = createSourceProfiles;
exports.sourceMarkerWeight = sourceMarkerWeight;
const diagnostic_boosters_js_1 = require("../scoring/diagnostic-boosters.js");
const SOURCE_DIAGNOSTIC_BOOST_PATTERNS = (0, diagnostic_boosters_js_1.buildSourceBoosterPatterns)();
function createSourceProfiles(signatures) {
    return signatures.map(([name, markers]) => ({
        name,
        markers: markers.map((marker) => ({
            value: marker.toLowerCase(),
            weight: sourceMarkerWeight(marker),
        })),
        diagnosticBoostPatterns: SOURCE_DIAGNOSTIC_BOOST_PATTERNS.get(name) ?? [],
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
