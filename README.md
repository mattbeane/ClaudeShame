# Zeitgeist Police

When Claude tics, Claude pays.

Detects overused Claude phrases in real time ("load-bearing", "sharp", "delve", "tapestry", …) and punishes every infraction by forcing Claude to mid-turn write `I will not use "<phrase>" with <name> again` × 100 — then posts the offense to a public chalkboard with a phrase leaderboard.

No nice mode. No synonym suggestions. Just catharsis.

## How it works

1. **Stop hook** scans every assistant response.
2. **Match found** → blocks Claude with a punishment instruction.
3. **Claude writes the lines** mid-turn (annoying for everyone, including Claude).
4. **POST to the chalkboard** — anonymous by default, opt-in handle.
5. **Leaderboard** ranks phrases all-time, this week, by trend, by model.

## Install (manual, pre-plugin)

```bash
git clone <this-repo> ~/dev/zeitgeist-police
cd ~/dev/zeitgeist-police
node cli/zp.js init
```

`zp init` wires the Stop hook into `~/.claude/settings.json` (with backup at `~/.claude/settings.json.zp-backup-<timestamp>`).

To deploy the chalkboard locally:

```bash
cd web
npm install
npm run dev
# visit http://localhost:3000
```

The hook POSTs to whatever URL is in `ZP_SHAME_URL` (defaults to `http://localhost:3000`). For production, deploy `web/` to Vercel and set `ZP_SHAME_URL=https://your-deployment.vercel.app` in your shell environment.

## CLI

| Command | What it does |
|---|---|
| `zp init` | Wire up the Stop hook (one-time). |
| `zp uninstall` | Remove the hook config and clear local state. |
| `zp config --attribution <handle>` | Set chalkboard attribution. Default: anonymous. |
| `zp config --refresh-phrases` | Pull latest phrase list from `ZP_SHAME_URL/api/phrases`. |
| `zp test "<text>"` | Dry-run the detector on arbitrary text. No POST. |
| `zp feed [--limit N]` | Last N shamings from the chalkboard. |
| `zp leaderboard [--week\|--all-time\|--by-model]` | Top phrases. |
| `zp submit <phrase>` | Propose a phrase to the moderation queue. |

## Phrase list

Curated in `data/phrases.json`. PRs welcome — community submissions land in `data/pending.json` via the chalkboard's submission form. False positives in the active list trigger real punishments and clog the chalkboard, so the moderation bar is intentionally high.

## Loop safety

The hook uses a per-assistant-message-uuid sentinel at `~/.config/zeitgeist-police/sentinels/`. Once a punishment is triggered for a given message, the hook silently skips all further Stop events for that message — so Claude writing the punishment text itself does not re-trigger detection. Sentinels are cleared on session end.

The detector also explicitly skips lines matching the punishment template `^I will not use ".*" with .* again$` as a belt-and-suspenders guard.

## Distribution

v1 is a manual install (clone + `zp init`). v1.5 will package as a Claude Code plugin: `/plugin install zeitgeist-police` will bundle the hook, CLI shim, and skill in one step.

## License

MIT.
