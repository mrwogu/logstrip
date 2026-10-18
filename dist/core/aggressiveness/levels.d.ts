import type { Aggressiveness, StaticAggressiveness } from '../types.js';
export declare const STATIC_AGGRESSIVENESS_LEVELS: readonly StaticAggressiveness[];
export declare const AGGRESSIVENESS_LEVELS: readonly Aggressiveness[];
export declare function parseAggressiveness(value: string | undefined): Aggressiveness;
export declare function toStaticAggressiveness(aggressiveness: Aggressiveness): StaticAggressiveness;
