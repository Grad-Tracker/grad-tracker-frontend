# Old vs New Session Benchmark

## Purpose
Replay benchmark for student read flows comparing:
- baseline table-read behavior (`old`, modeled from commit `1d8ff02`)
- current view-read behavior (`new`, `feat/views` HEAD)

Outputs:
- flow load-time metrics (`p50`, `p95`)
- per-query latency traces
- speed-up calculations
- estimated monthly cost delta (compute + egress + request proxy)

## Flows Covered
- `requirements_index`
- `requirements_detail`
- `courses_catalog`
- `planner_bundle`
- `class_history_bundle`
- `onboarding_bundle`

## Requirements
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (recommended)
- optionally:
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `--allow-anon=true`
  - rate card JSON (`scripts/perf/rate-card.example.json`)
  - log export JSON/JSONL for traffic derivation

## Run
```bash
npm run perf:benchmark -- \
  --baseline-commit 1d8ff02 \
  --sample-size 5 \
  --cold-runs 1 \
  --warm-runs 3 \
  --passes 2 \
  --max-extra-passes 1 \
  --variance-threshold 0.15 \
  --rate-card-file scripts/perf/rate-card.example.json \
  --log-file path/to/supabase-logs.jsonl \
  --log-window-days 14
```

Optional manual volume override:
```bash
npm run perf:benchmark -- \
  --traffic-volume-file scripts/perf/traffic-volume.example.json
```

## Artifacts
Generated under `docs/performance/reports/<timestamp>-old-vs-new/`:
- `report.md`
- `flow_runs.json`, `flow_runs.csv`
- `query_events.json`, `query_events.csv`
- `flow_summary_warm.json`, `flow_summary_cold.json`
- `speedup_summary.json`, `speedup_summary.csv`
- `cost_summary.json`, `cost_summary.csv`
- `traffic_summary.json`
- `run_metadata.json`

## Notes
- Cost results are estimates, not invoice-exact per-query billing.
- Outlier filtering uses IQR (`Q1/Q3`, `1.5*IQR`) on flow duration per flow+mode.
- Pass variance check compares adjacent pass speed-up ratios and auto-reruns when threshold is exceeded.
