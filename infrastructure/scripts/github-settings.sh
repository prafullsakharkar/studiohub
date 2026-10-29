#!/usr/bin/env bash
#
# Repository-host settings the repository itself cannot enforce (TPN review TM-016, docs/10-security/repository-controls.md).
#
#   github-settings.sh            show the current state and what would change (changes nothing)
#   github-settings.sh --apply    apply it
#
# Needs the GitHub CLI logged in as someone who administers the repository. Environment:
#   REPO              owner/name (default: taken from the git remote)
#   PROTECT_BRANCHES  branches to protect (default: "main develop")
#   REQUIRED_REVIEWS  approving reviews required on a pull request (default 1; 0 = no review requirement,
#                     for a repository with one maintainer)
#
# The protection blocks force pushes and deletion of the protected branches and requires the CI checks to
# pass on pull requests. Administrators are NOT forced to follow it (enforce_admins=false), so an owner can
# still push directly; set ENFORCE_ADMINS=true to remove that exception.

set -euo pipefail

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

REPO="${REPO:-$(git remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')}"
BRANCHES="${PROTECT_BRANCHES:-main develop}"
REVIEWS="${REQUIRED_REVIEWS:-1}"
ENFORCE="${ENFORCE_ADMINS:-false}"
CHECKS='["Backend (ruff + pytest)","Secret scan (gitleaks)","Docs (link check)"]'

command -v gh >/dev/null || { echo "gh (GitHub CLI) is required" >&2; exit 1; }

say() { printf '%s\n' "$*"; }
do_or_say() {
    if [ "$APPLY" = 1 ]; then "$@"; else say "  would run: $*"; fi
}

say "Repository: $REPO  (mode: $([ "$APPLY" = 1 ] && echo APPLY || echo "dry run"))"
say
say "Current state"
gh api "repos/$REPO" --jq '"  visibility: " + (if .private then "private" else "PUBLIC" end)
  + "\n  secret scanning: " + .security_and_analysis.secret_scanning.status
  + "\n  push protection: " + .security_and_analysis.secret_scanning_push_protection.status
  + "\n  dependabot security updates: " + .security_and_analysis.dependabot_security_updates.status'
if gh api "repos/$REPO/vulnerability-alerts" -i 2>/dev/null | head -1 | grep -q 204; then
    say "  dependabot alerts: enabled"
else
    say "  dependabot alerts: DISABLED"
fi
for b in $BRANCHES; do
    if gh api "repos/$REPO/branches/$b/protection" >/dev/null 2>&1; then
        say "  branch $b: protected"
    else
        say "  branch $b: NOT protected"
    fi
done
say
say "Changes"

say "- Dependabot alerts"
do_or_say gh api -X PUT "repos/$REPO/vulnerability-alerts"

say "- Dependabot security updates"
do_or_say gh api -X PUT "repos/$REPO/automated-security-fixes"

say "- Private vulnerability reporting (the route named in SECURITY.md)"
do_or_say gh api -X PUT "repos/$REPO/private-vulnerability-reporting"

if [ "$REVIEWS" -gt 0 ]; then
    PR='{"required_approving_review_count": '"$REVIEWS"', "require_code_owner_reviews": true, "dismiss_stale_reviews": true}'
else
    PR=null
fi

for b in $BRANCHES; do
    say "- Protect branch $b (no force push, no deletion, checks must pass$([ "$REVIEWS" -gt 0 ] && echo ", $REVIEWS review(s) with code owner"))"
    BODY='{"required_status_checks": {"strict": false, "contexts": '"$CHECKS"'},
           "enforce_admins": '"$ENFORCE"',
           "required_pull_request_reviews": '"$PR"',
           "restrictions": null,
           "allow_force_pushes": false,
           "allow_deletions": false,
           "required_linear_history": false}'
    if [ "$APPLY" = 1 ]; then
        printf '%s' "$BODY" | gh api -X PUT "repos/$REPO/branches/$b/protection" --input - >/dev/null
        say "  applied"
    else
        say "  would PUT repos/$REPO/branches/$b/protection"
    fi
done

[ "$APPLY" = 1 ] || { say; say "Nothing was changed. Re-run with --apply to make these changes."; }
