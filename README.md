# pi-enchant

Personal configuration and behavioral guidelines for the [pi coding agent](https://github.com/earendil-works/pi-coding-agent), kept in git so they can be restored on any machine.

## What's in here

| File | Purpose |
| --- | --- |
| `init.sh` | One-shot setup script for a fresh `~/.pi` directory |
| `agent/APPEND_SYSTEM.md` | Behavioral guidelines appended to pi's system prompt |
| `agent/extensions/streaming-error-continue.ts` | Custom pi extension |
| `LICENSE` | License |

## Setup on a new machine

If `~/.pi` already exists (it will, once pi has run at least once), bootstrap everything with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/a-chris/pi-enchant/main/init.sh | bash
```

Or, if you prefer to inspect the script first:

```bash
curl -fsSL https://raw.githubusercontent.com/a-chris/pi-enchant/main/init.sh -o /tmp/init.sh
less /tmp/init.sh
bash /tmp/init.sh
```

To use a directory other than `~/.pi`:

```bash
bash /tmp/init.sh /path/to/pi
```

### What the script does

1. `git init -b main` in `~/.pi` (skipped if a repo already exists)
2. Adds `origin` pointing at this repo and fetches it
3. Points local `main` at `origin/main` **without touching any existing local files** — `auth.json`, `sessions/`, memory stores, etc. are left exactly as they are
4. Sets up upstream tracking so plain `git pull` works afterwards
5. Restores the tracked files (`agent/APPEND_SYSTEM.md`, extensions, …) into the working tree

The script is idempotent and safe to re-run at any time. If local `main` has commits that diverge from the remote, it stops and asks you to reconcile (override with `FORCE=1`).

## Pulling updates later

```bash
cd ~/.pi
git pull
```
