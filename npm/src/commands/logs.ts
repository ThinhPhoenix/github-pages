import {
  c, ico, Spinner, exec, execAsync, getRepo,
  ensureGhCli, ensureGitRepo, select,
  log, blank, label, kv, ok, warn, info, divider,
  relativeTime, duration, statusIcon, statusColor,
} from '../utils.js';

const spinner = new Spinner();

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  head_commit?: { message?: string };
  run_number: number;
}

export async function logsCommand() {
  ensureGhCli();
  ensureGitRepo();

  label('Logs', 'workflow run history');

  const repo = getRepo();
  kv('repo', c.cyan(repo));
  blank();

  // Fetch runs
  spinner.start('Fetching workflow runs');
  let runs: WorkflowRun[];
  try {
    const runsJson = await execAsync(
      `gh api repos/${repo}/actions/workflows/deploy.yml/runs --jq '.workflow_runs[:10]'`
    );
    runs = JSON.parse(runsJson);
  } catch {
    spinner.stop('Could not fetch workflow runs', false);
    info('Deploy workflow may not exist yet');
    info(`Run ${c.cyan('gh-pages setup')} to create one`);
    blank();
    return;
  }

  if (runs.length === 0) {
    spinner.stop('No runs found');
    info(`Run ${c.cyan('gh-pages deploy')} to trigger a deployment`);
    blank();
    return;
  }

  spinner.stop(`${runs.length} run(s) found`);
  blank();

  // Let user pick a run
  const options = runs.map((run) => {
    const icon = statusIcon(run.conclusion, run.status);
    const status = run.conclusion || run.status || 'unknown';
    const time = relativeTime(new Date(run.created_at));
    const msg = run.head_commit?.message?.split('\n')[0] || 'No message';

    return {
      value: String(run.id),
      label: `${icon}  #${run.run_number} ${status}  ${c.dim(time)}  ${c.dim(msg)}`,
    };
  });

  const selectedId = await select('Select a run:', options);
  blank();

  // Fetch jobs
  spinner.start('Fetching run details');
  let jobs: any[];
  try {
    const jobsJson = await execAsync(
      `gh api repos/${repo}/actions/runs/${selectedId}/jobs --jq '.jobs'`
    );
    jobs = JSON.parse(jobsJson);
  } catch {
    spinner.stop('Could not fetch details', false);
    blank();
    return;
  }

  spinner.stop(`${jobs.length} job(s)`);

  for (const job of jobs) {
    const icon = statusIcon(job.conclusion, job.status);
    const status = job.conclusion || job.status;

    blank();
    log(`${icon}  ${c.bold(job.name)}  ${c.dim(status)}`);

    if (job.steps?.length > 0) {
      blank();
      for (const s of job.steps) {
        const sIcon = statusIcon(s.conclusion, s.status);
        const dur = duration(s.started_at, s.completed_at);
        log(`    ${sIcon}  ${s.name}  ${c.dim(dur)}`);
      }
    }
  }

  // Offer to show logs for failed jobs
  const failedJobs = jobs.filter(j => j.conclusion === 'failure');
  if (failedJobs.length > 0) {
    blank();
    warn(`${failedJobs.length} job(s) failed`);
    blank();

    const viewLogs = await select('View full logs for a failed job?', [
      ...failedJobs.map(j => ({ value: String(j.id), label: j.name })),
      { value: 'skip', label: 'Skip' },
    ]);

    if (viewLogs !== 'skip') {
      blank();
      spinner.start('Fetching logs');
      try {
        const logs = await execAsync(`gh api repos/${repo}/actions/jobs/${viewLogs}/logs`);
        spinner.stop('Logs retrieved');
        blank();

        const lines = logs.split('\n');
        const maxLines = 80;
        const display = lines.length > maxLines ? lines.slice(-maxLines) : lines;

        if (lines.length > maxLines) {
          info(`Showing last ${maxLines} of ${lines.length} lines`);
          blank();
        }

        for (const line of display) {
          if (/error/i.test(line) && !/\d+ errors?/i.test(line)) {
            log(`  ${c.red(line)}`);
          } else if (/warn/i.test(line)) {
            log(`  ${c.yellow(line)}`);
          } else {
            log(`  ${c.dim(line)}`);
          }
        }
      } catch {
        spinner.stop('Could not fetch logs', false);
        info('View logs on GitHub instead');
      }
    }
  }

  // Link to GitHub
  const selectedRun = runs.find(r => String(r.id) === selectedId);
  if (selectedRun?.html_url) {
    blank();
    info(c.cyan(selectedRun.html_url));
  }

  blank();
}
