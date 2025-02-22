### 🚀 Hướng Dẫn Triển Khai Web App Lên GitHub Pages  

GitHub Pages chỉ hỗ trợ **static web** (HTML, CSS, JS), vì vậy bạn có thể deploy các dự án **React, Vue, Svelte...** miễn là đã **build ra file tĩnh**.  

Dưới đây là cách deploy một **Vite project** lên GitHub Pages bằng **GitHub Actions**.  

---

### 🛠️ Bước 1: Cấu Hình `Config`  
```Đối với Vite```<img src="https://skillicons.dev/icons?i=vite&theme=dark" width="20" height="20">
```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/tên-repo/", // ⚡ Đổi "tên-repo" thành tên repo của bạn
});
```

```Đối với Nextjs```<img src="https://skillicons.dev/icons?i=nextjs&theme=dark" width="20" height="20">
```js
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  assetPrefix: "/tên-repo/", // ⚡ Đổi "tên-repo" thành tên repo của bạn
};

export default nextConfig;
```
---

### ⚙️ Bước 2: Tạo GitHub Actions Workflow  
Tạo file `.github/workflows/deploy.yml` trong thư mục gốc của project.  

📌 **Nếu thư mục `.github` chưa tồn tại, hãy tự tạo mới.**  

Dán đoạn code sau vào `deploy.yml`:  

```Đối với Vite```<img src="https://skillicons.dev/icons?i=vite&theme=dark" width="20" height="20">
```yaml
name: Deploy🪽

on:
  workflow_dispatch:
  push:
    branches:
      - main # 🔄 Mỗi lần push lên main, workflow sẽ chạy

jobs:
  build:
    name: Build project 🔨
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repo
        uses: actions/checkout@v3

      - name: Check required app secrets from .env.example
        run: |
          # Parse .env.example and collect variable names
          required_secrets=()
          while IFS= read -r line; do
            # Skip comments, empty lines, and lines without '='
            if [[ -z "$line" || "$line" =~ ^\# || "$line" != *"="* ]]; then
              continue
            fi
            # Extract variable name (assuming format VAR=VALUE)
            if [[ "$line" =~ ^[[:space:]]*([[:alnum:]_]+)= ]]; then
              required_secrets+=("${BASH_REMATCH[1]}")
            fi
          done < .env.example

          # Remove duplicate entries and log required secrets
          readarray -t unique_secrets < <(printf '%s\n' "${required_secrets[@]}" | awk '!seen[$0]++')
          echo "Required secrets from .env.example: ${unique_secrets[*]}"

          # Check for missing secrets
          missing=()
          for secret in "${unique_secrets[@]}"; do
            # Replace null/empty values with empty string for check
            [[ -n "${!secret+x}" ]] || missing+=("$secret")
          done

          if [ ${#missing[@]} -gt 0 ]; then
            echo "ERROR: Missing required secrets from .env.example: ${missing[*]}"
            exit 1
          else
            echo "All required secrets are present."
          fi

      - name: Cài Node.js
        uses: actions/setup-node@v3

      - name: Tải dependencies
        uses: bahmutov/npm-install@v1

      - name: Build dự án
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: production-files
          path: ./dist

  deploy:
    name: Deploy lên GitHub pages 🚀
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Tải build artifacts
        uses: actions/download-artifact@v4
        with:
          name: production-files
          path: ./dist

      - name: Deploy lên nhánh gh-pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

```Đối với Nextjs```<img src="https://skillicons.dev/icons?i=nextjs&theme=dark" width="20" height="20">
```yaml
name: Deploy🪽

on:
  workflow_dispatch:
  push:
    branches:
      - main # 🔄 Mỗi lần push lên main, workflow sẽ chạy

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4.1.7

      - name: Check required app secrets from .env.example
        run: |
          # Parse .env.example and collect variable names
          required_secrets=()
          while IFS= read -r line; do
            # Skip comments, empty lines, and lines without '='
            if [[ -z "$line" || "$line" =~ ^\# || "$line" != *"="* ]]; then
              continue
            fi
            # Extract variable name (assuming format VAR=VALUE)
            if [[ "$line" =~ ^[[:space:]]*([[:alnum:]_]+)= ]]; then
              required_secrets+=("${BASH_REMATCH[1]}")
            fi
          done < .env.example

          # Remove duplicate entries and log required secrets
          readarray -t unique_secrets < <(printf '%s\n' "${required_secrets[@]}" | awk '!seen[$0]++')
          echo "Required secrets from .env.example: ${unique_secrets[*]}"

          # Check for missing secrets
          missing=()
          for secret in "${unique_secrets[@]}"; do
            # Replace null/empty values with empty string for check
            [[ -n "${!secret+x}" ]] || missing+=("$secret")
          done

          if [ ${#missing[@]} -gt 0 ]; then
            echo "ERROR: Missing required secrets from .env.example: ${missing[*]}"
            exit 1
          else
            echo "All required secrets are present."
          fi

      - name: Cài Node.js
        uses: actions/setup-node@v4.0.2

      - name: Tải packages
        run: yarn install

      - name: Build dự án
        run: yarn run build && touch ./out/.nojekyll

      - name: Deploy lên GitHub pages
        uses: JamesIves/github-pages-deploy-action@v4.6.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          branch: public # The branch the action should deploy to.
          folder: out # The folder the action should deploy to.
```

---

### ✅ Bước 3: Cấu Hình GitHub  
Sau khi commit và push lên GitHub, bạn cần thiết lập một số cài đặt:  

1. **Vào repo trên GitHub** → **Settings** → **Actions** → **General**  
2. **Tìm mục Workflow permissions** → Chọn **Read and Write** → **Save**  
3. **Vào tab Actions**, nếu job bị failed, nhấn **Re-run failed jobs**  
4. **Vào Settings** → **Pages** → **Chọn "Deploy from branch"** → **Branch: `gh-pages`** → **Save**  
---

### 🌍 Bước 4: Truy Cập Website  
Sau khi quá trình deploy hoàn tất, website của bạn sẽ có đường dẫn:  

```
https://<username_github>.github.io/<tên-repo>/
```

📌 Nếu thấy lỗi **404**, hãy thử thêm `index.html` vào đường dẫn:  

```
https://<username_github>.github.io/<tên-repo>/index.html
```

---

### 🎯 Lưu Ý  
- **Mỗi repository chỉ có thể deploy một trang web**  
- Nếu dùng **Custom Domain**, hãy thêm file `CNAME` vào thư mục `public/`  
- Nếu gặp lỗi **404 khi refresh trang**, cần thêm file `404.html` để hỗ trợ `SPA`  

Chúc bạn deploy thành công! 🚀
