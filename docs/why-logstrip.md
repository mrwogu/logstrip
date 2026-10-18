---
title: Why LogStrip
description: Logs are not prose. Why LogStrip trims logs by structure instead of dropping tokens with a language model, what it keeps on purpose, what it drops, what it rewrites, and when not to use it.
---
# Why LogStrip

LogStrip is built for one kind of text: logs. That choice drives everything
else, from how it picks lines to why it needs no model.

## Logs are not prose

A paragraph of prose survives losing a few words, because the reader fills in
the gaps. A log does not work that way.

- **Order is the story.** Which line came first is often the root cause.
- **Frames are exact.** A stack frame is a function, a file and a position.
  Half a frame is worse than none.
- **Most lines are routine.** Health checks, progress bars, passing tests,
  `INFO` chatter. The two lines that explain the failure sit somewhere in the
  middle.
- **Repetition is the main redundancy.** The same event 400 times is one fact
  plus a count. It is not 400 facts.

So the job is not "make this text shorter". It is "keep the lines that explain
the failure, and say what you removed".

## Why we do not drop tokens with a model

Prompt compressors in the LLMLingua family use a small language model to score
each token by how much information it adds, then remove the low scorers until
the prompt fits a target size. That works well for prose prompts. For logs it
has four problems. We describe the approach in general. Tools differ, and we
have not run any of them on our fixtures.

1. **Predictable is not the same as unimportant.** A model finds a repeated
   health check predictable, which is right. It can also find `Killed` or
   `exit status 1` predictable, and those short plain lines are often the
   diagnosis. LogStrip scores lines by what they look like in a log: level,
   error keywords, stack frames, scanner findings, container failures.
2. **Tokens are not lines.** Pruning tokens can leave half a path or half an
   error message. LogStrip works on whole lines. A line is kept, folded or
   hidden behind a marker that says so. It is never cut in the middle.
3. **Repeats lose their count.** Pruned text does not say how often something
   happened. LogStrip folds repeats into `[x412] line` and lists the values that
   differed, such as `amount=[99.99 | 49.50 | 12.00]`.
4. **It needs a model.** That means CPU or GPU time, or an API call, and the
   output can change with the model version, the hardware or the settings.
   LogStrip is plain code with no model and no network. The same input gives the
   same output, and snapshot tests pin that.

If a model-based compressor works for your logs, keep it. The two also combine:
run LogStrip first, because it is cheap and exact, then run a model on what is
left.

## What LogStrip keeps on purpose

- **Errors, fatals and warnings,** including non-English keywords such as
  `erreur`, `Fehler` and `错误`.
- **The first occurrence of every distinct event,** with a count when it
  repeats.
- **Context around a failure,** a few lines before and after, sized to how
  dense the errors are.
- **Application stack frames.** Frames from your own code stay.
- **The root cause.** Downstream restatements such as `aborting due to previous
  errors` are pruned so the original failure stands out.
- **Scanner findings and container failures,** such as `CVE-` lines and
  `ErrImagePull`.
- **Line order.** Output lines come out in input order, also under
  `--max-tokens`.
- **Valid JSON,** when the input is a whole JSON report.

## What LogStrip drops

- `INFO`, `DEBUG`, `TRACE` and `VERBOSE` lines, unless the text still reads as
  a diagnostic.
- Passing tests, even when the test name mentions an error.
- Download and progress lines, unless they report a failure.
- Repeated lines, folded into `[xN]`.
- Internal library frames, replaced by `[... hidden internal library frames ...]`.
- Blocks that repeat earlier output, replaced by
  `[... N lines repeated from above ...]`.

LogStrip is lossy on purpose. The raw file is never changed, so you can always
go back to it.

## What LogStrip rewrites

Some values change on every line and stop repeated events from folding. LogStrip
replaces them with fixed placeholders by documented rules.

| In the log | In the output | Why |
| :--- | :--- | :--- |
| UUIDs, hashes | `[ID]`, `[HASH]` | Same event, different id: one group. |
| Timestamps | `[TIME]` | Same event, different second: one group. |
| IP addresses, emails | `[IP]`, `[EMAIL]` | Rarely help a diagnosis. |
| Line and column in a frame | `[NN]` | The same trace printed twice folds. |
| Tokens, passwords, keys | `[REDACTED]`, `[JWT]` | Safe to paste. See [Security](guides/security.md). |

Two consequences you should know about:

- **Ids no longer link lines.** If you need to follow one request across lines,
  `--preserve-id-suffix 6` keeps the last six characters of each id.
- **Frames lose their line numbers.** You keep the function and the file, which
  is usually enough to find the spot. The exact position is in the raw log.

## A real example

`tests/fixtures/jest-noisy.log` is a Jest run with worker boot noise, passing
suites and three copies of the same failure. 47 lines, 284 estimated tokens.

```bash
logstrip tests/fixtures/jest-noisy.log
```

```text
[ERROR] TypeError: Cannot read properties of undefined (reading 'amount') at request [ID]
    at Payments.charge (/repo/src/payments.ts:[NN]:[NN])
    at Object.<anonymous> (/repo/src/payments.test.ts:[NN]:[NN])
[... hidden internal library frames ...]
    at new Promise (<anonymous>)
[... hidden internal library frames ...]
[... 9 lines repeated from above ...]
[x2] [... hidden internal library frames ...]
```

8 lines, 63 tokens, 77.8% saved. The failing frame in `payments.ts` survived.
The test totals did not: in this fixture they carry an `[INFO]` tag, so they
went with the other `INFO` lines. That is the trade, and it is why the raw file
stays on disk.

## When not to use LogStrip

- **The input is a document.** README files, prose, source code and
  configuration are copied through with only secrets masked, and the savings
  are 0%. LogStrip decides this from the first lines. `--force` overrides it.
  Use `--force` only when you mean it, for example a text dump that really is a
  log.
- **You need every line.** Audit trails, billing events and anything you must
  replay in full belong in the raw file. Use LogStrip for the copy a model
  reads.
- **You need exact line numbers or ids.** Read the raw log, or keep the id tail
  with `--preserve-id-suffix`.
- **You want a summary in prose.** LogStrip does not write sentences. It
  returns your own lines, fewer of them.

## Related

- [Benchmarks](benchmarks.md) - measured savings for every fixture.
- [Compare](compare.md) - LogStrip next to the other things people try.
- [Compression Flow](guides/compression-flow.md) - the steps, in order.
