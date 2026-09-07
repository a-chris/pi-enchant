#!/usr/bin/env bash
#
# init.sh — Set up the pi-enchant git repo from scratch in a ~/.pi directory.
#
# Safe for a directory that already contains pi agent files (auth.json,
# sessions, memory, etc.): none of them are touched or overwritten. Only the
# files tracked in the remote repo (LICENSE, agent/APPEND_SYSTEM.md,
# agent/extensions/*.ts, ...) are restored into the working tree.
#
# Usage:
#   ./init.sh              # sets up git in ~/.pi (default)
#   ./init.sh /path/to/pi  # sets up git in another directory
#
# Idempotent: safe to re-run at any time.

set -euo pipefail

REPO_URL="https://github.com/a-chris/pi-enchant.git"
PI_DIR="${1:-$HOME/.pi}"

cd "$PI_DIR"

echo "==> Setting up git repo in $PI_DIR"

# 1. Initialize the repo if it doesn't exist yet.
if [ ! -e .git ]; then
    git init -b main
fi

# 2. Make sure we are on branch 'main'.
current_branch="$(git branch --show-current)"
if [ "$current_branch" != "main" ]; then
    git checkout -B main
fi

# 3. Add the remote if it's missing; otherwise make sure it points at the right URL.
if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "$REPO_URL"
elif [ "$(git remote get-url origin)" != "$REPO_URL" ]; then
    git remote set-url origin "$REPO_URL"
fi

# 4. Fetch the remote.
echo "==> Fetching $REPO_URL"
git fetch origin

# 5. Point local 'main' at origin/main WITHOUT touching local untracked files.
if git rev-parse --verify HEAD >/dev/null 2>&1; then
    # Branch already has commits.
    if git merge-base --is-ancestor origin/main HEAD; then
        echo "==> Local main already contains origin/main — leaving branch pointer alone."
    elif [ "${FORCE:-0}" = "1" ]; then
        echo "==> FORCE=1: resetting local main to origin/main (old commits stay in reflog)."
        git reset --mixed origin/main
    else
        echo "ERROR: local main has commits that diverge from origin/main." >&2
        echo "       Re-run with FORCE=1 to reset local main to origin/main," >&2
        echo "       or reconcile manually (e.g. git pull --rebase)." >&2
        exit 1
    fi
else
    # Fresh branch with no commits — just adopt the remote state.
    git reset --mixed origin/main
fi

# 6. Track origin/main so plain 'git pull' works later.
git branch --set-upstream-to=origin/main main

# 7. Restore the tracked files into the working tree (local untracked files
#    like auth.json, sessions/, memory are not affected).
git checkout -- . || true

echo "==> Done. Tracked files now in the working tree:"
git ls-tree -r --name-only origin/main
