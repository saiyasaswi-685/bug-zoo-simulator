# Evidence Directory

This directory intentionally starts empty (aside from this file).

A previous senior code review found that the evidence files that used to
live here (`json_logs.txt`, `api_headers.txt`, `prometheus_metrics.txt`)
were **not genuine output** - for example they showed a `"level":"warn"`
log line for a 400 response, which the actual code cannot produce (the
error handler only ever calls `logger.error`, never `logger.warn`, prior to
this fix round). They also linked to a local Windows-only file path,
suggesting they were hand-authored rather than captured.

Those files have been removed rather than replaced with new hand-written
samples, to avoid repeating the same problem.

## Generating real evidence

Run the app for real and capture its actual output with:

```bash
npm install
npm run build
npm run capture-evidence
```

This runs `scripts/capture-evidence.sh`, which boots the real server on a
temporary SQLite database, lets the simulation engine generate real events,
and uses `curl` to hit `/events`, `/stats`, `/metrics`, an invalid-severity
400 case, and a 404 case - writing the real responses, real response
headers, and real captured stdout JSON logs into this directory.

This could not be run inside the environment used to produce this fix
(no network access to install dependencies, so the app cannot actually be
started there) - see the top-level README's "Known Limitations of This
Fix Pass" section for details.
