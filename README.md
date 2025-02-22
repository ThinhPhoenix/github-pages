0. Init setup

	- Repo > Settings > Actions > General > Workflow permissions > Read & Write

1. Change base url into /repo-name/

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/repo-name/", // ⚡ Change "repo-name" into your repo name
});
```

2. Upload environment variables into github secrets
```bash
gh secret set -f .env
```
`GitHub CLI required`

3. Create .github/workflows/deploy.yml
```yml
name: Deploy🪽

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

      - name: Setup Node.js
        uses: actions/setup-node@v4.0.2
        with:
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build && touch ./dist/.nojekyll  # ⚡ Adjust output folder if needed

      - name: Deploy to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4.6.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          branch: public
          folder: dist  # ⚡ Adjust to your build output folder (dist or out)
```
`Create a .env.example and commit to repo or you can paste env via GitHub actions when dispatch workflow`

4. Provided
   - Repo > Settings > Pages > Branch (Select "public") > Save

