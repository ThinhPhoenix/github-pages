import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
  c, ico, Spinner, exec, execAsync, getRepo,
  ensureGhCli, ensureGitRepo, prompt, select,
  log, blank, label, kv, ok, fail, warn, info,
} from '../utils.js';

const spinner = new Spinner();

export async function putCommand(subcommand?: string) {
  if (subcommand !== 'secrets') {
    blank();
    log(c.dim('USAGE'));
    blank();
    log(`  gh-pages put ${c.cyan('<subcommand>')}`);
    blank();
    log(c.dim('SUBCOMMANDS'));
    blank();
    log(`  ${c.white('secrets')}   Upload secrets from .env to GitHub`);
    blank();
    log(c.dim('EXAMPLES'));
    blank();
    log(`  ${c.dim('$')} gh-pages put secrets`);
    log(`  ${c.dim('$')} gh-pages put secrets .env.production`);
    blank();
    return;
  }

  await putSecrets();
}

async function putSecrets() {
  ensureGhCli();
  ensureGitRepo();

  label('Put Secrets');

  const repo = getRepo();
  kv('repo', c.cyan(repo));
  blank();

  // Check for .env files
  const envFiles = ['.env', '.env.local', '.env.production', '.env.staging']
    .filter(f => existsSync(f));

  let envPath = '.env';

  if (envFiles.length === 0) {
    warn('No .env file found');
    blank();

    const action = await select('What would you like to do?', [
      { value: 'create', label: 'Create a new .env file' },
      { value: 'manual', label: 'Set secrets manually' },
      { value: 'skip', label: 'Cancel' },
    ]);

    if (action === 'skip') {
      info('Cancelled.');
      blank();
      return;
    }

    if (action === 'manual') {
      await manualSecrets(repo);
      return;
    }

    writeFileSync('.env', '# GitHub Actions Secrets\n# Format: KEY=value\n\n', 'utf-8');
    ok('Created .env file');
    info('Add your secrets, then run this command again');
    blank();
    return;
  }

  if (envFiles.length > 1) {
    envPath = await select('Multiple .env files found. Which one?',
      envFiles.map(f => ({ value: f, label: f }))
    );
    blank();
  } else {
    envPath = envFiles[0];
  }

  // Parse secrets
  const content = readFileSync(envPath, 'utf-8');
  const secrets = content
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='));

  if (secrets.length === 0) {
    warn(`${envPath} has no secrets`);
    blank();
    return;
  }

  log(`Found ${c.white(String(secrets.length))} secret(s) in ${c.cyan(envPath)}:`);
  blank();
  for (const secret of secrets) {
    const key = secret.split('=')[0].trim();
    log(`  ${c.dim(ico.dot)}  ${key}`);
  }
  blank();

  const confirm = await select('Upload these secrets to GitHub?', [
    { value: 'yes', label: 'Yes, upload all' },
    { value: 'no', label: 'Cancel' },
  ]);

  if (confirm === 'no') {
    info('Cancelled.');
    blank();
    return;
  }

  blank();
  spinner.start(`Uploading secrets from ${envPath}`);
  try {
    await execAsync(`gh secret set -f ${envPath}`);
    spinner.stop(`${secrets.length} secret(s) uploaded`);
  } catch {
    spinner.stop('Failed to upload secrets', false);
    info(`Try: ${c.yellow(`gh secret set -f ${envPath}`)}`);
  }

  blank();
  ok('Secrets are now available in GitHub Actions');
  info(`Access via: ${c.cyan('${{ secrets.KEY_NAME }}')}`);
  blank();
}

async function manualSecrets(repo: string) {
  blank();
  log('Set secrets one at a time. Leave name empty to finish.');
  blank();

  let count = 0;
  while (true) {
    const key = await prompt('Secret name (empty to finish)?');
    if (!key.trim()) break;

    const value = await prompt(`Value for ${key}?`);
    if (!value.trim()) {
      warn(`Skipped ${key} (empty value)`);
      continue;
    }

    spinner.start(`Setting ${key}`);
    try {
      await execAsync(`echo "${value.replace(/"/g, '\\"')}" | gh secret set ${key}`);
      spinner.stop(`${c.cyan(key)} set`);
      count++;
    } catch {
      spinner.stop(`Failed to set ${key}`, false);
    }
  }

  if (count > 0) {
    blank();
    ok(`${count} secret(s) configured`);
  }
  blank();
}
