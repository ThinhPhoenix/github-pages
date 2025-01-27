[![My Skills](https://skillicons.dev/icons?i=nextjs,github,githubactions,nodejs&theme=dark)](https://skillicons.dev)

### 🚀 Hướng Dẫn Triển Khai Web App Lên GitHub Pages  

GitHub Pages chỉ hỗ trợ **static web** (HTML, CSS, JS), vì vậy bạn có thể deploy các dự án **Next.js** miễn là đã **build ra file tĩnh**.  

Dưới đây là cách deploy một **Next.js project** lên GitHub Pages bằng **GitHub Actions**.  

---

### 🛠️ Bước 1: Cấu Hình `next.config.js`  
Cập nhật **base URL** sao cho trùng với **tên repository** trên GitHub, đồng thời cấu hình để xuất ra các file tĩnh.  

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  assetPrefix: process.env.BASE_PATH || ""  // Cấu hình base path cho GitHub Pages
};

export default nextConfig;
```

---

### ⚙️ Bước 2: Tạo GitHub Actions Workflow  
Tạo file `.github/workflows/deploy.yml` trong thư mục gốc của project.  

📌 **Nếu thư mục `.github` chưa tồn tại, hãy tự tạo mới.**  

Dán đoạn code sau vào `deploy.yml`:  

```yaml
name: GitHub Pages deploy

on:
  workflow_dispatch:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout 🛎️
        uses: actions/checkout@v4.1.7

      - name: Setup Node
        uses: actions/setup-node@v4.0.2

      - name: Installing packages
        run: yarn install

      - name: Extract repository name
        run: echo "BASE_PATH=/$(echo $GITHUB_REPOSITORY | cut -d '/' -f 2)" >> $GITHUB_ENV

      - name: Build page
        run: yarn run build && touch ./out/.nojekyll

      - name: Deploy 🚀
        uses: JamesIves/github-pages-deploy-action@v4.6.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          branch: gh-pages # The branch the action should deploy to.
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
```

This markdown will guide you through deploying a Next.js project to GitHub Pages using GitHub Actions. It includes the necessary setup in `next.config.js`, the workflow for building and deploying, and configuration steps on GitHub.
