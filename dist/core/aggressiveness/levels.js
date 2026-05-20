"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGGRESSIVENESS_LEVELS = exports.STATIC_AGGRESSIVENESS_LEVELS = void 0;
exports.parseAggressiveness = parseAggressiveness;
exports.toStaticAggressiveness = toStaticAggressiveness;
exports.STATIC_AGGRESSIVENESS_LEVELS = [
    'low',
    'medium',
    'high',
    'aggressive',
];
exports.AGGRESSIVENESS_LEVELS = [
    ...exports.STATIC_AGGRESSIVENESS_LEVELS,
    'auto',
];
function parseAggressiveness(value) {
    const normalized = (value ?? 'auto').toLowerCase();
    if (exports.AGGRESSIVENESS_LEVELS.includes(normalized)) {
        return normalized;
    }
    throw new Error(`Unsupported aggressiveness "${value}". Expected one of: ${exports.AGGRESSIVENESS_LEVELS.join(', ')}.`);
}
function toStaticAggressiveness(aggressiveness) {
    return aggressiveness === 'auto' ? 'high' : aggressiveness;
}
