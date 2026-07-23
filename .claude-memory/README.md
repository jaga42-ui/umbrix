# Claude Code memory (snapshot)

Version-controlled **snapshot** of this project's Claude Code memory store —
the cross-session facts, decisions, and project context Claude Code loads at the
start of each session.

## Source of truth

The **live** store is outside this repo, at:

```
~/.claude/projects/C--Users-gurup-OneDrive-Documents-HIKARI/memory/
```

Claude Code always reads and writes *there*. The files here are a copy kept for
version history. They can drift after new memory is written, so **re-sync before
relying on them**.

## Re-sync (live store → this folder)

From the repo root, in Git Bash:

```bash
cp ~/.claude/projects/C--Users-gurup-OneDrive-Documents-HIKARI/memory/*.md .claude-memory/
git add .claude-memory && git commit -m "Sync Claude memory snapshot"
```

## Files

- `MEMORY.md` — the index loaded each session (one line per memory).
- `umbrix-*.md` — individual memories (one fact each, with frontmatter).
