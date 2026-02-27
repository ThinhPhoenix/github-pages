import { existsSync } from 'fs';
import {
  c, ico, Spinner, exec, execAsync, getRepo, getGitBranch, hasGitChanges,
  prompt, select, ensureGhCli, ensureGitRepo,
  log, blank, label, kv, ok, fail, warn, info, done,
  WORKFLOW_PATH,
} from '../utils.js';

const spinner = new Spinner();

async function triggerWorkflowDeploy() {
  label('Deploy', 'via GitHub Actions');

  const repo = getRepo();
  const branch = getGitBranch();

  kv('repo', c.cyan(repo));
  kv('branch', c.cyan(branch));
  blank();

  // Check for uncommitted changes
  if (hasGitChanges()) {
    warn('You have uncommitted changes');
    blank();

    const action = await select('What would you like to do?', [
      { value: 'commit', label: 'Commit and push, then deploy' },
      { value: 'deploy', label: 'Deploy without committing' },
      { value: 'abort', label: 'Cancel' },
    ]);

    if (action === 'abort') {
      info('Cancelled.');
      blank();
      return;
    }

    if (action === 'commit') {
      const msg = await prompt('Commit message?', 'Deploy to GitHub Pages');

      blank();
      spinner.start('Committing and pushing');
      try {
        await execAsync('git add .');
        await execAsync(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
        await execAsync(`git push origin ${branch}`);
        spinner.stop(`Pushed to ${c.cyan(branch)}`);
      } catch (err: any) {
        spinner.stop('Failed to push', false);
        info(err.message);
        blank();
        process.exit(1);
      }

      blank();
      info('Push will trigger the deploy workflow automatically.');
      await waitForDeployment(repo);
      await enablePages(repo);
      blank();
      return;
    }
  }

  // Trigger workflow dispatch
  spinner.start('Triggering deploy workflow');
  try {
    await execAsync(`gh workflow run deploy.yml --ref ${branch}`);
    spinner.stop('Deploy workflow triggered');
  } catch {
    spinner.stop('Failed to trigger workflow', false);
    info(`Try: ${c.yellow(`gh workflow run deploy.yml --ref ${branch}`)}`);
    blank();
    process.exit(1);
  }

  await waitForDeployment(repo);
  await enablePages(repo);
  blank();
}

async function orphanBranchDeploy() {
  label('Deploy', 'orphan branch');

  const repo = getRepo();
  const branch = getGitBranch();

  kv('repo', c.cyan(repo));
  kv('branch', c.cyan(branch));
  blank();

  info('No deploy workflow found. Building locally and pushing output.');
  blank();

  // Detect build output folder
  let buildFolder = 'dist';
  if (existsSync('out')) buildFolder = 'out';
  if (existsSync('.next')) buildFolder = '.next';

  const folder = await prompt('Build output folder?', buildFolder);
  blank();

  // Run build
  spinner.start('Building project');
  try {
    await execAsync('bun install');
    await execAsync('bun run build');
    spinner.stop('Build completed');
  } catch (err: any) {
    spinner.stop('Build failed', false);
    info(err.message);
    blank();
    process.exit(1);
  }

  if (!existsSync(folder)) {
    fail(`Build output folder "${folder}" not found`);
    blank();
    process.exit(1);
  }

  // Deploy to orphan branch
  spinner.start(`Deploying ${c.cyan(folder)} to ${c.cyan('public')} branch`);
  try {
    await execAsync('git stash --include-untracked');

    let publicExists = false;
    try {
      await execAsync('git ls-remote --exit-code --heads origin public');
      publicExists = true;
    } catch { /* doesn't exist */ }

    if (publicExists) {
      await execAsync('git checkout public');
      await execAsync('git rm -rf . 2>/dev/null || true');
    } else {
      await execAsync('git checkout --orphan public');
      await execAsync('git rm -rf . 2>/dev/null || true');
    }

    await execAsync(`git checkout ${branch} -- ${folder}`);
    await execAsync(`cp -r ${folder}/* . 2>/dev/null || true`);
    await execAsync(`cp -r ${folder}/.* . 2>/dev/null || true`);
    await execAsync(`rm -rf ${folder}`);
    await execAsync('touch .nojekyll');
    await execAsync('git add .');
    await execAsync('git commit -m "Deploy to GitHub Pages" --allow-empty');
    await execAsync('git push origin public --force');
    await execAsync(`git checkout ${branch}`);
    try { await execAsync('git stash pop'); } catch { /* no stash */ }

    spinner.stop(`Deployed to ${c.cyan('public')} branch`);
  } catch (err: any) {
    spinner.stop('Deployment failed', false);
    try { await execAsync(`git checkout ${branch}`); } catch {}
    try { await execAsync('git stash pop'); } catch {}
    info(err.message);
    blank();
    process.exit(1);
  }

  await enablePages(repo);
  blank();
}

async function waitForDeployment(repo: string) {
  blank();
  spinner.start('Waiting for deployment');
  const maxAttempts = 60;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const branches = (await execAsync(`gh api repos/${repo}/branches --jq ".[].name"`)).trim();
      if (branches.split('\n').includes('public')) {
        spinner.stop('Deployment completed');
        return true;
      }
    } catch {}

    await new Promise(r => setTimeout(r, 5000));
  }

  spinner.stop('Timed out after 5 minutes', false);
  info(`Check: ${c.cyan(`https://github.com/${repo}/actions`)}`);
  return false;
}

async function enablePages(repo: string) {
  blank();
  spinner.start('Enabling GitHub Pages');
  try {
    await execAsync(`gh api repos/${repo}/pages -X POST -f source[branch]=public -f source[path]=/`);
    spinner.stop('GitHub Pages enabled');
  } catch (err: any) {
    if (err.message.includes('409')) {
      spinner.stop('GitHub Pages already enabled');
    } else {
      spinner.stop('Could not enable automatically', false);
      info('Enable manually in Settings > Pages');
      return;
    }
  }

  try {
    const url = (await execAsync(`gh api repos/${repo}/pages --jq .html_url`)).trim();
    done(`Live at ${c.cyan(url)}`);
  } catch {
    info('Site URL will be available shortly');
  }
}

export async function deployCommand() {
  ensureGhCli();
  ensureGitRepo();

  const hasWorkflow = existsSync(WORKFLOW_PATH);

  if (hasWorkflow) {
    await triggerWorkflowDeploy();
  } else {
    const choice = await select('No deploy workflow found. How would you like to deploy?', [
      { value: 'orphan', label: 'Deploy via orphan branch (build locally)' },
      { value: 'setup', label: 'Set up CI/CD first' },
    ]);

    if (choice === 'setup') {
      blank();
      info(`Run: ${c.cyan('gh-pages setup')}`);
      blank();
      return;
    }

    await orphanBranchDeploy();
  }
}
