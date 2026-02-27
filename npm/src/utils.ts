import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { input as inquirerInput, select as inquirerSelect } from '@inquirer/prompts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── ANSI ─────────────────────────────────────────────────────────────────
const esc = (code: string) => `\x1b[${code}m`;
const reset = esc('0');

export const c = {
  reset:   (t: string) => `${reset}${t}`,
  bold:    (t: string) => `${esc('1')}${t}${reset}`,
  dim:     (t: string) => `${esc('2')}${t}${reset}`,
  italic:  (t: string) => `${esc('3')}${t}${reset}`,
  under:   (t: string) => `${esc('4')}${t}${reset}`,
  red:     (t: string) => `${esc('31')}${t}${reset}`,
  green:   (t: string) => `${esc('32')}${t}${reset}`,
  yellow:  (t: string) => `${esc('33')}${t}${reset}`,
  blue:    (t: string) => `${esc('34')}${t}${reset}`,
  magenta: (t: string) => `${esc('35')}${t}${reset}`,
  cyan:    (t: string) => `${esc('36')}${t}${reset}`,
  white:   (t: string) => `${esc('37')}${t}${reset}`,
  gray:    (t: string) => `${esc('90')}${t}${reset}`,
};

// ── Icons ────────────────────────────────────────────────────────────────
export const ico = {
  ok:      c.green('\u2713'),   // ✓
  fail:    c.red('\u2717'),     // ✗
  warn:    c.yellow('!'),
  info:    c.dim('\u203a'),     // ›
  dot:     c.dim('\u00b7'),     // ·
  arrow:   c.dim('\u203a'),     // ›
  bar:     c.gray('\u2502'),    // │
  dash:    c.gray('\u2500'),    // ─
  play:    c.cyan('\u25b6'),    // ▶
  skip:    c.gray('-'),
};

// ── Logging ──────────────────────────────────────────────────────────────
const PAD = '  ';

export function log(msg = '') {
  console.log(`${PAD}${msg}`);
}

export function blank() {
  console.log();
}

export function label(text: string, sub?: string) {
  blank();
  if (sub) {
    log(`${c.bold(text)}  ${c.dim(sub)}`);
  } else {
    log(c.bold(text));
  }
  blank();
}

export function kv(key: string, value: string, indent = 0) {
  const pad = ' '.repeat(indent);
  log(`${pad}${c.dim(key)}  ${value}`);
}

export function ok(msg: string) {
  log(`${ico.ok}  ${msg}`);
}

export function fail(msg: string) {
  log(`${ico.fail}  ${msg}`);
}

export function warn(msg: string) {
  log(`${ico.warn}  ${c.yellow(msg)}`);
}

export function info(msg: string) {
  log(`${ico.info}  ${c.dim(msg)}`);
}

export function step(n: number, msg: string) {
  log(`${c.dim(`${n}.`)} ${msg}`);
}

export function divider() {
  log(c.gray('\u2500'.repeat(40)));
}

export function done(msg: string) {
  blank();
  log(`${c.green(c.bold('\u2713'))}  ${c.bold(msg)}`);
  blank();
}

// ── Spinner ──────────────────────────────────────────────────────────────
export class Spinner {
  private intval: NodeJS.Timeout | null = null;
  private frames = ['\u280b', '\u2819', '\u2838', '\u2834', '\u2826', '\u2807'];
  private i = 0;

  start(text: string) {
    if (this.intval) clearInterval(this.intval);
    this.i = 0;
    process.stdout.write(`${PAD}${c.cyan(this.frames[0])}  ${text}`);
    this.intval = setInterval(() => {
      this.i = (this.i + 1) % this.frames.length;
      process.stdout.write(`\r\x1b[2K${PAD}${c.cyan(this.frames[this.i])}  ${text}`);
    }, 80);
  }

  stop(finalText: string, success = true) {
    if (this.intval) {
      clearInterval(this.intval);
      this.intval = null;
    }
    const icon = success ? ico.ok : ico.fail;
    process.stdout.write(`\r\x1b[2K${PAD}${icon}  ${finalText}\n`);
  }
}

// ── Async exec (non-blocking, works with spinner) ────────────────────────
import { exec as cpExec } from 'child_process';

export function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cpExec(cmd, { encoding: 'utf-8' }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Command failed: ${cmd}\n${stderr || err.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// ── Exec ─────────────────────────────────────────────────────────────────
export function exec(cmd: string, silent = true): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
  } catch (err: any) {
    throw new Error(`Command failed: ${cmd}\n${err.stderr || err.message}`);
  }
}

// ── Prompts ──────────────────────────────────────────────────────────────
export async function prompt(question: string, def?: string): Promise<string> {
  return inquirerInput({ message: question, default: def });
}

export async function select(question: string, options: { value: string; label: string }[]): Promise<string> {
  return inquirerSelect({
    message: question,
    choices: options.map(opt => ({ value: opt.value, name: opt.label })),
  });
}

// ── Git helpers ──────────────────────────────────────────────────────────
export function getRepo(): string {
  return exec('gh repo view --json nameWithOwner -q .nameWithOwner', true).trim();
}

export function getGitBranch(): string {
  try {
    return exec('git branch --show-current', true).trim();
  } catch {
    return 'main';
  }
}

export function hasGitChanges(): boolean {
  try {
    return exec('git status --porcelain', true).trim().length > 0;
  } catch {
    return false;
  }
}

// ── Precondition checks ─────────────────────────────────────────────────
export function ensureGhCli() {
  try {
    exec('gh --version', true);
  } catch {
    fail('GitHub CLI not found');
    info(`Install it at ${c.cyan('https://cli.github.com')}`);
    process.exit(1);
  }
}

export function ensureGitRepo() {
  try {
    exec('git rev-parse --git-dir', true);
  } catch {
    fail('Not a git repository');
    process.exit(1);
  }
}

// ── Banner ───────────────────────────────────────────────────────────────
export function printBanner() {
  blank();
  log(`${c.bold('gh-pages')} ${c.dim(`v${getVersion()}`)}`);
}

function getVersion(): string {
  try {
    const pkgPath = resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

// ── Help ─────────────────────────────────────────────────────────────────
export function printHelp() {
  printBanner();
  blank();

  log(c.dim('COMMANDS'));
  blank();
  log(`  ${c.white('deploy')}          Deploy your site to GitHub Pages`);
  log(`  ${c.white('setup')}           Set up CI/CD workflow and permissions`);
  log(`  ${c.white('status')}          Check deployment status`);
  log(`  ${c.white('logs')}            View workflow run logs`);
  log(`  ${c.white('put secrets')}     Upload .env secrets to GitHub`);
  blank();

  log(c.dim('FLAGS'));
  blank();
  log(`  ${c.white('-h, --help')}      Show this help`);
  log(`  ${c.white('-v, --version')}   Show version`);
  blank();
}

// ── Shared helpers ───────────────────────────────────────────────────────
export function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);

  if (sec < 60) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function duration(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 1) return '<1s';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function statusIcon(conclusion: string | null, status?: string): string {
  if (conclusion === 'success') return ico.ok;
  if (conclusion === 'failure') return ico.fail;
  if (conclusion === 'skipped') return ico.skip;
  if (status === 'in_progress') return ico.play;
  return c.gray('\u25cb'); // ○
}

export function statusColor(conclusion: string | null, status?: string): (t: string) => string {
  if (conclusion === 'success') return c.green;
  if (conclusion === 'failure') return c.red;
  if (status === 'in_progress') return c.cyan;
  return c.yellow;
}

export const WORKFLOW_CONTENT_URL = 'https://cdn.jsdelivr.net/gh/thinhphoenix/github-pages@main/.github/workflows/deploy.yml';
export const WORKFLOW_PATH = '.github/workflows/deploy.yml';
