# github-pages

Automated GitHub Pages deployment setup tool - quickly configure GitHub Actions to deploy your site to GitHub Pages.

## Installation

No installation needed! Run directly with `bunx`:

```bash
bunx github-pages
```

## What it does

This CLI tool automates the entire GitHub Pages deployment setup:

1. ✅ Downloads and creates the GitHub Actions workflow file
2. ✅ Sets workflow permissions to write
3. ✅ Guides you through setting GitHub secrets
4. ✅ Waits for the build to complete
5. ✅ Enables GitHub Pages on your repository

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Git repository with a remote on GitHub
- A `.env` file with your deployment secrets (if needed)

## Usage

Navigate to your project directory and run:

```bash
bunx github-pages
```

Follow the interactive prompts to complete the setup.

## Requirements

- Node.js >= 18.0.0
- GitHub CLI (gh)

## License

MIT

## Author

thinhphoenix
