# GitHub Actions Deployment Template

A streamlined template for deploying Vite, NextJS, NuxtJS, ... applications to GitHub Pages using GitHub Actions, with secure environment variable handling.

> Special thanks to [JamesIves/github-pages-deploy-action](https://github.com/JamesIves/github-pages-deploy-action) for making this deployment process possible.

## 🚀 Quick Start

1. Enable GitHub Actions permissions:
   ```
   Repository > Settings > Actions > General > Workflow permissions > Read & Write
   ```

2. Update the base URL in `vite.config.ts`:
   ```typescript
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";

   export default defineConfig({
     plugins: [react()],
     base: "/your-repo-name/", // ⚡ Replace with your repository name
   });
   ```

3. Create `.env.example` with your required environment variables:
   ```
   API_KEY=
   DATABASE_URL=
   ```

4. Upload your environment variables to GitHub Secrets:
   ```bash
   gh secret set -f .env
   ```
   Note: GitHub CLI is required for this step.

## 📦 Features

- Automated deployment to GitHub Pages
- Secure environment variable handling
- Configurable build settings
- No Jekyll processing (`.nojekyll` file included)

## 🔧 Configuration

### GitHub Pages Setup

1. Go to `Repository > Settings > Pages`
2. Select `public` branch as the source
3. Save your changes

### Workflow Configuration

The deployment workflow is defined in `.github/workflows/deploy.yml` and includes:

- Automatic deployment on pushes to main branch
- Manual workflow dispatch with optional secret configuration
- Node.js setup with npm caching
- Environment variable injection from GitHub Secrets
- Build and deployment steps

## 💡 Environment Variables

Environment variables can be managed in two ways:

1. Through GitHub Secrets (recommended for production)
2. Via workflow dispatch input (useful for testing)

## 🏗️ Build Configuration

The default build configuration uses:
- Output directory: `dist`
- Base URL: `/repository-name/`

Adjust these settings in:
- `vite.config.ts` for the base URL
- `deploy.yml` for the build output folder

## 📝 Usage

### Automatic Deployment

Push to the main branch to trigger automatic deployment:
```bash
git push origin main
```

### Manual Deployment

1. Go to Actions tab in your repository
2. Select "Deploy🪽" workflow
3. Click "Run workflow"
4. Optionally add secrets in KEY=VALUE format

## ⚠️ Important Notes

- Ensure your repository name matches the base URL in `vite.config.ts`
- Keep your `.env.example` file updated with required variable names
- Never commit actual secret values to the repository
- The public branch will be created automatically on first deployment

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

This template uses [JamesIves/github-pages-deploy-action](https://github.com/JamesIves/github-pages-deploy-action) for GitHub Pages deployment. Please consider supporting their work!
