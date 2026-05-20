"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDynamicAggressivenessState = createDynamicAggressivenessState;
exports.recordLineDecision = recordLineDecision;
const levels_js_1 = require("./levels.js");
const DYNAMIC_WINDOW_SIZE = 8;
const AGGRESSIVENESS_ORDER = [
    'low',
    'medium',
    'high',
    'aggressive',
];
function createDynamicAggressivenessState(requested) {
    return {
        enabled: requested === 'auto',
        effective: (0, levels_js_1.toStaticAggressiveness)(requested),
        windowLines: 0,
        keptLines: 0,
        droppedLines: 0,
        hardKeeps: 0,
        repeatedLines: 0,
    };
}
function recordLineDecision(state, decision) {
    if (!state.enabled) {
        return;
    }
    state.windowLines += 1;
    if (decision.kept)
        state.keptLines += 1;
    if (decision.dropped)
        state.droppedLines += 1;
    if (decision.hardKeep)
        state.hardKeeps += 1;
    if (decision.repeated)
        state.repeatedLines += 1;
    if (state.windowLines < DYNAMIC_WINDOW_SIZE) {
        return;
    }
    if (state.hardKeeps >= 3) {
        state.effective = shiftAggressiveness(state.effective, -1);
    }
    else if (state.keptLines <= 1 &&
        state.droppedLines + state.repeatedLines >= 6) {
        state.effective = shiftAggressiveness(state.effective, 1);
    }
    resetWindow(state);
}
function shiftAggressiveness(current, delta) {
    const index = AGGRESSIVENESS_ORDER.indexOf(current);
    const nextIndex = Math.max(0, Math.min(AGGRESSIVENESS_ORDER.length - 1, index + delta));
    return AGGRESSIVENESS_ORDER[nextIndex];
}
function resetWindow(state) {
    state.windowLines = 0;
    state.keptLines = 0;
    state.droppedLines = 0;
    state.hardKeeps = 0;
    state.repeatedLines = 0;
}
