#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import * as readline from 'readline';

const WORKFLOW_CONTENT_URL = 'https://cdn.jsdelivr.net/gh/ThinhPhoenix/github-pages@main/.github/workflows/deploy.yml';
const WORKFLOW_PATH = '.github/workflows/deploy.yml';

// Utility functions
function exec(command: string, silent = false): string {
  try {
    const result = execSync(command, { 
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return result;
  } catch (error: any) {
    if (!silent) {
      console.error(`❌ Error executing command: ${command}`);
      console.error(error.message);
    }
    throw error;
  }
}

function log(message: string, emoji = '🔷') {
  console.log(`${emoji} ${message}`);
}

function success(message: string) {
  console.log(`✅ ${message}`);
}

function warning(message: string) {
  console.log(`⚠️  ${message}`);
}

async function fetchWorkflowContent(): Promise<string> {
  log('Fetching workflow content from CDN...');
  try {
    const response = await fetch(WORKFLOW_CONTENT_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    return await response.text();
  } catch (error: any) {
    throw new Error(`Failed to download workflow content: ${error.message}`);
  }
}

function createWorkflowFile(content: string) {
  log('Creating workflow file...');
  
  const workflowDir = '.github/workflows';
  if (!existsSync(workflowDir)) {
    mkdirSync(workflowDir, { recursive: true });
  }
  
  writeFileSync(WORKFLOW_PATH, content, 'utf-8');
  success(`Created ${WORKFLOW_PATH}`);
}

function setWorkflowPermissions() {
  log('Setting workflow permissions...');
  
  try {
    const repoInfo = exec(
      'gh repo view --json nameWithOwner -q .nameWithOwner',
      true
    ).trim();
    
    exec(
      `gh api -X PUT /repos/${repoInfo}/actions/permissions/workflow -f default_workflow_permissions='write'`,
      true
    );
    
    success('Workflow permissions set to write');
  } catch (error) {
    warning('Failed to set workflow permissions. You may need to do this manually.');
  }
}

function promptSecrets() {
  console.log('\n📝 Step: Set GitHub Secrets');
  console.log('─'.repeat(50));
  console.log('Please ensure you have a .env file with your secrets.');
  console.log('Run the following command to set secrets:');
  console.log('\n  gh secret set -f .env\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise<void>((resolve) => {
    rl.question('Press Enter after you have set the secrets... ', () => {
      rl.close();
      success('Secrets configuration confirmed');
      resolve();
    });
  });
}

function promptCommitAndPush() {
  console.log('\n📤 Step: Commit and Push Code');
  console.log('─'.repeat(50));
  console.log('Please commit and push your code to trigger the deployment.');
  console.log('Example commands:');
  console.log('\n  git add .');
  console.log('  git commit -m "Setup GitHub Pages deployment"');
  console.log('  git push\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise<void>((resolve) => {
    rl.question('Press Enter after you have pushed the code... ', () => {
      rl.close();
      success('Code push confirmed');
      resolve();
    });
  });
}

async function waitForPublicBranch() {
  log('Waiting for build to complete (public branch to appear)...');
  
  const maxWaitTime = 600; // 10 minutes
  const checkInterval = 10; // 10 seconds
  let elapsed = 0;
  
  while (elapsed < maxWaitTime) {
    try {
      const branches = exec('gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches --jq ".[].name"', true);
      
      if (branches.includes('public')) {
        success('Build completed! Public branch detected.');
        return true;
      }
    } catch (error) {
      // Continue waiting
    }
    
    process.stdout.write(`\r⏳ Waiting... ${elapsed}s elapsed`);
    await new Promise(resolve => setTimeout(resolve, checkInterval * 1000));
    elapsed += checkInterval;
  }
  
  console.log('');
  warning('Timeout waiting for public branch. Please check the Actions tab.');
  return false;
}

function enableGitHubPages() {
  log('Enabling GitHub Pages...');
  
  try {
    const repoInfo = exec(
      'gh repo view --json nameWithOwner -q .nameWithOwner',
      true
    ).trim();
    
    exec(
      `gh api repos/${repoInfo}/pages -X POST -f source[branch]=public -f source[path]=/`,
      true
    );
    
    success('GitHub Pages enabled successfully!');
    
    // Get the pages URL
    try {
      const pagesInfo = exec(
        `gh api repos/${repoInfo}/pages --jq .html_url`,
        true
      ).trim();
      
      console.log('\n🎉 Deployment Complete!');
      console.log('─'.repeat(50));
      console.log(`Your site will be available at: ${pagesInfo}`);
      console.log('Note: It may take a few minutes for the site to be fully deployed.\n');
    } catch (e) {
      // Pages URL might not be immediately available
    }
  } catch (error: any) {
    if (error.message.includes('409')) {
      success('GitHub Pages is already enabled for this repository.');
    } else {
      warning('Failed to enable GitHub Pages automatically. You may need to enable it manually in repository settings.');
    }
  }
}

async function main() {
  console.log('\n🚀 GitHub Pages Deployment Setup');
  console.log('═'.repeat(50));
  console.log('');
  
  try {
    // Check if gh CLI is installed
    try {
      exec('gh --version', true);
    } catch (error) {
      console.error('❌ GitHub CLI (gh) is not installed or not in PATH.');
      console.error('Please install it from: https://cli.github.com/');
      process.exit(1);
    }
    
    // Check if we're in a git repository
    try {
      exec('git rev-parse --git-dir', true);
    } catch (error) {
      console.error('❌ Not a git repository. Please run this command in a git repository.');
      process.exit(1);
    }
    
    // Step 1 & 2: Download and create workflow file
    const workflowContent = await fetchWorkflowContent();
    createWorkflowFile(workflowContent);
    
    // Step 3: Set workflow permissions
    setWorkflowPermissions();
    
    // Step 4: Prompt for secrets
    await promptSecrets();
    
    // Step 5: Prompt to commit and push
    await promptCommitAndPush();
    
    // Step 6: Wait for build
    const buildSuccess = await waitForPublicBranch();
    
    if (!buildSuccess) {
      console.log('\nYou can manually check the build status in the Actions tab.');
      console.log('Once the build is complete, run the following command:');
      console.log('\n  gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pages -X POST -f source[branch]=public -f source[path]=/\n');
      process.exit(1);
    }
    
    // Step 7 & 8: Enable GitHub Pages
    enableGitHubPages();
    
  } catch (error: any) {
    console.error('\n❌ An error occurred:', error.message);
    process.exit(1);
  }
}

main();