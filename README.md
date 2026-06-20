# agents-parallel-merge-demo

A **working** answer to: *"My agents should be able to deploy multiple releases
(merge into `main`) in quick succession without getting completely blocked for an
hour."*

This repo is a live demo. The merge queue is enabled, `main` is protected, and
the deploy is decoupled — so any number of agents can land PRs in parallel and
the pipeline never serializes behind an hour-long deploy.

## The fix in one line
**Decouple merge from release.** Merging needs only fast CI + a batching merge
queue, so PRs land in parallel; deploys run separately, coalesce to the latest
tip of `main`, and never gate a merge; a "release" is flipping a feature flag —
not merging.

## What's here
- **[AGENTS.md](./AGENTS.md)** — the rules agents follow (small PRs, enqueue with
  `gh pr merge --squash --auto`, never push to `main`, flag risky code, keep
  required checks fast) + the repo config it depends on + an anti-pattern table.
- **[SETUP.md](./SETUP.md)** — one-time commands to enable the merge queue +
  branch protection on any repo.
- **[.github/workflows/ci.yml](./.github/workflows/ci.yml)** — fast required
  checks, triggered on `pull_request` **and `merge_group`** (the bit people miss —
  without `merge_group` the queue can never go green).
- **[.github/workflows/deploy.yml](./.github/workflows/deploy.yml)** — deploy
  decoupled from merge, with `concurrency: deploy-production` so deploys coalesce
  instead of queuing.

## Why an `AGENTS.md` alone isn't enough
An `AGENTS.md` is instructions to agents. The "blocked for an hour" symptom lives
in **repo/CI config** — branch protection, merge queue, deploy concurrency. This
repo ships both: the behavior rules *and* the infra that makes them real. Anyone
handing you only a markdown file is overselling.

## Constraints worth knowing
- GitHub's **merge queue is organization-owned-repos only** (free for public org
  repos; private needs Team/Enterprise). That's why this demo lives under an org.
- The required CI checks must run on the `merge_group` event or the queue stalls.

## Verify it yourself
1. Fork this repo into an org.
2. Run the commands in [SETUP.md](./SETUP.md) to turn on the queue + protection.
3. Open a few trivial PRs and `gh pr merge <n> --squash --auto` them at once —
   watch them batch through the queue and land without blocking, then a single
   coalesced deploy ship the latest tip.
