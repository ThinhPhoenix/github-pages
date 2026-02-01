#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { select as inquirerSelect, input as inquirerInput } from '@inquirer/prompts';

const WORKFLOW_CONTENT_URL = 'https://cdn.jsdelivr.net/gh/ThinhPhoenix/github-pages@main/.github/workflows/deploy.yml';
const WORKFLOW_PATH = '.github/workflows/deploy.yml';

// Vite CLI colors
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';
const red = '\x1b[31m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const cyan = '\x1b[36m';
const gray = '\x1b[90m';

const c = {
  red: (t: string) => `${red}${t}${reset}`,
  green: (t: string) => `${green}${t}${reset}`,
  yellow: (t: string) => `${yellow}${t}${reset}`,
  blue: (t: string) => `${blue}${t}${reset}`,
  cyan: (t: string) => `${cyan}${t}${reset}`,
  gray: (t: string) => `${gray}${t}${reset}`,
  dim: (t: string) => `${dim}${t}${reset}`,
  bold: (t: string) => `${bold}${t}${reset}`,
};

const s = {
  diamond: '◆',
  diamondOutline: '◇',
  line: '│',
  branch: '└',
  check: '✓',
  cross: '✗',
  arrow: '→',
};

let currentStep = 0;

function step(title: string) {
  currentStep++;
  if (currentStep > 1) {
    console.log(`${c.gray(s.line)}`);
  }
  console.log(`${c.blue(s.diamondOutline)}  ${c.bold(title)}`);
}

function item(label: string, value?: string) {
  if (value) {
    console.log(`${c.gray(s.line)}  ${c.dim(label)}`);
    console.log(`${c.gray(s.line)}  ${c.cyan(value)}`);
  } else {
    console.log(`${c.gray(s.line)}  ${label}`);
  }
}

function success(msg: string) { 
  console.log(`${c.gray(s.line)}  ${c.green(s.check)}  ${msg}`); 
}

function error(msg: string) { 
  console.error(`\n${c.red(s.cross)}  ${c.bold(msg)}`); 
}

function info(msg: string) { 
  console.log(`${c.gray(s.line)}  ${c.dim(msg)}`); 
}



// Spinner
class Spinner {
  private intval: NodeJS.Timeout | null = null;
  private frames = ['⠋', '⠙', '⠸', '⠴', '⠦', '⠇'];
  private i = 0;
  private text = '';
  
  start(text: string) {
    this.text = text;
    process.stdout.write(`${c.gray(s.line)}  ${c.dim(this.frames[0])}  ${text}`);
    this.intval = setInterval(() => {
      this.i = (this.i + 1) % this.frames.length;
      process.stdout.write(`\r${c.gray(s.line)}  ${c.dim(this.frames[this.i])}  ${this.text}`);
    }, 80);
  }
  
  stop(finalText: string, ok = true) {
    if (this.intval) clearInterval(this.intval);
    this.intval = null;
    const symbol = ok ? c.green(s.check) : c.red(s.cross);
    process.stdout.write(`\r${c.gray(s.line)}  ${symbol}  ${finalText}\n`);
  }
}

const spinner = new Spinner();

function exec(cmd: string, silent = true): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
  } catch (err: any) {
    throw new Error(`Command failed: ${cmd}\n${err.stderr || err.message}`);
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
    spinner.stop('Workflow template downloaded');
    return text;
  } catch {
    spinner.stop('Failed to download workflow template', false);
    throw new Error('Could not fetch workflow template');
  }
}

function createWorkflow(content: string) {
  const dir = '.github/workflows';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(WORKFLOW_PATH, content, 'utf-8');
  success(`Created workflow at ${c.cyan(WORKFLOW_PATH)}`);
}

async function handleSecrets() {
  step('Configure Secrets');
  
  const envPath = '.env';
  const envExists = existsSync(envPath);
  
  if (envExists) {
    const content = readFileSync(envPath, 'utf-8');
    const count = content.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
    item('Found secrets:', `${count} in ${c.cyan('.env')}`);
  } else {
    info('No .env file detected');
  }
  
  const choice = await select('How would you like to proceed?', [
    { value: 'auto', label: envExists ? 'Set secrets from .env automatically' : 'Create .env and set secrets' },
    { value: 'skip', label: 'Skip for now (configure manually later)' }
  ]);
  
  if (choice === 'skip') {
    info('Skipped. Set manually with:');
    console.log(`${c.gray(s.line)}    ${c.dim('$')} ${c.yellow('gh secret set -f .env')}`);
    console.log(`${c.gray(s.line)}    ${c.dim('$')} ${c.yellow('gh secret set KEY_NAME')}`);
    return;
  }
  
  if (!envExists) {
    info('Creating .env template...');
    writeFileSync(envPath, '# GitHub Actions Secrets\n# Add secrets below (one per line):\n# EXAMPLE_KEY=example_value\n\n', 'utf-8');
    success('Created .env file');
    info('Please edit .env and add your secrets now');
    await prompt('Press Enter when ready to continue...');
  }
  
  if (!existsSync(envPath) || readFileSync(envPath, 'utf-8').trim().length === 0) {
    info('⚠ .env is empty, skipping secret upload');
    return;
  }
  
  spinner.start('Uploading secrets to GitHub...');
  try {
    exec(`gh secret set -f ${envPath}`, true);
    spinner.stop('Secrets configured successfully');
  } catch {
    spinner.stop('Failed to upload secrets', false);
    info('Try manually: ' + c.yellow(`gh secret set -f ${envPath}`));
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
  step('Commit & Push');
  
  const { changes, branch } = getGitStatus();
  if (!changes) {
    success('No changes to commit');
    return;
  }
  
  item('Branch:', c.cyan(branch));
  exec('git status --short', false);
  
  const msg = await prompt('Commit message?', 'Setup GitHub Pages deployment');
  
  spinner.start('Creating commit...');
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
  step('Wait for Build');
  info('Monitoring GitHub Actions...');
  
  const repo = getRepo();
  const maxAttempts = 60;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const branches = exec(`gh api repos/${repo}/branches --jq ".[].name"`, true).trim();
      const branchList = branches.split('\n');
      if (branchList.includes('public')) {
        process.stdout.write('\r\x1b[K');
        success('Build completed successfully');
        return true;
      }
    } catch {}
    
    process.stdout.write(`\r${c.gray(s.line)}  ${c.dim('⋯')}  Elapsed: ${c.dim((i * 5) + 's')}`);
    await new Promise(r => setTimeout(r, 5000));
  }
  
  process.stdout.write('\r\x1b[K');
  info('⚠ Timeout after 5 minutes');
  info(`Check status manually: ${c.cyan(`https://github.com/${repo}/actions`)}`);
  return false;
}

async function enablePages() {
  step('Enable GitHub Pages');
  const repo = getRepo();
  
  spinner.start('Enabling Pages...');
  try {
    exec(`gh api repos/${repo}/pages -X POST -f source[branch]=public -f source[path]=/`, true);
    spinner.stop('GitHub Pages enabled');
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
    console.log(`${c.gray(s.line)}  ${c.green(s.arrow)}  Live URL: ${c.cyan(c.bold(url))}\n└`);
  } catch {
    info('Site URL will be available shortly');
  }
}

// Main
async function main() {
  console.log(c.cyan(`
         _ _   _       _                           
     ___|_| |_| |_ _ _| |_ ___ ___ ___ ___ ___ ___ 
    | . | |  _|   | | | . |___| . | .'| . | -_|_ -|
    |_  |_|_| |_|_|___|___|   |  _|__,|_  |___|___|
    |___|                     |_|     |___|        
  `));
  
  // Checks
  try { exec('gh --version', true); } catch {
    error('GitHub CLI (gh) not found');
    info('Install: ' + c.cyan('https://cli.github.com'));
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
    spinner.start('Checking workflow permissions...');
    try {
      exec(`gh api -X PUT repos/${repo}/actions/permissions/workflow -f default_workflow_permissions=write`, true);
      spinner.stop('Workflow permissions configured');
    } catch (err: any) {
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
    
    // Secrets
    await handleSecrets();
    
    // Git
    await handleGit();
    
    // Wait for build
    const ok = await waitForBuild();
    if (!ok) process.exit(1);
    
    // Enable pages
    await enablePages();
    
    // Final success box
    const boxWidth = 42;
    const innerWidth = 44;
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
    const makeLine = (content: string) => {
      const visibleLen = stripAnsi(content).length;
      const padding = innerWidth - visibleLen;
      return `  ${c.green('│')} ${content}${' '.repeat(Math.max(0, padding))} ${c.green('│')}`;
    };
    
    console.log('');
    console.log(`  ${c.green('╭')}${c.green('─'.repeat(innerWidth + 2))}${c.green('╮')}`);
    console.log(makeLine(''));
    console.log(makeLine(`${c.bold('Setup Complete!')} 🎉`));
    console.log(makeLine(''));
    console.log(makeLine('Your site is being deployed'));
    console.log(makeLine('and will be live shortly'));
    console.log(makeLine(''));
    console.log(`  ${c.green('╰')}${c.green('─'.repeat(innerWidth + 2))}${c.green('╯')}`);
    console.log('');
    
  } catch (err: any) {
    console.log();
    error(err.message);
    process.exit(1);
  }
}

main();
