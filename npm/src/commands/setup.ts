import { existsSync, mkdirSync, writeFileSync } from 'fs';
import {
  c, ico, Spinner, exec, execAsync, getRepo, getGitBranch,
  ensureGhCli, ensureGitRepo, select,
  log, blank, label, kv, ok, fail, warn, info, done,
  WORKFLOW_CONTENT_URL, WORKFLOW_PATH,
} from '../utils.js';

const spinner = new Spinner();

export async function setupCommand() {
  ensureGhCli();
  ensureGitRepo();

  label('Setup', 'CI/CD for GitHub Pages');

  const repo = getRepo();
  const branch = getGitBranch();

  kv('repo', c.cyan(repo));
  kv('branch', c.cyan(branch));

  // ── Workflow ───────────────────────────────────────────────────────────
  blank();
  if (existsSync(WORKFLOW_PATH)) {
    warn(`Workflow already exists at ${c.cyan(WORKFLOW_PATH)}`);

    const action = await select('What would you like to do?', [
      { value: 'overwrite', label: 'Overwrite with latest template' },
      { value: 'keep', label: 'Keep existing' },
      { value: 'abort', label: 'Cancel' },
    ]);

    if (action === 'abort') {
      info('Cancelled.');
      blank();
      return;
    }

    if (action === 'keep') {
      ok('Keeping existing workflow');
    } else {
      await downloadAndCreateWorkflow();
    }
  } else {
    await downloadAndCreateWorkflow();
  }

  // ── Permissions ────────────────────────────────────────────────────────
  blank();
  spinner.start('Setting workflow permissions to read/write');
  try {
    await execAsync(`gh api -X PUT repos/${repo}/actions/permissions/workflow -f default_workflow_permissions=write`);
    spinner.stop('Workflow permissions set to read/write');
  } catch {
    try {
      const current = (await execAsync(
        `gh api repos/${repo}/actions/permissions/workflow --jq .default_workflow_permissions`
      )).trim();
      if (current === 'write') {
        spinner.stop('Permissions already set to read/write');
      } else {
        spinner.stop('Could not set permissions automatically', false);
        info(`Current: ${c.yellow(current)}. Set to "Read and write" at:`);
        info(c.cyan(`https://github.com/${repo}/settings/actions`));
      }
    } catch {
      spinner.stop('Could not verify permissions', false);
      info(c.cyan(`https://github.com/${repo}/settings/actions`));
    }
  }

  // ── Enable Actions ─────────────────────────────────────────────────────
  spinner.start('Enabling GitHub Actions');
  try {
    await execAsync(`gh api -X PUT repos/${repo}/actions/permissions -f enabled=true -f allowed_actions=all`);
    spinner.stop('GitHub Actions enabled');
  } catch {
    spinner.stop('Actions already enabled');
  }

  // ── Done ───────────────────────────────────────────────────────────────
  done('CI/CD setup complete');

  log(`Your repo is configured for automatic deployment.`);
  blank();
  log(c.dim('Next steps:'));
  log(`  ${c.dim('1.')} ${c.cyan('gh-pages put secrets')}   Upload .env secrets`);
  log(`  ${c.dim('2.')} ${c.cyan('gh-pages deploy')}        Trigger deployment`);
  blank();
}

async function downloadAndCreateWorkflow() {
  spinner.start('Downloading workflow template');
  try {
    const res = await fetch(WORKFLOW_CONTENT_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const content = await res.text();
    spinner.stop('Workflow template downloaded');

    const dir = '.github/workflows';
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(WORKFLOW_PATH, content, 'utf-8');
    ok(`Created ${c.cyan(WORKFLOW_PATH)}`);
  } catch (err: any) {
    spinner.stop('Failed to download workflow template', false);
    info(err.message);
    info(`Download manually: ${c.cyan(WORKFLOW_CONTENT_URL)}`);
    blank();
    process.exit(1);
  }
}
