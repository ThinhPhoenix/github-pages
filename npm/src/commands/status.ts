import { existsSync } from 'fs';
import {
  c, ico, Spinner, exec, execAsync, getRepo, getGitBranch,
  ensureGhCli, ensureGitRepo,
  log, blank, label, kv, ok, warn, info,
  relativeTime, statusIcon, statusColor,
  WORKFLOW_PATH,
} from '../utils.js';

const spinner = new Spinner();

export async function statusCommand() {
  ensureGhCli();
  ensureGitRepo();

  label('Status');

  const repo = getRepo();
  const branch = getGitBranch();

  kv('repo', c.cyan(repo));
  kv('branch', c.cyan(branch));

  // ── Workflow ───────────────────────────────────────────────────────────
  blank();
  log(c.dim('WORKFLOW'));
  blank();
  if (existsSync(WORKFLOW_PATH)) {
    ok(`Found at ${c.cyan(WORKFLOW_PATH)}`);
  } else {
    warn(`Not found at ${c.cyan(WORKFLOW_PATH)}`);
    info(`Run ${c.cyan('gh-pages setup')} to create one`);
  }

  // ── Pages ──────────────────────────────────────────────────────────────
  blank();
  log(c.dim('GITHUB PAGES'));
  blank();
  spinner.start('Checking configuration');
  try {
    const pagesJson = await execAsync(`gh api repos/${repo}/pages 2>/dev/null`);
    const pages = JSON.parse(pagesJson);
    spinner.stop('Enabled');

    if (pages.html_url)   kv('  url', c.cyan(pages.html_url));
    if (pages.source?.branch) kv('  source', c.cyan(pages.source.branch));
    if (pages.status) {
      const col = pages.status === 'built' ? c.green : c.yellow;
      kv('  status', col(pages.status));
    }
    if (pages.cname) kv('  domain', c.cyan(pages.cname));
    if (pages.https_enforced !== undefined) {
      kv('  https', pages.https_enforced ? c.green('enforced') : c.yellow('not enforced'));
    }
  } catch {
    spinner.stop('Not enabled', false);
    info(`Run ${c.cyan('gh-pages deploy')} to enable`);
  }

  // ── Public branch ──────────────────────────────────────────────────────
  blank();
  log(c.dim('PUBLIC BRANCH'));
  blank();
  spinner.start('Checking remote branch');
  try {
    await execAsync('git ls-remote --exit-code --heads origin public');
    spinner.stop(`Branch ${c.cyan('public')} exists on remote`);
  } catch {
    spinner.stop(`Branch ${c.cyan('public')} not found`, false);
    info('Created after first deployment');
  }

  // ── Recent runs ────────────────────────────────────────────────────────
  blank();
  log(c.dim('RECENT RUNS'));
  blank();
  spinner.start('Fetching workflow runs');
  try {
    const runsJson = await execAsync(
      `gh api repos/${repo}/actions/workflows/deploy.yml/runs --jq '.workflow_runs[:3]' 2>/dev/null`
    );
    const runs = JSON.parse(runsJson);

    if (runs.length === 0) {
      spinner.stop('No runs found');
      info('Workflow has not been triggered yet');
    } else {
      spinner.stop(`${runs.length} recent run(s)`);
      blank();

      for (const run of runs) {
        const icon = statusIcon(run.conclusion, run.status);
        const col = statusColor(run.conclusion, run.status);
        const status = run.conclusion || run.status || 'unknown';
        const time = relativeTime(new Date(run.created_at));
        const msg = run.head_commit?.message?.split('\n')[0] || 'No message';

        log(`  ${icon}  ${col(status)}  ${c.dim(time)}  ${c.dim(msg)}`);
      }
    }
  } catch {
    spinner.stop('Could not fetch runs', false);
    info('Deploy workflow may not exist yet');
  }

  // ── Secrets ────────────────────────────────────────────────────────────
  blank();
  log(c.dim('SECRETS'));
  blank();
  spinner.start('Checking secrets');
  try {
    const count = parseInt(
      (await execAsync(`gh api repos/${repo}/actions/secrets --jq '.secrets | length'`)).trim(),
      10
    );
    if (count > 0) {
      spinner.stop(`${count} secret(s) configured`);
    } else {
      spinner.stop('No secrets configured');
      info(`Run ${c.cyan('gh-pages put secrets')} to upload`);
    }
  } catch {
    spinner.stop('Could not check secrets', false);
  }

  blank();
}
