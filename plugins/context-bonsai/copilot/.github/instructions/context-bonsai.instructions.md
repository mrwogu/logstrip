---
applyTo: "**/*.log,**/*.out,**/*.txt"
---

# ContextBonsai log handling

Before analyzing attached or referenced log files, compress them with:

```bash
bonsai <input-log> -o <input-log>.bonsai.log --stats
```

Use the compressed `.bonsai.log` file for diagnosis and include the savings stats in the response. If `bonsai` is missing, ask the user to install `context-bonsai` globally with npm.
