# AGENTS.md — High-volume parallel merge & deploy

This file tells coding agents (and humans) how to ship many changes into `main`
in quick succession **without getting blocked for an hour**.

> Read this first: the hour-long block is *not* something an `AGENTS.md` can fix
> by itself. The block comes from how merges and deploys are wired in CI/CD. This
> file has two parts:
> 1. **Agent rules** — how every agent must behave so the pipeline stays fast.
> 2. **Required repo configuration** — the infra changes that actually remove the
>    block. The agent rules only work once this config is in place. The matching
>    GitHub config lives in `.github/workflows/` next to this file.

The one idea behind everything below: **decouple "merge" from "release."**
Merging into `main` must be cheap, parallel, and non-blocking. Turning a feature
on for users is a separate, flag-controlled decision. Deploys continuously ship
the *tip* of `main`, so ten merges in a minute cost one (or a few) deploys, not
ten serialized hour-long ones.

---

## Part 1 — Agent rules (follow these on every task)

### 1. One change = one small PR
- Keep each PR small and independently shippable. Big PRs serialize the queue and
  block everyone.
- Never bundle unrelated changes. Split them into separate PRs that can merge in
  parallel.

### 2. Always go through the merge queue — never push to `main`
- `main` is protected. You **cannot** push directly and you must not try.
- When CI is green and the PR is approved, add the change to the queue:
  ```bash
  gh pr merge <number> --squash --auto
  ```
  `--auto` enqueues the PR; GitHub's merge queue rebases it on the current `main`,
  runs the **`merge_group`** checks, and merges it when they pass. Multiple agents
  can enqueue at the same time — the queue batches and orders them. You do **not**
  wait an hour; you enqueue and move on to your next task.
- Do **not** "merge then immediately trigger a deploy." Merging is all you do.
  Deployment happens on its own (see Part 2).

### 3. Make merges safe to land in any order — use feature flags
- Anything user-visible or risky ships **behind a flag, defaulted OFF.** Merging
  "dark" code is always safe, so the queue never has to block to protect prod.
- A "release" = flipping the flag on, done separately from the merge. Never gate a
  *merge* on a feature being ready to launch.
- Code behind an OFF flag must be a no-op: no schema-incompatible writes, no
  breaking API changes without a compatibility shim.

### 4. Keep required checks fast (< ~5 min)
- Only fast, deterministic checks are *required* to merge: lint, typecheck, unit
  tests, build. These run on both `pull_request` and `merge_group`.
- Heavy/slow checks (full e2e, load, visual) run **after** merge against `main`,
  or nightly — they must not gate the queue.
- If you add a slow test, mark it non-required. A flaky or slow required check is
  what turns "quick succession" into "blocked for an hour."

### 5. Rebase forward, never hold the queue hostage
- Keep branches short-lived. Rebase onto `main` before enqueuing so the merge
  queue's rebase is trivial.
- If your PR fails in the queue, it is dropped from the queue automatically. Fix
  it on your branch and re-enqueue — do not block the queue while debugging.

### 6. Migrations are expand → migrate → contract
- Database/schema changes ship in **backward-compatible** steps so deploys never
  need a lock or a "stop the world" window:
  1. **Expand**: add new columns/tables/fields, nullable/defaulted. Deploy.
  2. **Migrate**: backfill + dual-write behind a flag. Deploy.
  3. **Contract**: remove the old path only after the new one is fully live.
- Never ship a migration that makes old running code crash. That is the other
  classic cause of "we have to serialize and lock deploys."

### 7. Deploys are idempotent "deploy the latest tip"
- A deploy always ships the **current** `main` SHA, not "the SHA of my PR."
- This is why quick-succession merges don't fan out into N hour-long deploys: the
  deploy worker coalesces and ships whatever is newest. Do not author deploy steps
  that assume a 1:1 PR→deploy mapping.

### 8. Roll forward, don't roll back
- If a flagged feature misbehaves, **turn the flag off** (instant, no deploy).
- Fixes go through the same fast queue. Avoid emergency manual deploys that bypass
  the pipeline — those re-introduce the lock you are trying to escape.

---

## Part 2 — Required repo configuration (the actual fix)

The agent rules above only deliver "quick succession, no hour-long block" if the
repo is wired like this. Set these once.

### A. Branch protection on `main`
- Require pull request + at least one approval.
- **Require a merge queue.**
- Required status checks: only the fast ones (`lint`, `test`, `build`) — and they
  must be the checks that run on the `merge_group` event.
- Disallow direct pushes (including admins, ideally).

### B. Enable GitHub Merge Queue
- Repo/branch setting: **"Require merge queue."**
- Queue settings: allow batching (merge multiple PRs per CI run), set a sensible
  max batch size and merge method (squash recommended).
- The CI workflow MUST trigger on `merge_group` or the queue can never go green.
  See `.github/workflows/ci.yml`.

### C. Decoupled, coalescing deploy pipeline
- Deploys trigger on `push` to `main` and **deploy the tip of `main`**.
- Use a **concurrency group** so deploys don't pile up: a newer push supersedes a
  not-yet-started deploy instead of queuing behind it. Once a deploy reaches its
  irreversible step it finishes; the next push deploys the newest tip afterward.
- Result: 10 merges in a minute → ~1–2 deploys of the latest code, not 10.
- See `.github/workflows/deploy.yml`.

### D. Feature-flag service
- Any flag system (LaunchDarkly, Unleash, Statsig, or a config table). The only
  requirement: flipping a flag is **instant and deploy-free**.

### E. Fast CI
- Cache dependencies and build artifacts. Parallelize test shards. Target < 5 min
  for the required checks. Slow required checks are the #1 cause of the block.

---

## Anti-patterns that cause the "blocked for an hour" symptom

| Symptom | Root cause | Fix |
| --- | --- | --- |
| Each merge kicks a serialized deploy; next merge waits | Merge gated on deploy; deploy holds an env lock | Decouple — merge requires CI only; deploy coalesces (Part 2C) |
| PRs merge one-at-a-time, slowly | No merge queue / no batching | Enable merge queue with batching (Part 2B) |
| Queue stalls for a long time | A slow or flaky check is *required* | Make heavy checks non-required, run post-merge (rule 4) |
| Can't merge until a release "finishes" | Releasing == merging | Feature flags; release = flip flag, not merge (rule 3) |
| Deploys must lock to avoid breaking prod | Backward-incompatible migrations | Expand→migrate→contract (rule 6) |

---

## TL;DR for agents
1. Small PR → green fast CI → `gh pr merge --squash --auto` → move on.
2. Risky code ships behind an OFF flag.
3. Never push to `main`, never trigger a manual deploy, never make a slow check required.
4. Deploys ship the latest tip automatically and coalesce — you don't manage them.
