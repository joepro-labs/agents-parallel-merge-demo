# Setup — one-time infra to make AGENTS.md actually work

`AGENTS.md` tells agents *how to behave*. It cannot, by itself, enable a merge
queue or change branch protection — those are repo settings. Run this once and
the "blocked for an hour" problem goes away.

Replace `OWNER/REPO` throughout.

## 1. Add the workflows
Copy `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` into your repo.
Adjust the `npm` steps and `scripts/deploy.sh` to your stack. Commit to `main`.

The non-negotiable bit: `ci.yml` MUST keep the `merge_group:` trigger, or the
merge queue can never go green.

## 2. Enable the merge queue + branch protection on `main`
Requires `gh` authenticated with admin on the repo.

```bash
# Require PR review, the merge queue, and ONLY the fast checks as required.
gh api -X PUT repos/OWNER/REPO/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["fast-checks"]}' \
  -F enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1}' \
  -F restrictions='' \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

Enable the merge queue (Settings → Branches → `main` → "Require merge queue", or
via API):

```bash
gh api -X POST repos/OWNER/REPO/branches/main/protection/required_status_checks \
  >/dev/null 2>&1 || true   # ensure required checks object exists first

# Merge queue settings: squash, batch up to 5 PRs per CI run, short wait.
gh api -X PATCH repos/OWNER/REPO \
  -F allow_merge_commit=false \
  -F allow_squash_merge=true \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true
```

> The merge-queue *grouping* settings (batch size, merge method, min/max wait)
> are configured under **Settings → Branches → main → Require merge queue** in the
> UI; GitHub exposes limited API control here, so set them once in the UI.

## 3. Make deploys coalesce, not queue
Already handled by the `concurrency: group: deploy-production` block in
`deploy.yml`. Do **not** add manual-approval reviewers to the `production`
environment if you want true high-volume CD — an approval gate re-introduces the
wait.

## 4. Add a feature-flag service
Any of LaunchDarkly / Unleash / Statsig / a config table. The only requirement:
flipping a flag is instant and deploy-free. This is what lets agents merge "dark"
code in any order without blocking.

## 5. Verify
- Open 3 trivial PRs from agents, approve, and `gh pr merge <n> --squash --auto`
  on all three. They should batch through the queue and land within one or two CI
  runs — none waits on a deploy.
- Confirm a push to `main` triggers exactly one `deploy` run, and a second quick
  push supersedes the first if it hasn't hit the irreversible step.

## Why this works (one paragraph)
The hour-long block is caused by coupling **merge** to a serialized **deploy**
(or by requiring slow checks to merge). Here, merging only needs fast checks and
goes through a batching queue, so any number of agents can land changes in
parallel. Deploys are separate, coalesce to the latest tip, and never gate a
merge. Releases are flag flips, not merges. So "many merges in quick succession"
costs a few coalesced deploys — never an hour-long stall.
