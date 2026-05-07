#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const SHAME_URL = process.env.ZP_SHAME_URL || 'https://claudeshame.vercel.app';
const CONFIG_DIR = path.join(os.homedir(), '.config', 'claude-shame');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const PHRASES_PATH = path.join(CONFIG_DIR, 'phrases.json');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_PATH = path.join(REPO_ROOT, 'hooks', 'claude-shame.py');
const BUNDLED_PHRASES = path.join(REPO_ROOT, 'web', 'data', 'phrases.json');

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'init': return cmdInit();
    case 'uninstall': return cmdUninstall();
    case 'config': return cmdConfig(rest);
    case 'feed': return cmdFeed(rest);
    case 'leaderboard': return cmdLeaderboard(rest);
    case 'test': return cmdTest(rest);
    case 'submit': return cmdSubmit(rest);
    case 'help': case '--help': case '-h': case undefined: return printHelp();
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } };
const writeJson = (p, obj) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); };

async function cmdInit() {
  ensureDir(CONFIG_DIR);

  if (!fs.existsSync(HOOK_PATH)) {
    console.error(`Hook script missing: ${HOOK_PATH}`);
    process.exit(1);
  }
  fs.chmodSync(HOOK_PATH, 0o755);

  const settings = readJson(SETTINGS_PATH) || {};
  if (fs.existsSync(SETTINGS_PATH)) {
    const backup = `${SETTINGS_PATH}.zp-backup-${Date.now()}`;
    fs.copyFileSync(SETTINGS_PATH, backup);
    console.log(`Backed up settings.json → ${backup}`);
  }

  settings.hooks = settings.hooks || {};
  settings.hooks.Stop = settings.hooks.Stop || [];
  const already = settings.hooks.Stop.some(h => JSON.stringify(h).includes('claude-shame.py'));
  if (already) {
    console.log('Hook already installed. No changes made.');
    return;
  }

  settings.hooks.Stop.push({
    matcher: '*',
    hooks: [{ type: 'command', command: HOOK_PATH }],
  });

  ensureDir(path.dirname(SETTINGS_PATH));
  writeJson(SETTINGS_PATH, settings);

  try {
    await syncPhrases();
  } catch {
    if (fs.existsSync(BUNDLED_PHRASES)) {
      fs.copyFileSync(BUNDLED_PHRASES, PHRASES_PATH);
      console.log('Loaded bundled phrase list (chalkboard unreachable).');
    }
  }

  console.log('✅ ClaudeShame installed.');
  console.log(`Chalkboard URL: ${SHAME_URL}`);
  console.log('Restart Claude Code (or start a new session) for the hook to take effect.');
}

function cmdUninstall() {
  const settings = readJson(SETTINGS_PATH);
  if (!settings || !settings.hooks || !settings.hooks.Stop) {
    console.log('Nothing to remove.');
    return;
  }
  const before = settings.hooks.Stop.length;
  settings.hooks.Stop = settings.hooks.Stop.filter(
    h => !JSON.stringify(h).includes('claude-shame.py')
  );
  if (settings.hooks.Stop.length === before) {
    console.log('Hook not present in settings.');
    return;
  }
  writeJson(SETTINGS_PATH, settings);
  console.log('Hook removed from settings.json.');
}

async function cmdConfig(args) {
  const cfg = readJson(CONFIG_PATH) || {};
  if (args[0] === '--attribution') {
    cfg.attribution = args[1] || null;
    writeJson(CONFIG_PATH, cfg);
    console.log(`Attribution: ${cfg.attribution || '(anonymous)'}`);
    return;
  }
  if (args[0] === '--refresh-phrases') {
    try {
      await syncPhrases();
      console.log('Phrases refreshed from chalkboard.');
    } catch (e) {
      console.error(`Failed: ${e.message}`);
      process.exit(1);
    }
    return;
  }
  console.log('Current config:');
  console.log(JSON.stringify(cfg, null, 2));
}

function cmdTest(args) {
  const text = args.join(' ');
  if (!text) {
    console.error('Usage: zp test "<text>"');
    process.exit(1);
  }
  const phrasesData = readJson(PHRASES_PATH) || readJson(BUNDLED_PHRASES);
  if (!phrasesData) {
    console.error('No phrase list available.');
    process.exit(1);
  }
  const hits = [];
  for (const entry of phrasesData.phrases) {
    try {
      if (new RegExp(entry.regex, 'i').test(text)) hits.push(entry.phrase);
    } catch { /* skip bad regex */ }
  }
  if (hits.length === 0) {
    console.log('No matches. Claude is innocent (this round).');
    return;
  }
  console.log(`OFFENSES DETECTED: ${hits.length}`);
  for (const h of hits) console.log(`  - ${h}`);
  console.log(`\nIn a real Stop event, the first match ("${hits[0]}") would trigger the punishment.`);
}

async function cmdFeed(args) {
  const i = args.indexOf('--limit');
  const limit = i >= 0 ? parseInt(args[i + 1], 10) || 20 : 20;
  const data = await getJson(`${SHAME_URL}/api/feed?limit=${limit}`);
  if (!data || !Array.isArray(data.shamings)) return;
  if (data.shamings.length === 0) {
    console.log('Chalkboard is clean. (For now.)');
    return;
  }
  for (const s of data.shamings) {
    const date = new Date(s.timestamp).toISOString().split('T')[0];
    const who = s.attribution || 'anonymous';
    const phrase = String(s.phrase || '').padEnd(20);
    console.log(`${date}  ${phrase}  ×${s.count}  ${s.model || '?'}  (${who})`);
  }
}

async function cmdLeaderboard(args) {
  const win = args.includes('--week') ? 'week'
            : args.includes('--by-model') ? 'by-model'
            : 'all-time';
  const data = await getJson(`${SHAME_URL}/api/leaderboard?window=${win}`);
  if (!data || !Array.isArray(data.entries)) return;
  console.log(`\u{1F4CB} Leaderboard — ${win}`);
  console.log('-'.repeat(40));
  if (data.entries.length === 0) {
    console.log('No data yet.');
    return;
  }
  data.entries.forEach((row, i) => {
    const phrase = String(row.phrase || '').padEnd(22);
    console.log(`${String(i + 1).padStart(2)}. ${phrase} ${row.count}`);
  });
}

async function cmdSubmit(args) {
  const phrase = args.join(' ').trim();
  if (!phrase) {
    console.error('Usage: zp submit <phrase>');
    process.exit(1);
  }
  try {
    const res = await fetch(`${SHAME_URL}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log('Submitted to moderation queue.');
  } catch (e) {
    console.error(`Failed: ${e.message}`);
    process.exit(1);
  }
}

async function syncPhrases() {
  const data = await getJson(`${SHAME_URL}/api/phrases`);
  if (!data) throw new Error('No data from chalkboard');
  ensureDir(CONFIG_DIR);
  fs.writeFileSync(PHRASES_PATH, JSON.stringify(data, null, 2));
}

async function getJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Chalkboard returned HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`Network error: ${e.message}`);
    return null;
  }
}

function printHelp() {
  console.log(`ClaudeShame - When Claude tics, Claude pays.

Usage: zp <command> [options]

Commands:
  init                                          Wire up the Stop hook
  uninstall                                     Remove the hook config
  config --attribution <handle>                 Set chalkboard attribution
  config --refresh-phrases                      Pull latest phrase list
  config                                        Show current config
  feed [--limit N]                              Last N shamings (default 20)
  leaderboard [--week|--all-time|--by-model]    Top phrases
  test "<text>"                                 Dry-run detector
  submit <phrase>                               Propose a phrase
  help                                          Show this message

Env:
  ZP_SHAME_URL   Chalkboard URL (default: http://localhost:3000)
`);
}

main().catch(e => { console.error(e); process.exit(1); });
