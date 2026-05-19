---
applyTo: "**/*.log,**/*.out,**/*.txt"
---

# LogStrip log handling

Before analyzing attached or referenced log files, compress them with:

```bash
logstrip <input-log> -o <input-log>.logstrip.log --stats
```

Use the compressed `.logstrip.log` file for diagnosis and include the savings stats in the response. If `logstrip` is missing, ask the user to install `logstrip` globally with npm.
