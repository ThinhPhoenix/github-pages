#!/usr/bin/env node

import { printBanner, printHelp, c, blank, log } from './utils.js';
import { deployCommand } from './commands/deploy.js';
import { putCommand } from './commands/put.js';
import { setupCommand } from './commands/setup.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();
const subcommand = args[1]?.toLowerCase();

async function main() {
  if (args.includes('--help') || args.includes('-h') || !command) {
    printHelp();
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    printBanner();
    blank();
    return;
  }

  printBanner();

  switch (command) {
    case 'deploy':  return deployCommand();
    case 'put':     return putCommand(subcommand);
    case 'setup':   return setupCommand();
    case 'status':  return statusCommand();
    case 'logs':    return logsCommand();
    default:
      blank();
      log(`${c.red('Unknown command:')} ${c.bold(command)}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n  ${c.red('Error:')} ${err.message}`);
  process.exit(1);
});
