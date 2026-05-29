"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOURCE_DIAGNOSTIC_BOOST = exports.SOURCE_ACTIVE_CONFIDENCE = void 0;
exports.getEffectiveActiveConfidence = getEffectiveActiveConfidence;
exports.createSourceDetectionState = createSourceDetectionState;
exports.collectDetectedSourceHits = collectDetectedSourceHits;
exports.rankDetectedSources = rankDetectedSources;
exports.detectLogSources = detectLogSources;
exports.scoreSourceDiagnosticBoost = scoreSourceDiagnosticBoost;
const source_profile_js_1 = require("../sources/source-profile.js");
const catalog_js_1 = require("../sources/catalog.js");
const aho_corasick_js_1 = require("./aho-corasick.js");
exports.SOURCE_ACTIVE_CONFIDENCE = 12;
exports.SOURCE_DIAGNOSTIC_BOOST = 40;
/**
 * Adaptive threshold: small logs need fewer marker hits to activate a source.
 * Reduces the required confidence proportionally when total input lines are low.
 */
function getEffectiveActiveConfidence(inputLines) {
    if (inputLines < 50)
        return 4;
    if (inputLines < 200)
        return 6;
    return exports.SOURCE_ACTIVE_CONFIDENCE;
}
function createSourceDetectionState(sources = catalog_js_1.LOG_SOURCE_SIGNATURES) {
    const profiles = (0, source_profile_js_1.createSourceProfiles)(sources);
    const markerValues = new Set();
    for (const profile of profiles) {
        for (const marker of profile.markers) {
            markerValues.add(marker.value);
        }
    }
    return {
        hits: new Map(),
        profiles,
        automaton: (0, aho_corasick_js_1.buildAhoCorasick)(markerValues),
    };
}
function collectDetectedSourceHits(line, state) {
    const normalized = line.toLowerCase();
    const matched = (0, aho_corasick_js_1.matchAll)(state.automaton, normalized);
    if (matched.size === 0) {
        return;
    }
    for (const profile of state.profiles) {
        for (const marker of profile.markers) {
            if (!matched.has(marker.value)) {
                continue;
            }
            const hit = state.hits.get(profile.name) ?? {
                hits: 0,
                confidence: 0,
                matchedMarkers: new Set(),
            };
            hit.hits += 1;
            hit.confidence += marker.weight;
            hit.matchedMarkers.add(marker.value);
            state.hits.set(profile.name, hit);
            break;
        }
    }
}
function rankDetectedSources(state, limit = 12) {
    if (limit <= 0) {
        return [];
    }
    return [...state.hits.entries()]
        .sort((left, right) => {
        const hitsDelta = right[1].hits - left[1].hits;
        if (hitsDelta !== 0)
            return hitsDelta;
        return left[0].localeCompare(right[0]);
    })
        .slice(0, limit)
        .map(([source]) => source);
}
function detectLogSources(input, limit = 12) {
    const state = createSourceDetectionState();
    const lines = typeof input === 'string' ? input.split(/\r?\n/u) : [...input];
    for (const line of lines) {
        collectDetectedSourceHits(line, state);
    }
    return rankDetectedSources(state, limit);
}
function scoreSourceDiagnosticBoost(line, state, inputLines) {
    const threshold = inputLines !== undefined
        ? getEffectiveActiveConfidence(inputLines)
        : exports.SOURCE_ACTIVE_CONFIDENCE;
    for (const profile of state.profiles) {
        const hit = state.hits.get(profile.name);
        if (hit === undefined || hit.confidence < threshold) {
            continue;
        }
        if (profile.diagnosticBoostPatterns.some((pattern) => pattern.test(line))) {
            return exports.SOURCE_DIAGNOSTIC_BOOST;
        }
    }
    return 0;
}
