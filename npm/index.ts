#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { select as inquirerSelect, input as inquirerInput } from '@inquirer/prompts';

const WORKFLOW_CONTENT_URL = 'https://cdn.jsdelivr.net/gh/ThinhPhoenix/github-pages@main/.github/workflows/deploy.yml';
const WORKFLOW_PATH = '.github/workflows/deploy.yml';

// ANSI colors
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';
const red = '\x1b[31m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const cyan = '\x1b[36m';

const gray = (t: string) => `${dim}${t}${reset}`;
const lightRed = (t: string) => `${red}${t}${reset}`;
const lightGreen = (t: string) => `${green}${t}${reset}`;
const lightYellow = (t: string) => `${yellow}${t}${reset}`;
const lightBlue = (t: string) => `${blue}${t}${reset}`;
const lightCyan = (t: string) => `${cyan}${t}${reset}`;

// UI helpers
function step(msg: string) { console.log(`${lightCyan('◇')} ${bold}${msg}${reset}`); }
function success(msg: string) { console.log(`${lightGreen('✓')} ${msg}`); }
function error(msg: string) { console.error(`${lightRed('✖')} ${msg}`); }
function warning(msg: string) { console.log(`${lightYellow('⚠')} ${msg}`); }
function info(msg: string) { console.log(`${gray('│')} ${msg}`); }

// Spinner
class Spinner {
  private intval: NodeJS.Timeout | null = null;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private i = 0;
  
  start(text: string) {
    this.intval = setInterval(() => {
      process.stdout.write(`\r${gray(this.frames[this.i])} ${text}`);
      this.i = (this.i + 1) % this.frames.length;
    }, 80);
  }
  
  stop(finalText: string, ok = true) {
    if (this.intval) clearInterval(this.intval);
    this.intval = null;
    process.stdout.write(`\r${ok ? lightGreen('✓') : lightRed('✖')} ${finalText}\n`);
  }
}

const spinner = new Spinner();

function exec(cmd: string, silent = true): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
  } catch (err: any) {
    throw new Error(`Command failed: ${cmd}`);
  }
}

async function prompt(question: string, def?: string): Promise<string> {
  return inquirerInput({
    message: question,
    default: def
  });
}

async function select(question: string, options: { value: string; label: string }[]): Promise<string> {
  return inquirerSelect({
    message: question,
    choices: options.map(opt => ({
      value: opt.value,
      name: opt.label
    }))
  });
}

function getRepo(): string {
  return exec('gh repo view --json nameWithOwner -q .nameWithOwner', true).trim();
}

async function fetchWorkflow(): Promise<string> {
  spinner.start('Downloading workflow template...');
  try {
    const res = await fetch(WORKFLOW_CONTENT_URL);
    if (!res.ok) throw new Error();
    const text = await res.text();
    spinner.stop('Downloaded workflow template');
    return text;
  } catch {
    spinner.stop('Failed to download workflow', false);
    throw new Error('Could not fetch workflow template');
  }
}

function createWorkflow(content: string) {
  const dir = '.github/workflows';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(WORKFLOW_PATH, content, 'utf-8');
  success(`Created ${lightBlue(WORKFLOW_PATH)}`);
}

async function handleSecrets() {
  step('Configure Secrets');
  
  const envPath = '.env';
  const envExists = existsSync(envPath);
  
  if (envExists) {
    const content = readFileSync(envPath, 'utf-8');
    const count = content.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
    info(`Found ${lightBlue(count.toString())} secrets in ${lightBlue('.env')}`);
  } else {
    info('No .env file detected');
  }
  
  const choice = await select('How would you like to proceed?', [
    { value: 'auto', label: envExists ? 'Set secrets from .env automatically' : 'Create .env and set secrets' },
    { value: 'skip', label: 'Skip for now (configure manually later)' }
  ]);
  
  if (choice === 'skip') {
    info('Skipped. Set manually with:');
    info(lightYellow('  gh secret set -f .env'));
    info(lightYellow('  gh secret set KEY_NAME'));
    return;
  }
  
  // choice === 'auto'
  if (!envExists) {
    info('Creating .env template...');
    writeFileSync(envPath, '# GitHub Actions Secrets\n# Add secrets below (one per line):\n# EXAMPLE_KEY=example_value\n\n', 'utf-8');
    success('Created .env file');
    info('Please edit .env and add your secrets now');
    await prompt('Press Enter when ready to continue...');
  }
  
  if (!existsSync(envPath) || readFileSync(envPath, 'utf-8').trim().length === 0) {
    warning('.env is empty, skipping secret upload');
    return;
  }
  
  spinner.start('Uploading secrets to GitHub...');
  try {
    exec(`gh secret set -f ${envPath}`, true);
    spinner.stop('Secrets configured successfully');
  } catch {
    spinner.stop('Failed to upload secrets', false);
    info('Try manually: ' + lightYellow(`gh secret set -f ${envPath}`));
  }
}

function getGitStatus(): { changes: boolean; branch: string } {
  try {
    const branch = exec('git branch --show-current', true).trim();
    const status = exec('git status --porcelain', true);
    return { changes: status.trim().length > 0, branch };
  } catch {
    return { changes: false, branch: 'main' };
  }
}

async function handleGit() {
  step('Commit and Push');
  
  const { changes, branch } = getGitStatus();
  if (!changes) {
    success('No changes to commit');
    return;
  }
  
  info(`Branch: ${lightBlue(branch)}`);
  exec('git status --short', false);
  
  const msg = await prompt('Commit message?', 'Setup GitHub Pages deployment');
  
  spinner.start('Committing...');
  try {
    exec('git add .', true);
    exec(`git commit -m "${msg.replace(/"/g, '\\"')}"`, true);
    spinner.stop('Changes committed');
    
    spinner.start(`Pushing to ${branch}...`);
    exec(`git push origin ${branch}`, true);
    spinner.stop(`Pushed to ${branch}`);
  } catch {
    spinner.stop('Git operation failed', false);
    process.exit(1);
  }
}

async function waitForBuild() {
  step('Waiting for Build');
  info('Monitoring GitHub Actions for public branch creation...');
  
  const repo = getRepo();
  const maxAttempts = 60;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const branches = exec(`gh api repos/${repo}/branches --jq ".[].name"`, true).trim();
      const branchList = branches.split('\n');
      if (branchList.includes('public')) {
        process.stdout.write('\r\x1b[K');
        success('Build completed! Public branch created');
        return true;
      }
    } catch {}
    
    process.stdout.write(`\r${gray('│')} Elapsed: ${i * 5}s`);
    await new Promise(r => setTimeout(r, 5000));
  }
  
  process.stdout.write('\r\x1b[K');
  warning('Timeout (5 min). Check status manually:');
  info(lightBlue(`https://github.com/${repo}/actions`));
  return false;
}

async function enablePages() {
  step('Enable GitHub Pages');
  const repo = getRepo();
  
  spinner.start('Enabling Pages...');
  try {
    exec(`gh api repos/${repo}/pages -X POST -f source[branch]=public -f source[path]=/`, true);
    spinner.stop('Pages enabled');
  } catch (err: any) {
    if (err.message.includes('409')) {
      spinner.stop('Pages already enabled');
    } else {
      spinner.stop('Could not enable automatically', false);
      info('Enable manually in repository settings');
      return;
    }
  }
  
  try {
    const url = exec(`gh api repos/${repo}/pages --jq .html_url`, true).trim();
    console.log(`  ${lightGreen('➜')}  ${bold}Site:${reset} ${lightCyan(url)}`);
  } catch {
    info('Site URL will be available shortly');
  }
}

// Main
async function main() {
  console.log(`\n  ${bold}${lightCyan('GITHUB PAGES DEPLOYMENT')}${reset}`);
  console.log(`  ${gray('Automated GitHub Actions setup')}`);
  
  // Checks
  try { exec('gh --version', true); } catch {
    error('GitHub CLI (gh) not found');
    info('Install: ' + lightBlue('https://cli.github.com'));
    process.exit(1);
  }
  
  try { exec('git rev-parse --git-dir', true); } catch {
    error('Not a git repository');
    process.exit(1);
  }
  
  try {
    // Setup workflow
    const workflow = await fetchWorkflow();
    createWorkflow(workflow);
    
    // Permissions
    const repo = getRepo();
    spinner.start('Configuring workflow permissions...');
    try {
      exec(`gh api -X PUT repos/${repo}/actions/permissions/workflow -f default_workflow_permissions=write`, true);
      spinner.stop('Workflow permissions set');
    } catch (err: any) {
      // Check if already configured
      try {
        const current = exec(`gh api repos/${repo}/actions/permissions/workflow --jq .default_workflow_permissions`, true).trim();
        if (current === 'write') {
          spinner.stop('Workflow permissions already set');
        } else {
          spinner.stop('Could not set permissions', false);
          info(`Current: ${current}, please set to 'write' in repository settings`);
        }
      } catch {
        spinner.stop('Could not set permissions', false);
      }
    }
    
    // Secrets with 2 options
    await handleSecrets();
    
    // Git
    await handleGit();
    
    // Wait for build
    const ok = await waitForBuild();
    if (!ok) process.exit(1);
    
    // Enable pages
    await enablePages();
    
    console.log(`${lightGreen('✓')}  ${bold}Setup complete!${reset}`);
    
  } catch (err: any) {
    console.log();
    error(err.message);
    process.exit(1);
  }
}

main();
