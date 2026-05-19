#!/usr/bin/env bash
# logstrip-hook.sh — Auto-activates LogStrip on log content.
#
# Handles two hook events:
#   PreToolUse (Read on .log/.out/.txt/.trace/.err files):
#     Runs `logstrip <file> -o <file>.logstrip.log`, then denies the raw
#     Read and redirects the agent to the compressed file — raw bytes never
#     enter the context window.
#
#   UserPromptSubmit (pasted log-like output in the user prompt):
#     Detects log patterns (timestamps, log levels, stack traces, CI markers)
#     and injects additionalContext telling the agent to write the paste to a
#     temp file and run `logstrip` before analysing.

set -euo pipefail

INPUT=$(cat)
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty' 2>/dev/null || true)

case "$EVENT" in
  PreToolUse)
    # Only intercept Read tool calls
    TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
    [ "$TOOL_NAME" != "Read" ] && exit 0

    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
    [ -z "$FILE_PATH" ] && exit 0

    # Skip already-compressed files
    case "$FILE_PATH" in
      *.logstrip.log|*.logstrip.*) exit 0 ;;
      *.log|*.out|*.txt|*.trace|*.err) ;;
      *) exit 0 ;;
    esac

    # Skip non-existent files
    [ ! -f "$FILE_PATH" ] && exit 0

    # Check if logstrip is available
    if command -v logstrip >/dev/null 2>&1; then
      OUTPUT_FILE="${FILE_PATH}.logstrip.log"
      if logstrip "$FILE_PATH" -o "$OUTPUT_FILE" --stats >/dev/null 2>&1; then
        # Deny the raw read; redirect to the compressed file
        jq -nc \
          --arg output "$OUTPUT_FILE" \
          --arg original "$FILE_PATH" \
          '{
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: ("LogStrip: auto-compressed " + $original + " -> " + $output + ". Read the compressed .logstrip.log file instead.")
            }
          }'
      else
        # Compression failed — allow the raw read with a note
        jq -nc '{
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            additionalContext: "LogStrip: compression failed for this log file. Analysing raw content."
          }
        }'
      fi
    else
      # logstrip not installed — allow the read but suggest installation
      jq -nc '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: "LogStrip: this is a log file. Install logstrip (npm i -g logstrip) to auto-compress before analysis."
        }
      }'
    fi
    ;;

  UserPromptSubmit)
    # Detect pasted log output in the user prompt
    PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || true)
    [ -z "$PROMPT" ] && exit 0

    # Pasted logs are multi-line — skip short messages
    LINES=$(printf '%s\n' "$PROMPT" | wc -l | tr -d '[:space:]')
    [ "$LINES" -lt 5 ] && exit 0

    # Log-detection heuristics (need 2+ matches)
    SCORE=0

    # Timestamps: ISO 8601 or HH:MM:SS.mmm
    COUNT=$(printf '%s' "$PROMPT" | grep -cE '(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}|\d{2}:\d{2}:\d{2}[.,]\d{3})' 2>/dev/null || true)
    COUNT=${COUNT:-0}
    [ "$COUNT" -ge 2 ] && SCORE=$((SCORE + 1))

    # Log levels: [ERROR], [INFO], or unbracketed ERROR:, WARNING:, npm ERR!
    COUNT=$(printf '%s' "$PROMPT" | grep -ciE '\[(INFO|ERROR|WARN|DEBUG|TRACE|FATAL|WARNING)\]|(^|\s)(ERROR|WARNING|FATAL|INFO):|npm (ERR|WARN)!' 2>/dev/null || true)
    COUNT=${COUNT:-0}
    [ "$COUNT" -ge 2 ] && SCORE=$((SCORE + 1))

    # Stack traces: at package.Class.method (+ bonus for deep stacks)
    COUNT=$(printf '%s' "$PROMPT" | grep -cE 'at [a-zA-Z][a-zA-Z0-9_$]+\.[a-zA-Z]' 2>/dev/null || true)
    COUNT=${COUNT:-0}
    [ "$COUNT" -ge 1 ] && SCORE=$((SCORE + 1))
    [ "$COUNT" -ge 3 ] && SCORE=$((SCORE + 1))

    # CI/build markers: FAIL, PASS, npm ERR!, cargo, make, pytest, jest
    COUNT=$(printf '%s' "$PROMPT" | grep -ciE '(FAIL|PASS|SKIP|RUN)\b|npm ERR!|cargo (error|warning)|make\[|pytest|jest|mocha' 2>/dev/null || true)
    COUNT=${COUNT:-0}
    [ "$COUNT" -ge 2 ] && SCORE=$((SCORE + 1))

    # Log/test-prefixed lines: lines starting with common log or test-result prefixes
    COUNT=$(printf '%s' "$PROMPT" | grep -cE '^\s*(npm ERR|npm WARN|yarn error|FAIL|PASS|SKIP|RUN|OK|ERR!|WARN!|\[ERROR\]|\[INFO\]|\[WARN\]|\[DEBUG\]|\[FATAL\]|\[TRACE\]|FATAL:|ERROR:|WARNING:)' 2>/dev/null || true)
    COUNT=${COUNT:-0}
    [ "$COUNT" -ge 2 ] && SCORE=$((SCORE + 1))

    [ "$SCORE" -lt 2 ] && exit 0

    # Log-like content detected — inject auto-activation context
    jq -nc '{
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "LogStrip auto-activation: pasted log output detected. Before analysing, write the pasted content to a temp file (mktemp) and run `logstrip <file> -o <file>.logstrip.log --stats`, then read the compressed output. If logstrip is not installed, suggest `npm i -g logstrip`. Do not analyse the raw pasted logs line-by-line."
      }
    }'
    ;;

  *)
    exit 0
    ;;
esac
