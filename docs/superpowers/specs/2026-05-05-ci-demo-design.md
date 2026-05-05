# CI Demo — Azure Pipeline + Demo Push

**Date:** 2026-05-05
**Branch:** `demo/cloud-computing`

## Goal

Enable a live CI/CD demonstration for a cloud computing class. During the demo, a small code change is committed and pushed to `demo/cloud-computing`, triggering the Azure DevOps pipeline. The audience watches Build → Deploy_Demo go green while the presenter covers slides.

## Changes

### 1. `azure-pipelines.yml`

**Trigger:** Add `demo/cloud-computing` to `trigger.branches.include` so pushes to this branch fire the pipeline.

**ADVISOR_SIGNUP_CODE:** Add the following to the `.env.local` write script in every stage that fetches Key Vault secrets (Build, Deploy_Dev, Deploy_Prod, Deploy_Demo):
- Key Vault secret name: `ADVISOR-SIGNUP-CODE`
- Environment variable: `ADVISOR_SIGNUP_CODE`

**Deploy_Demo stage:** New stage added after Build:
- `dependsOn: Build`
- `condition: and(succeeded(), eq(variables['Build.SourceBranchName'], 'demo/cloud-computing'))`
- `environment: dev`
- Pool: `gradtracker-agents`, agent `GradTracker-dev-vm`
- Variable group: `gradtracker-dev-vars`
- Steps: fetch secrets from `GradTracker-dev-kv`, write `.env.local`, copy build artifacts to `/var/www/gradtracker`, run `npm ci --omit=dev`, restart app with pm2

### 2. `src/app/demo/page.tsx`

Change the `"Beta"` badge label to `"Demo"`. This is the visible change pushed on stage to trigger the pipeline.

## Pipeline Flow (on push to `demo/cloud-computing`)

```
Push → Build (install → Key Vault secrets → npm run build → publish artifacts)
     → Deploy_Demo (copy artifacts → write .env.local → npm ci → pm2 restart)
```

Deploy_Dev and Deploy_Prod stages are skipped (branch condition does not match).

## What the Audience Sees

1. Presenter makes the badge text change, commits, and pushes on stage
2. Switches to Azure DevOps — pipeline queues and starts
3. Presenter covers slides while Build runs
4. Returns to Azure DevOps — Build green, Deploy_Demo green
5. Live hosted app shows updated badge text
