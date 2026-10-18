"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTENT_EARLY_LOG_MIN_RATIO = exports.CONTENT_EARLY_LOG_MIN_LINES = exports.CONTENT_TEXT_MAX_LOG_RATIO = exports.CONTENT_TEXT_MIN_RATIO = exports.CONTENT_TEXT_MIN_LINES = exports.CONTENT_LINE_SCAN_LIMIT = exports.DEFAULT_CONTENT_SAMPLE_BYTES = exports.DEFAULT_CONTENT_SAMPLE_LINES = exports.BLOCK_REFERENCE_MAX_LINE_CHARS = exports.BLOCK_REFERENCE_MAX_CANDIDATES = exports.BLOCK_REFERENCE_MAX_RUN_LINES = exports.BLOCK_REFERENCE_WINDOW_LINES = exports.BLOCK_REFERENCE_MIN_WORDS = exports.BLOCK_REFERENCE_MIN_LINES = exports.ADAPTIVE_CONTEXT_AFTER_EXPANSION = exports.ADAPTIVE_CONTEXT_SPARSE_GAP = exports.ADAPTIVE_CONTEXT_DENSE_GAP = exports.DEFAULT_MAX_STACK_FRAMES = exports.DEFAULT_FORMAT_SAMPLE = exports.MAX_REPEAT_DELTA_VALUES = exports.TFIDF_MAP_LIMIT = exports.RARITY_MIN_INPUT_LINES = exports.RARITY_BOOST = exports.TFIDF_PENALTY = exports.TFIDF_REPEAT_THRESHOLD = exports.SCORE_KEEP_THRESHOLD = exports.CONTEXT_WINDOW_AFTER = exports.CONTEXT_WINDOW_BEFORE = exports.INTERNAL_STACK_MARKER = void 0;
exports.INTERNAL_STACK_MARKER = '[... hidden internal library frames ...]';
exports.CONTEXT_WINDOW_BEFORE = 3;
exports.CONTEXT_WINDOW_AFTER = 2;
exports.SCORE_KEEP_THRESHOLD = 40;
exports.TFIDF_REPEAT_THRESHOLD = 3;
exports.TFIDF_PENALTY = 8;
// IDF-side rarity boost: a positively-scored line seen exactly once in a
// stream of at least RARITY_MIN_INPUT_LINES gains RARITY_BOOST so unique
// diagnostics outrank repeated ones under a token budget.
exports.RARITY_BOOST = 5;
exports.RARITY_MIN_INPUT_LINES = 1000;
exports.TFIDF_MAP_LIMIT = 50_000;
exports.MAX_REPEAT_DELTA_VALUES = 3;
// Auto format detection: number of leading non-blank lines a majority vote
// samples before it may correct the first-line format guess.
exports.DEFAULT_FORMAT_SAMPLE = 50;
// App-stack truncation: a trace keeps at most this many consecutive
// application stack frames before the remainder collapses into a single
// "[... K more application stack frames ...]" marker.
exports.DEFAULT_MAX_STACK_FRAMES = 10;
// Adaptive context window (auto mode): the context window around a kept error
// scales with how densely errors cluster. Errors within DENSE_GAP scored lines
// of the previous one are self-contextualizing and get a tighter window;
// errors isolated by SPARSE_GAP or more scored lines get a wider after-window.
exports.ADAPTIVE_CONTEXT_DENSE_GAP = 2;
exports.ADAPTIVE_CONTEXT_SPARSE_GAP = 12;
// Extra after-context lines granted to an isolated error (on top of the base).
exports.ADAPTIVE_CONTEXT_AFTER_EXPANSION = 2;
// Repeated-block references: a run of at least BLOCK_REFERENCE_MIN_LINES output
// lines (and BLOCK_REFERENCE_MIN_WORDS words, so the marker is always cheaper)
// that repeats an earlier run from the last BLOCK_REFERENCE_WINDOW_LINES lines
// collapses into one "[... N lines repeated from above ...]" marker. A run is
// held back at most BLOCK_REFERENCE_MAX_RUN_LINES lines, at most
// BLOCK_REFERENCE_MAX_CANDIDATES earlier occurrences are followed at once, and
// lines longer than BLOCK_REFERENCE_MAX_LINE_CHARS are never matched, which
// keeps memory and time bounded on any input.
exports.BLOCK_REFERENCE_MIN_LINES = 3;
exports.BLOCK_REFERENCE_MIN_WORDS = 12;
exports.BLOCK_REFERENCE_WINDOW_LINES = 400;
exports.BLOCK_REFERENCE_MAX_RUN_LINES = 64;
exports.BLOCK_REFERENCE_MAX_CANDIDATES = 16;
exports.BLOCK_REFERENCE_MAX_LINE_CHARS = 4096;
// Content classification (log vs. non-log text): the leading sample of a
// stream is scored line by line before the pipeline decides whether to
// compress or pass the input through unchanged. The sample stops at whichever
// cap is reached first, so classification never buffers more than this.
exports.DEFAULT_CONTENT_SAMPLE_LINES = 100;
exports.DEFAULT_CONTENT_SAMPLE_BYTES = 256 * 1024;
// Lines longer than this are cut before scoring so a minified one-liner
// cannot stall the pattern tables.
exports.CONTENT_LINE_SCAN_LIMIT = 2000;
// A sample is called text only when it holds at least this many text-like
// lines, they are at least CONTENT_TEXT_MIN_RATIO of the sampled lines, and
// log-like lines stay at or below CONTENT_TEXT_MAX_LOG_RATIO. Anything else
// stays 'log' so unrecognised formats keep being compressed.
exports.CONTENT_TEXT_MIN_LINES = 2;
exports.CONTENT_TEXT_MIN_RATIO = 0.5;
exports.CONTENT_TEXT_MAX_LOG_RATIO = 0.15;
// Early log verdict while the sample is read: a stream that already looks like
// a log is handed to the pipeline without waiting for the full sample, which
// keeps `tail -f app.log | logstrip` responsive. Reading stops once at least
// CONTENT_EARLY_LOG_MIN_LINES lines are sampled and CONTENT_EARLY_LOG_MIN_RATIO
// of them is log-like (weak signals at half weight). A text file that opens
// with a log excerpt is then compressed, which is what happened before text
// passthrough existed. Only a text verdict needs the full sample.
exports.CONTENT_EARLY_LOG_MIN_LINES = 8;
exports.CONTENT_EARLY_LOG_MIN_RATIO = 0.6;
