#!/usr/bin/env node

/**
 * Universal deploy.yml initializer
 * Works on Windows, macOS, and Linux
 * 
 * Usage: node init-deploy.js
 */

import { mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
import { get } from 'https';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOY_URL = 'https://cdn.jsdelivr.net/gh/ThinhPhoenix/github-pages@main/.github/workflows/deploy.yml';
const OUTPUT_PATH = '.github/workflows/deploy.yml';

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(outputPath);
    
    get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', (err) => {
      unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  try {
    await mkdir('.github/workflows', { recursive: true });
    await downloadFile(DEPLOY_URL, OUTPUT_PATH);
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();
