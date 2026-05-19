---
title: AI Agent Plugins for Log Compression
description: Install LogStrip plugins for Claude Code, Copilot, Cursor, Factory Droid, Codex, and OpenCode. Compress-first workflow so every agent receives smaller, higher-signal logs.
---
# Agent Plugins

LogStrip is CLI-first, but the repository ships plugin/config bundles for
every agent shown on the documentation homepage: Claude Code, Factory Droid,
GitHub Copilot, Cursor, Codex, and OpenCode.

## How the plugins improve agent efficiency

All bundles teach the agent to run `logstrip` before it reasons over a raw log.
That gives the agent a smaller, higher-signal file plus measurable savings from
`--stats`.

| Efficiency lever       | What the plugin does                                                    | Agent impact                                           |
| :--------------------- | :--------------------------------------------------------------------- | :----------------------------------------------------- |
| Smaller context        | Runs `logstrip <input> -o <output> --stats` before diagnosis              | Fewer log tokens compete with stack traces and errors  |
| Less repetition        | Collapses duplicates and internal stack frames                          | The model spends attention on unique failure evidence  |
| Safer sharing          | Keeps full raw logs out of chat unless explicitly requested             | Lower risk of copying noisy or sensitive log material  |
| Measurable ROI         | Reports input/output token estimates and `savingsPercent`               | Teams can see how much context budget was recovered    |
| Repeatable workflow    | Provides marketplace manifests, commands, rules, skills, or `AGENTS.md` instructions per agent | Every agent follows the same compression-first pattern |

If `--stats` reports `inputTokens=18000` and `outputTokens=4500`, the agent
receives 75% less log context while still preserving diagnostic lines.

## Choose your agent

Start with the agent your team already uses. All paths below install the same
compression-first workflow; they only differ in how each agent discovers
plugin manifests, commands, rules, skills, or repo instructions.

| Agent | Install surface | What you get | Start here |
| :--- | :--- | :--- | :--- |
| Claude Code | Git-backed plugin marketplace | `/logstrip`, `logstrip` skill, reviewer/fixture agents | [Claude Code](#claude-code) |
| Factory Droid | Droid plugin marketplace | `/logstrip`, `logstrip` skill, reviewer/fixture droids | [Factory Droid](#factory-droid) |
| GitHub Copilot | Git-backed Copilot plugin marketplace | `/logstrip`, `logstrip` skill, reviewer/fixture agents | [GitHub Copilot](#github-copilot) |
| Cursor | Cursor plugin marketplace | log rule, `logstrip` skill, `/logstrip` command, agents | [Cursor](#cursor) |
| Codex | Codex plugin marketplace | progressive log-compression skill | [Codex](#codex) |
| OpenCode | OpenCode-native skill and command bundle | skill plus `/logstrip` command | [OpenCode](#opencode) |

## Install the CLI first

Every plugin delegates the actual compression to the same zero-dependency CLI:

```bash
npm i -g logstrip
logstrip <input-log> -o <output-log> --stats
```

If global installs are not allowed, use `npx -y logstrip` in the command
or prompt template for your agent.

## Claude Code

Add the Git-backed marketplace, then install the plugin:

```text
/plugin marketplace add https://github.com/mrwogu/logstrip
/plugin install logstrip@logstrip
```

For local development from a clone of this repository:

```text
/plugin marketplace add .
/plugin install logstrip@logstrip
```

The plugin contributes a `logstrip` command, a `logstrip` skill, and two
LogStrip-focused agents. Install the CLI before using the command:

```bash
npm i -g logstrip
```

## Factory Droid

Add the Droid marketplace, then install the plugin:

```bash
droid plugin marketplace add https://github.com/mrwogu/logstrip
droid plugin install logstrip@logstrip
```

For local development from a clone of this repository:

```bash
droid plugin marketplace add .
droid plugin install logstrip@logstrip
```

The Droid plugin contributes the same `logstrip` command and
`logstrip` skill, plus Droid-native `logstrip-reviewer` and
`logstrip-fixture-author` subagents.

## GitHub Copilot

GitHub Copilot supports Git-backed plugins. Add the LogStrip marketplace,
then install the plugin:

```bash
copilot plugin marketplace add https://github.com/mrwogu/logstrip
copilot plugin install logstrip@logstrip
```

For local development from a clone of this repository:

```bash
copilot plugin marketplace add .
copilot plugin install logstrip@logstrip
```

The Copilot bundle contributes:

- `commands/logstrip.md` as a reusable `/logstrip` workflow.
- `skills/logstrip/SKILL.md` for progressive log-compression guidance.
- `agents/*` for LogStrip-focused review and fixture tasks.

The repository still includes `.github` instruction and prompt templates under
`plugins/logstrip/copilot/` for teams that intentionally want committed
repo instructions, but normal Copilot plugin installation does not require
copying those files.

## Cursor

Cursor supports plugin manifests. LogStrip includes
`.cursor-plugin/marketplace.json` at the repository root and
`.cursor-plugin/plugin.json` inside the plugin bundle, so teams can import this
GitHub repository through Cursor's plugin marketplace flow.

For local testing from a clone:

```bash
mkdir -p ~/.cursor/plugins/local
ln -s /absolute/path/to/logstrip/plugins/logstrip ~/.cursor/plugins/local/logstrip
```

The Cursor plugin contributes a log-scoped MDC rule, the shared
`logstrip` skill, `/logstrip` command, and helper agents. The legacy
`.cursor/rules/logstrip.mdc` bundle remains available only for teams that
prefer committing a single rule file to a repository.

## Codex

Codex supports repo and personal plugin marketplaces. Add the LogStrip
marketplace, then open the plugin browser and install `logstrip`:

```bash
codex plugin marketplace add https://github.com/mrwogu/logstrip
codex
/plugins
```

For local development from a clone:

```bash
codex plugin marketplace add /absolute/path/to/logstrip
codex
/plugins
```

The Codex plugin uses `.agents/plugins/marketplace.json` plus
`.codex-plugin/plugin.json`. It exposes the `logstrip` skill with
progressive disclosure: Codex sees the skill name and description first, then
loads the full compression workflow only when the task involves logs.

## OpenCode

OpenCode's plugin system is for JavaScript/TypeScript hook modules loaded from
`.opencode/plugins/` or from npm via `opencode.json`. LogStrip's OpenCode
integration is intentionally a native skill and command bundle because the
workflow is "compress this log before analysis", not a lifecycle hook.

```bash
TARGET=/path/to/your/repo
mkdir -p "$TARGET/.opencode/skills" "$TARGET/.opencode/commands"
cp -R plugins/logstrip/opencode/.opencode/skills/logstrip "$TARGET/.opencode/skills/"
cp plugins/logstrip/opencode/.opencode/commands/logstrip.md "$TARGET/.opencode/commands/"
test -f "$TARGET/AGENTS.md" || cp plugins/logstrip/opencode/AGENTS.md "$TARGET/AGENTS.md"
```

```powershell
$Target = "C:\path\to\your\repo"
New-Item -ItemType Directory -Force "$Target\.opencode\skills", "$Target\.opencode\commands" | Out-Null
Copy-Item -Recurse -Force "plugins\logstrip\opencode\.opencode\skills\logstrip" "$Target\.opencode\skills\"
Copy-Item -Force "plugins\logstrip\opencode\.opencode\commands\logstrip.md" "$Target\.opencode\commands\"
if (-not (Test-Path "$Target\AGENTS.md")) { Copy-Item "plugins\logstrip\opencode\AGENTS.md" "$Target\AGENTS.md" }
```

If the target project already has `AGENTS.md`, merge the LogStrip section
instead of replacing the file. OpenCode can then invoke the skill on demand or
use the `/logstrip` command to compress a named log and summarize token savings.

## Bundle contents

Most users only need the install steps above. If you are packaging or auditing
the plugin bundle, these are the shipped integration files:

??? info "Repository layout"

    ```text
    .agents/
      plugins/
        marketplace.json
    .claude-plugin/
      marketplace.json
    .cursor-plugin/
      marketplace.json
    .factory-plugin/
      marketplace.json
    .github/
      plugin/
        marketplace.json
    plugins/
      logstrip/
        .claude-plugin/
          plugin.json
        .codex-plugin/
          plugin.json
        .cursor-plugin/
          plugin.json
        .factory-plugin/
          plugin.json
        .github/
          plugin/
            plugin.json
        rules/
          logstrip.mdc
        copilot/
          .github/
            copilot-instructions.md
            instructions/
              logstrip.instructions.md
            prompts/
              logstrip.prompt.md
        cursor/
          .cursor/
            rules/
              logstrip.mdc
        codex/
          AGENTS.md
          .codex/
            skills/
              logstrip/
                SKILL.md
        opencode/
          AGENTS.md
          .opencode/
            commands/
              logstrip.md
            skills/
              logstrip/
                SKILL.md
        commands/
          logstrip.md
        skills/
          logstrip/
            SKILL.md
        agents/
          logstrip-reviewer.md
          logstrip-fixture-author.md
        droids/
          logstrip-reviewer.md
          logstrip-fixture-author.md
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

**Command not found** - Make sure `logstrip` or `logstrip` is on your
PATH after `npm i -g logstrip`. Verify with `logstrip --version`.

**Plugin does not appear after install** - Restart the agent and confirm it is
reading the marketplace file for that ecosystem: `.github/plugin/marketplace.json`
for Copilot, `.cursor-plugin/marketplace.json` for Cursor, or
`.agents/plugins/marketplace.json` for Codex.

**No savings reported** - The log may already be compact, or the
aggressiveness level may be too low. Try `aggressive` for maximum compression.
