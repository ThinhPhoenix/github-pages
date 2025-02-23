# GitHub Actions Deployment Template

A well-structured template for deploying **Vite, Next.js, Nuxt.js**, and similar applications to **GitHub Pages** using **GitHub Actions**, ensuring secure environment variable management.

> [!Note]
> Special thanks to [JamesIves/github-pages-deploy-action](https://github.com/JamesIves/github-pages-deploy-action) and [rafgraph/spa-github-pages](https://github.com/rafgraph/spa-github-pages) for enabling this streamlined deployment process.

![image](https://github.com/user-attachments/assets/99f76422-edfd-4fa1-ae48-77996cc433f6)

---

## 🚀 Quick Start

### 1. Enable GitHub Actions Permissions
Navigate to:
```
Repository > Settings > Actions > General > Workflow permissions > Read & Write
```

### 2. Configure Base URL in `vite.config.ts`
For **Vite-based projects**, set the correct base URL:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/your-repo-name/", // ⚡ Replace with your repository name
});
```

### 3. Define Required Environment Variables
Create an `.env.example` file listing the necessary variables:
```.env
API_KEY=
DATABASE_URL=
```

### 4. Secure Environment Variables Using GitHub Secrets
To securely store environment variables, use GitHub CLI:
```bash
gh secret set -f .env
```
> [!Note]
> Ensure GitHub CLI is installed before executing this command. You can download GitHub CLI here: [GitHub CLI](https://cli.github.com/).  
> Alternatively, you can manually add secrets to **GitHub Actions Secrets** via **Repository > Settings > Secrets and variables > Actions**.

---

## 📦 Features

- ✅ Automated deployment to GitHub Pages  
- ✅ Secure environment variable handling  
- ✅ Configurable build and deployment settings  
- ✅ Jekyll processing disabled (`.nojekyll` included)  

---

## 🔧 Configuration

### GitHub Pages Setup
1. Navigate to **Repository > Settings > Pages**
2. Set the source branch to `public`
3. Click **Save**

### Workflow Configuration
The deployment workflow is defined in `.github/workflows/deploy.yml` and includes:
- Automated deployment on `main` branch pushes
- Manual workflow execution with optional secret overrides
- Node.js environment setup with npm caching
- Secure injection of environment variables from GitHub Secrets
- Build and deployment execution

```yml
name: Deploy 🕊️

on:
  push:
    branches:
      - main
  workflow_dispatch:
    inputs:
      secrets_txt:
        description: "Paste secrets here (format: KEY=VALUE)"
        required: false

jobs:
  build_and_deploy:
    name: Build & Deploy 🚀
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4.1.7

      - name: Import secrets
        env:
          SECRETS_CONTEXT: ${{ toJSON(secrets) }}
        run: |
          # Get keys from .env.example
          if [ -f .env.example ]; then
            # Extract keys from .env.example, ignoring comments and empty lines
            grep -v '^#' .env.example | grep -v '^$' | while IFS='=' read -r key value; do
              # Trim whitespace from key
              key=$(echo "$key" | xargs)
              if [ -n "$key" ]; then
                # Get secret value using jq
                secret_value=$(echo "$SECRETS_CONTEXT" | jq -r ".[\"$key\"]")
                if [ "$secret_value" != "null" ] && [ -n "$secret_value" ]; then
                  echo "$key=$secret_value" >> $GITHUB_ENV
                fi
              fi
            done
          fi

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install || (bun install && git add bun.lockb && git commit -m "chore: update bun.lockb" && git push)

      - name: Build project
        run: bun run build && touch ./dist/.nojekyll # ⚡ Adjust to your build output folder (dist or out)


      - name: Deploy to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4.6.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          branch: public
          folder: dist # ⚡ Adjust to your build output folder (dist or out)
```

---

## 💡 Environment Variables

Environment variables can be managed in two ways:
1. **GitHub Secrets** (recommended for production)
2. **Workflow dispatch input** (useful for testing purposes)

---

## 🏗️ Build Configuration

| Setting             | Default Value        | Configuration File    |
|--------------------|--------------------|---------------------|
| **Output Directory** | `dist`              | `deploy.yml`         |
| **Base URL**        | `/repository-name/` | `vite.config.ts`     |

These settings can be adjusted based on project requirements.

---

## 📝 Usage

### Automatic Deployment
Deploy automatically by pushing changes to the `main` branch:
```bash
git push origin main
```

### Manual Deployment
1. Navigate to **Actions** in the repository
2. Select the **Deploy 🕊️** workflow
3. Click **Run workflow**
4. (Optional) Provide secrets in `KEY=VALUE` format

---

## ⚠️ Important Considerations

> [!Warning]
> - Ensure the repository name matches the base URL in `vite.config.ts`.
> - Maintain an up-to-date `.env.example` file with required variables.
> - **Do not** commit actual secret values to the repository.
> - The `public` branch is automatically generated upon the first deployment.
> - `404.html` and `index.html` are used to fix GitHub Pages 404 errors when refreshing a page.

---

## 🤝 Contributing

Contributions and improvements are welcome! Feel free to submit issues or feature requests.

---

## 📄 License

This project is distributed under the **MIT License**. Refer to the `LICENSE` file for more details.

---

## 🙏 Acknowledgments

This deployment template is powered by:
- [JamesIves/github-pages-deploy-action](https://github.com/JamesIves/github-pages-deploy-action)
- [rafgraph/spa-github-pages](https://github.com/rafgraph/spa-github-pages)

Consider supporting their valuable contributions!

