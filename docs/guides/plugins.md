# Plugin Installation

ContextBonsai is CLI-first, but the repository ships plugin/config bundles for
every agent shown on the documentation homepage: Claude Code, Factory Droid,
GitHub Copilot, Cursor, Codex, and OpenCode.

## How the plugins improve agent efficiency

All bundles teach the agent to run `bonsai` before it reasons over a raw log.
That gives the agent a smaller, higher-signal file plus measurable savings from
`--stats`.

| Efficiency lever       | What the plugin does                                                    | Agent impact                                           |
| :--------------------- | :--------------------------------------------------------------------- | :----------------------------------------------------- |
| Smaller context        | Runs `bonsai <input> -o <output> --stats` before diagnosis              | Fewer log tokens compete with stack traces and errors  |
| Less repetition        | Collapses duplicates and internal stack frames                          | The model spends attention on unique failure evidence  |
| Safer sharing          | Keeps full raw logs out of chat unless explicitly requested             | Lower risk of copying noisy or sensitive log material  |
| Measurable ROI         | Reports input/output token estimates and `savingsPercent`               | Teams can see how much context budget was recovered    |
| Repeatable workflow    | Provides commands, rules, skills, or `AGENTS.md` instructions per agent | Every agent follows the same compression-first pattern |

If `--stats` reports `inputTokens=18000` and `outputTokens=4500`, the agent
receives 75% less log context while still preserving diagnostic lines.

## Repository layout

```text
.claude-plugin/
  marketplace.json
.factory-plugin/
  marketplace.json
plugins/
  context-bonsai/
    .claude-plugin/
      plugin.json
    .factory-plugin/
      plugin.json
    copilot/
      .github/
        copilot-instructions.md
        instructions/
          context-bonsai.instructions.md
        prompts/
          bonsai.prompt.md
    cursor/
      .cursor/
        rules/
          context-bonsai.mdc
    codex/
      AGENTS.md
      .codex/
        skills/
          context-bonsai/
            SKILL.md
    opencode/
      AGENTS.md
      .opencode/
        commands/
          bonsai.md
        skills/
          context-bonsai/
            SKILL.md
    commands/
      bonsai.md
    skills/
      context-bonsai/
        SKILL.md
    agents/
      bonsai-reviewer.md
      bonsai-fixture-author.md
    droids/
      bonsai-reviewer.md
      bonsai-fixture-author.md
```

## Claude Code

Add the Git-backed marketplace, then install the plugin:

```text
/plugin marketplace add https://github.com/mrwogu/context-bonsai.git
/plugin install context-bonsai@context-bonsai
```

For local development from a clone of this repository:

```text
/plugin marketplace add .
/plugin install context-bonsai@context-bonsai
```

The plugin contributes a `bonsai` command, a `context-bonsai` skill, and two
ContextBonsai-focused agents. Install the CLI before using the command:

```bash
npm i -g context-bonsai
```

## Factory Droid

Add the Droid marketplace, then install the plugin:

```bash
droid plugin marketplace add https://github.com/mrwogu/context-bonsai.git
droid plugin install context-bonsai@context-bonsai
```

For local development from a clone of this repository:

```bash
droid plugin marketplace add .
droid plugin install context-bonsai@context-bonsai
```

The Droid plugin contributes the same `bonsai` command and
`context-bonsai` skill, plus Droid-native `bonsai-reviewer` and
`bonsai-fixture-author` subagents.

## GitHub Copilot

GitHub Copilot uses repository custom instructions and reusable prompt files.
From a clone of this repository, copy the bundled `.github` tree into the
target repository:

```bash
TARGET=/path/to/your/repo
mkdir -p "$TARGET/.github"
cp -R plugins/context-bonsai/copilot/.github/. "$TARGET/.github/"
```

```powershell
$Target = "C:\path\to\your\repo"
New-Item -ItemType Directory -Force "$Target\.github" | Out-Null
Copy-Item -Recurse -Force "plugins\context-bonsai\copilot\.github\*" "$Target\.github\"
```

The Copilot bundle contributes:

- `.github/copilot-instructions.md` for repository-wide log-handling guidance.
- `.github/instructions/context-bonsai.instructions.md` scoped to log-like
  files.
- `.github/prompts/bonsai.prompt.md`, a reusable `/bonsai` prompt for
  compressing a log and reporting savings.

## Cursor

Cursor uses MDC rule files under `.cursor/rules`. Copy the ContextBonsai rule
into the target repository:

```bash
TARGET=/path/to/your/repo
mkdir -p "$TARGET/.cursor/rules"
cp plugins/context-bonsai/cursor/.cursor/rules/context-bonsai.mdc "$TARGET/.cursor/rules/"
```

```powershell
$Target = "C:\path\to\your\repo"
New-Item -ItemType Directory -Force "$Target\.cursor\rules" | Out-Null
Copy-Item -Force "plugins\context-bonsai\cursor\.cursor\rules\context-bonsai.mdc" "$Target\.cursor\rules\"
```

The rule is agent-requested and scoped to `*.log`, `*.out`, and `*.txt` files.
When Cursor sees a log-analysis task, it is instructed to compress first,
diagnose from the `.bonsai.log` output, and report the savings metrics.

## Codex

Codex reads project instructions from `AGENTS.md` and discovers repo-local
skills from `.codex/skills/*/SKILL.md`.

```bash
TARGET=/path/to/your/repo
mkdir -p "$TARGET/.codex/skills"
cp -R plugins/context-bonsai/codex/.codex/skills/context-bonsai "$TARGET/.codex/skills/"
test -f "$TARGET/AGENTS.md" || cp plugins/context-bonsai/codex/AGENTS.md "$TARGET/AGENTS.md"
```

```powershell
$Target = "C:\path\to\your\repo"
New-Item -ItemType Directory -Force "$Target\.codex\skills" | Out-Null
Copy-Item -Recurse -Force "plugins\context-bonsai\codex\.codex\skills\context-bonsai" "$Target\.codex\skills\"
if (-not (Test-Path "$Target\AGENTS.md")) { Copy-Item "plugins\context-bonsai\codex\AGENTS.md" "$Target\AGENTS.md" }
```

If the target project already has `AGENTS.md`, merge the ContextBonsai section
instead of replacing the file. The `context-bonsai` skill uses progressive
disclosure: Codex sees the skill name and description first, then loads the
full compression workflow only when the task involves logs.

## OpenCode

OpenCode reads project rules from `AGENTS.md`, discovers skills from
`.opencode/skills/*/SKILL.md`, and supports markdown custom commands under
`.opencode/commands`.

```bash
TARGET=/path/to/your/repo
mkdir -p "$TARGET/.opencode/skills" "$TARGET/.opencode/commands"
cp -R plugins/context-bonsai/opencode/.opencode/skills/context-bonsai "$TARGET/.opencode/skills/"
cp plugins/context-bonsai/opencode/.opencode/commands/bonsai.md "$TARGET/.opencode/commands/"
test -f "$TARGET/AGENTS.md" || cp plugins/context-bonsai/opencode/AGENTS.md "$TARGET/AGENTS.md"
```

```powershell
$Target = "C:\path\to\your\repo"
New-Item -ItemType Directory -Force "$Target\.opencode\skills", "$Target\.opencode\commands" | Out-Null
Copy-Item -Recurse -Force "plugins\context-bonsai\opencode\.opencode\skills\context-bonsai" "$Target\.opencode\skills\"
Copy-Item -Force "plugins\context-bonsai\opencode\.opencode\commands\bonsai.md" "$Target\.opencode\commands\"
if (-not (Test-Path "$Target\AGENTS.md")) { Copy-Item "plugins\context-bonsai\opencode\AGENTS.md" "$Target\AGENTS.md" }
```

If the target project already has `AGENTS.md`, merge the ContextBonsai section
instead of replacing the file. OpenCode can then invoke the skill on demand or
use the `/bonsai` command to compress a named log and summarize token savings.

## CLI prerequisite

Every plugin delegates the actual compression to the same CLI:

```bash
npm i -g context-bonsai
bonsai <input-log> -o <output-log> --stats
```

## Aggressiveness reference

All plugin prompts defer to the same aggressiveness levels as the CLI:

| Level        | Behavior                                                      |
| :----------- | :------------------------------------------------------------ |
| `low`        | Only drop DEBUG / TRACE / VERBOSE lines                       |
| `medium`     | Drop INFO, collapse adjacent duplicates                       |
| `high`       | Score relevance, promote context, dampen TF-IDF spam (default) |
| `aggressive` | Maximum compression: keep only errors and immediate context   |

## Troubleshooting

**Command not found** - Make sure `bonsai` or `context-bonsai` is on your
PATH after `npm i -g context-bonsai`. Verify with `bonsai --version`.

**Relative plugin path fails** - Add this repository as a Git-backed
marketplace. URL-only marketplace files do not download sibling plugin
directories referenced by relative paths.

**No savings reported** - The log may already be compact, or the
aggressiveness level may be too low. Try `aggressive` for maximum compression.
