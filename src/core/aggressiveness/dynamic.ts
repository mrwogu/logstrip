import type { Aggressiveness, StaticAggressiveness } from '../types.js';
import { toStaticAggressiveness } from './levels.js';

const DYNAMIC_WINDOW_SIZE = 8;

export interface DynamicAggressivenessState {
  enabled: boolean;
  effective: StaticAggressiveness;
  windowLines: number;
  keptLines: number;
  droppedLines: number;
  hardKeeps: number;
  repeatedLines: number;
}

export interface LineDecision {
  kept: boolean;
  dropped: boolean;
  hardKeep: boolean;
  repeated: boolean;
}

const AGGRESSIVENESS_ORDER: readonly StaticAggressiveness[] = [
  'low',
  'medium',
  'high',
  'aggressive',
];

export function createDynamicAggressivenessState(
  requested: Aggressiveness,
): DynamicAggressivenessState {
  return {
    enabled: requested === 'auto',
    effective: toStaticAggressiveness(requested),
    windowLines: 0,
    keptLines: 0,
    droppedLines: 0,
    hardKeeps: 0,
    repeatedLines: 0,
  };
}

export function recordLineDecision(
  state: DynamicAggressivenessState,
  decision: LineDecision,
): void {
  if (!state.enabled) {
    return;
  }

  state.windowLines += 1;
  if (decision.kept) state.keptLines += 1;
  if (decision.dropped) state.droppedLines += 1;
  if (decision.hardKeep) state.hardKeeps += 1;
  if (decision.repeated) state.repeatedLines += 1;

  if (state.windowLines < DYNAMIC_WINDOW_SIZE) {
    return;
  }

  if (state.hardKeeps >= 3) {
    state.effective = shiftAggressiveness(state.effective, -1);
  } else if (
    state.keptLines <= 1 &&
    state.droppedLines + state.repeatedLines >= 6
  ) {
    state.effective = shiftAggressiveness(state.effective, 1);
  }

  resetWindow(state);
}

function shiftAggressiveness(
  current: StaticAggressiveness,
  delta: -1 | 1,
): StaticAggressiveness {
  const index = AGGRESSIVENESS_ORDER.indexOf(current);
  const nextIndex = Math.max(
    0,
    Math.min(AGGRESSIVENESS_ORDER.length - 1, index + delta),
  );

  return AGGRESSIVENESS_ORDER[nextIndex];
}

function resetWindow(state: DynamicAggressivenessState): void {
  state.windowLines = 0;
  state.keptLines = 0;
  state.droppedLines = 0;
  state.hardKeeps = 0;
  state.repeatedLines = 0;
}
