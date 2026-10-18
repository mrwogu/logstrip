export const INTERNAL_STACK_MARKER = '[... hidden internal library frames ...]';

export const CONTEXT_WINDOW_BEFORE = 3;
export const CONTEXT_WINDOW_AFTER = 2;
export const SCORE_KEEP_THRESHOLD = 40;
export const TFIDF_REPEAT_THRESHOLD = 3;
export const TFIDF_PENALTY = 8;
// IDF-side rarity boost: a positively-scored line seen exactly once in a
// stream of at least RARITY_MIN_INPUT_LINES gains RARITY_BOOST so unique
// diagnostics outrank repeated ones under a token budget.
export const RARITY_BOOST = 5;
export const RARITY_MIN_INPUT_LINES = 1000;
export const TFIDF_MAP_LIMIT = 50_000;
export const MAX_REPEAT_DELTA_VALUES = 3;
// Auto format detection: number of leading non-blank lines a majority vote
// samples before it may correct the first-line format guess.
export const DEFAULT_FORMAT_SAMPLE = 50;

// App-stack truncation: a trace keeps at most this many consecutive
// application stack frames before the remainder collapses into a single
// "[... K more application stack frames ...]" marker.
export const DEFAULT_MAX_STACK_FRAMES = 10;

// Adaptive context window (auto mode): the context window around a kept error
// scales with how densely errors cluster. Errors within DENSE_GAP scored lines
// of the previous one are self-contextualizing and get a tighter window;
// errors isolated by SPARSE_GAP or more scored lines get a wider after-window.
export const ADAPTIVE_CONTEXT_DENSE_GAP = 2;
export const ADAPTIVE_CONTEXT_SPARSE_GAP = 12;
// Extra after-context lines granted to an isolated error (on top of the base).
export const ADAPTIVE_CONTEXT_AFTER_EXPANSION = 2;

// Repeated-block references: a run of at least BLOCK_REFERENCE_MIN_LINES output
// lines (and BLOCK_REFERENCE_MIN_WORDS words, so the marker is always cheaper)
// that repeats an earlier run from the last BLOCK_REFERENCE_WINDOW_LINES lines
// collapses into one "[... N lines repeated from above ...]" marker. A run is
// held back at most BLOCK_REFERENCE_MAX_RUN_LINES lines, at most
// BLOCK_REFERENCE_MAX_CANDIDATES earlier occurrences are followed at once, and
// lines longer than BLOCK_REFERENCE_MAX_LINE_CHARS are never matched, which
// keeps memory and time bounded on any input.
export const BLOCK_REFERENCE_MIN_LINES = 3;
export const BLOCK_REFERENCE_MIN_WORDS = 12;
export const BLOCK_REFERENCE_WINDOW_LINES = 400;
export const BLOCK_REFERENCE_MAX_RUN_LINES = 64;
export const BLOCK_REFERENCE_MAX_CANDIDATES = 16;
export const BLOCK_REFERENCE_MAX_LINE_CHARS = 4096;

// Content classification (log vs. non-log text): the leading sample of a
// stream is scored line by line before the pipeline decides whether to
// compress or pass the input through unchanged. The sample stops at whichever
// cap is reached first, so classification never buffers more than this.
export const DEFAULT_CONTENT_SAMPLE_LINES = 100;
export const DEFAULT_CONTENT_SAMPLE_BYTES = 256 * 1024;
// Lines longer than this are cut before scoring so a minified one-liner
// cannot stall the pattern tables.
export const CONTENT_LINE_SCAN_LIMIT = 2000;
// A sample is called text only when it holds at least this many text-like
// lines, they are at least CONTENT_TEXT_MIN_RATIO of the sampled lines, and
// log-like lines stay at or below CONTENT_TEXT_MAX_LOG_RATIO. Anything else
// stays 'log' so unrecognised formats keep being compressed.
export const CONTENT_TEXT_MIN_LINES = 2;
export const CONTENT_TEXT_MIN_RATIO = 0.5;
export const CONTENT_TEXT_MAX_LOG_RATIO = 0.15;

// Early log verdict while the sample is read: a stream that already looks like
// a log is handed to the pipeline without waiting for the full sample, which
// keeps `tail -f app.log | logstrip` responsive. Reading stops once at least
// CONTENT_EARLY_LOG_MIN_LINES lines are sampled and CONTENT_EARLY_LOG_MIN_RATIO
// of them is log-like (weak signals at half weight). A text file that opens
// with a log excerpt is then compressed, which is what happened before text
// passthrough existed. Only a text verdict needs the full sample.
export const CONTENT_EARLY_LOG_MIN_LINES = 8;
export const CONTENT_EARLY_LOG_MIN_RATIO = 0.6;
