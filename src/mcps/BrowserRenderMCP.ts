/**
 * BrowserRenderMCP
 *
 * Responsibility: Uses Playwright to render pages and extract complete DOM with styles.
 * - Renders page exactly as a real browser
 * - Extracts full DOM with computed styles inlined
 * - Converts images to base64 data URLs
 * - Captures screenshots for comparison
 */

import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

// Viewport configurations
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

export interface ExtractedPage {
  success: boolean;
  error?: string;
  title: string;
  html: string;
  desktopScreenshot: string;
  mobileScreenshot: string;
}

export class BrowserRenderMCP {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Wait for page to fully load
   */
  private async waitForFullLoad(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const images = Array.from(document.images);
      return Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 5000);
          });
        })
      );
    });
    await page.waitForTimeout(2000);
  }

  /**
   * Extract the complete page as a single HTML file with inlined styles
   */
  async extractPage(url: string, outputDir: string): Promise<ExtractedPage> {
    await this.init();

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const context = await this.browser!.newContext({
      viewport: DESKTOP_VIEWPORT,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.waitForFullLoad(page);

      const title = await page.title();

      // Extract all stylesheets into one
      const allStyles = await page.evaluate(async () => {
        let css = '';

        // Get all stylesheet rules
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            if (sheet.cssRules) {
              for (const rule of Array.from(sheet.cssRules)) {
                css += rule.cssText + '\n';
              }
            }
          } catch (e) {
            // CORS error on external stylesheets - skip
          }
        }

        // Get all inline styles
        document.querySelectorAll('style').forEach(style => {
          css += style.textContent + '\n';
        });

        return css;
      });

      // Get the body HTML and process it
      const bodyContent = await page.evaluate(async () => {
        // Helper function to convert image to base64
        async function imageToBase64(imgSrc: string): Promise<string> {
          return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  resolve(canvas.toDataURL('image/jpeg', 0.9));
                } else {
                  resolve(imgSrc);
                }
              } catch (e) {
                resolve(imgSrc);
              }
            };
            img.onerror = () => resolve(imgSrc);
            img.src = imgSrc;
            // Timeout after 3 seconds
            setTimeout(() => resolve(imgSrc), 3000);
          });
        }

        // Clone the body
        const bodyClone = document.body.cloneNode(true) as HTMLElement;

        // Remove scripts and tracking elements
        const removeSelectors = [
          'script', 'noscript', 'iframe',
          '[class*="tracking"]', '[id*="tracking"]',
          '[class*="gtm"]', '[id*="gtm"]',
          '[class*="cookie"]', '[id*="cookie"]',
          '[class*="consent"]', '[id*="consent"]',
          '[class*="analytics"]', '[id*="analytics"]'
        ];

        for (const selector of removeSelectors) {
          bodyClone.querySelectorAll(selector).forEach(el => el.remove());
        }

        // Process images - convert to base64
        const images = bodyClone.querySelectorAll('img');
        for (const img of Array.from(images)) {
          const originalImg = document.querySelector(`img[src="${img.getAttribute('src')}"]`) as HTMLImageElement;
          if (originalImg && originalImg.complete && originalImg.naturalWidth > 0) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = originalImg.naturalWidth;
              canvas.height = originalImg.naturalHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(originalImg, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                img.setAttribute('src', dataUrl);
              }
            } catch (e) {
              // Keep original src if CORS fails
            }
          }
          // Remove srcset and lazy loading attributes
          img.removeAttribute('srcset');
          img.removeAttribute('data-src');
          img.removeAttribute('data-srcset');
          img.removeAttribute('loading');
          img.removeAttribute('decoding');
        }

        // Convert links to non-functional
        bodyClone.querySelectorAll('a').forEach(a => {
          a.setAttribute('href', '#');
          a.removeAttribute('target');
        });

        // Remove data attributes that might cause issues
        bodyClone.querySelectorAll('*').forEach(el => {
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-') && !attr.name.startsWith('data-offer')) {
              el.removeAttribute(attr.name);
            }
          });
        });

        return bodyClone.innerHTML;
      });

      // Get computed body styles
      const bodyStyles = await page.evaluate(() => {
        const computed = window.getComputedStyle(document.body);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          fontFamily: computed.fontFamily,
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
          margin: computed.margin,
          padding: computed.padding
        };
      });

      // Build the complete HTML
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
/* Reset */
*, *::before, *::after { box-sizing: border-box; }

/* Extracted Styles */
${allStyles}

/* Body overrides */
body {
  margin: 0;
  padding: 0;
  background-color: ${bodyStyles.backgroundColor};
  color: ${bodyStyles.color};
  font-family: ${bodyStyles.fontFamily};
  font-size: ${bodyStyles.fontSize};
  line-height: ${bodyStyles.lineHeight};
}

/* Ensure images are responsive */
img { max-width: 100%; height: auto; }

/* Disable link interactions */
a { cursor: default; }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;

      // Take screenshots
      const desktopScreenshot = path.join(outputDir, 'original-desktop.png');
      await page.screenshot({ path: desktopScreenshot, fullPage: true });

      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.waitForTimeout(500);

      const mobileScreenshot = path.join(outputDir, 'original-mobile.png');
      await page.screenshot({ path: mobileScreenshot, fullPage: true });

      await context.close();

      return {
        success: true,
        title,
        html,
        desktopScreenshot,
        mobileScreenshot
      };

    } catch (error) {
      await context.close();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        title: '',
        html: '',
        desktopScreenshot: '',
        mobileScreenshot: ''
      };
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Render HTML string and take screenshots
   */
  async renderHtml(html: string, outputDir: string, prefix: string = 'generated'): Promise<{
    desktopScreenshot: string;
    mobileScreenshot: string;
  }> {
    await this.init();

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const context = await this.browser!.newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();

    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1000);

      const desktopScreenshot = path.join(outputDir, `${prefix}-desktop.png`);
      await page.screenshot({ path: desktopScreenshot, fullPage: true });

      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.waitForTimeout(500);

      const mobileScreenshot = path.join(outputDir, `${prefix}-mobile.png`);
      await page.screenshot({ path: mobileScreenshot, fullPage: true });

      await context.close();
      return { desktopScreenshot, mobileScreenshot };

    } catch (error) {
      await context.close();
      throw error;
    }
  }
}

export const browserRenderMCP = new BrowserRenderMCP();
