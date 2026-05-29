"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FORMAT_SAMPLE = exports.MAX_REPEAT_DELTA_VALUES = exports.TFIDF_MAP_LIMIT = exports.TFIDF_PENALTY = exports.TFIDF_REPEAT_THRESHOLD = exports.SCORE_KEEP_THRESHOLD = exports.CONTEXT_WINDOW_AFTER = exports.CONTEXT_WINDOW_BEFORE = exports.INTERNAL_STACK_MARKER = void 0;
exports.INTERNAL_STACK_MARKER = '[... hidden internal library frames ...]';
exports.CONTEXT_WINDOW_BEFORE = 3;
exports.CONTEXT_WINDOW_AFTER = 2;
exports.SCORE_KEEP_THRESHOLD = 40;
exports.TFIDF_REPEAT_THRESHOLD = 3;
exports.TFIDF_PENALTY = 8;
exports.TFIDF_MAP_LIMIT = 50_000;
exports.MAX_REPEAT_DELTA_VALUES = 3;
// Auto format detection: number of leading non-blank lines a majority vote
// samples before it may correct the first-line format guess.
exports.DEFAULT_FORMAT_SAMPLE = 50;
