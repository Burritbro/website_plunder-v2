/**
 * BrowserRenderMCP
 *
 * Responsibility: Uses Playwright Chromium to render pages exactly as a real browser.
 * - Captures full-page screenshots (desktop 1440×900, mobile 390×844)
 * - Ensures fonts and images are fully loaded
 * - Respects robots.txt (fails gracefully if disallowed)
 * - Extracts page content and computed styles
 */

import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import {
  RenderRequest,
  RenderResult,
  PageContent,
  ComputedStyleMap,
  ImageInfo,
  ColorPalette,
  BoundingBox
} from '../types';

// Viewport configurations
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

export class BrowserRenderMCP {
  private browser: Browser | null = null;

  /**
   * Initialize the browser instance
   */
  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Check if URL is allowed by robots.txt
   */
  private async checkRobotsTxt(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;

      const response = await fetch(robotsUrl);
      if (!response.ok) {
        // No robots.txt found, assume allowed
        return true;
      }

      const robotsTxt = await response.text();
      const lines = robotsTxt.split('\n');

      let isUserAgentMatch = false;
      for (const line of lines) {
        const trimmed = line.trim().toLowerCase();

        if (trimmed.startsWith('user-agent:')) {
          const agent = trimmed.replace('user-agent:', '').trim();
          isUserAgentMatch = agent === '*' || agent.includes('bot');
        }

        if (isUserAgentMatch && trimmed.startsWith('disallow:')) {
          const disallowPath = trimmed.replace('disallow:', '').trim();
          if (disallowPath === '/' || urlObj.pathname.startsWith(disallowPath)) {
            return false;
          }
        }
      }

      return true;
    } catch {
      // Error fetching robots.txt, assume allowed
      return true;
    }
  }

  /**
   * Wait for page to fully load (fonts, images, etc.)
   */
  private async waitForFullLoad(page: Page): Promise<void> {
    // Wait for network to be idle
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    // Wait for fonts to load
    await page.evaluate(() => {
      return document.fonts.ready;
    });

    // Wait for images to load
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

    // Additional wait for any animations/transitions
    await page.waitForTimeout(1000);
  }

  /**
   * Extract page content including HTML, styles, images, and colors
   */
  private async extractPageContent(page: Page): Promise<PageContent> {
    return await page.evaluate(() => {
      // Helper to get computed style for an element
      const getComputedStylesForElement = (el: Element): Record<string, string> => {
        const computed = window.getComputedStyle(el);
        const styles: Record<string, string> = {};
        const importantProps = [
          'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap',
          'gridTemplateColumns', 'gridTemplateRows',
          'width', 'height', 'maxWidth', 'minHeight',
          'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
          'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
          'backgroundColor', 'color', 'backgroundImage',
          'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'textAlign',
          'borderRadius', 'border', 'borderColor', 'borderWidth',
          'boxShadow', 'position', 'top', 'left', 'right', 'bottom'
        ];

        for (const prop of importantProps) {
          const value = computed.getPropertyValue(
            prop.replace(/([A-Z])/g, '-$1').toLowerCase()
          );
          if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
            styles[prop] = value;
          }
        }
        return styles;
      };

      // Get title
      const title = document.title || '';

      // Get meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      const metaDescription = metaDesc ? metaDesc.getAttribute('content') || '' : '';

      // Get body HTML (cleaned)
      const bodyClone = document.body.cloneNode(true) as HTMLElement;

      // Remove scripts, tracking, and unwanted elements
      const removeSelectors = [
        'script', 'noscript', 'iframe[src*="google"]', 'iframe[src*="facebook"]',
        'iframe[src*="analytics"]', '[class*="tracking"]', '[id*="tracking"]',
        '[class*="gtm"]', '[id*="gtm"]', '[class*="cookie"]', '[id*="cookie"]'
      ];

      for (const selector of removeSelectors) {
        bodyClone.querySelectorAll(selector).forEach(el => el.remove());
      }

      const bodyHtml = bodyClone.innerHTML;

      // Extract computed styles for key elements
      const computedStyles: { [selector: string]: { styles: Record<string, string>; boundingBox: { x: number; y: number; width: number; height: number } } } = {};

      const keyElements = document.querySelectorAll(
        'header, nav, main, section, article, aside, footer, ' +
        'h1, h2, h3, h4, h5, h6, p, a, button, img, ' +
        '[class*="hero"], [class*="card"], [class*="offer"], [class*="cta"]'
      );

      keyElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const selector = el.tagName.toLowerCase() +
          (el.id ? `#${el.id}` : '') +
          (el.className ? `.${el.className.toString().split(' ').join('.')}` : '') +
          `[${index}]`;

        computedStyles[selector] = {
          styles: getComputedStylesForElement(el),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      });

      // Extract images
      const images: { src: string; alt: string; width: number; height: number; dataUrl?: string }[] = [];
      document.querySelectorAll('img').forEach(img => {
        if (img.src && img.naturalWidth > 0) {
          // Convert to base64 if possible
          let dataUrl: string | undefined;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              dataUrl = canvas.toDataURL('image/png');
            }
          } catch {
            // CORS error, skip base64 conversion
          }

          images.push({
            src: img.src,
            alt: img.alt || '',
            width: img.naturalWidth,
            height: img.naturalHeight,
            dataUrl
          });
        }
      });

      // Extract fonts
      const fonts: string[] = [];
      document.fonts.forEach(font => {
        if (!fonts.includes(font.family)) {
          fonts.push(font.family);
        }
      });

      // Extract color palette
      const backgroundColors = new Set<string>();
      const textColors = new Set<string>();
      const accentColors = new Set<string>();

      document.querySelectorAll('*').forEach(el => {
        const computed = window.getComputedStyle(el);
        const bgColor = computed.backgroundColor;
        const textColor = computed.color;

        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          backgroundColors.add(bgColor);
        }
        if (textColor) {
          textColors.add(textColor);
        }

        // Accent colors from buttons, links, highlights
        if (el.tagName === 'BUTTON' || el.tagName === 'A' ||
            el.classList.contains('cta') || el.classList.contains('btn')) {
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
            accentColors.add(bgColor);
          }
        }
      });

      const colors: { background: string[]; text: string[]; accent: string[] } = {
        background: Array.from(backgroundColors).slice(0, 10),
        text: Array.from(textColors).slice(0, 10),
        accent: Array.from(accentColors).slice(0, 5)
      };

      return {
        title,
        metaDescription,
        bodyHtml,
        computedStyles,
        images,
        fonts,
        colors
      };
    });
  }

  /**
   * Render a URL and capture screenshots + content
   */
  async render(request: RenderRequest): Promise<RenderResult> {
    await this.init();

    const { url, outputDir } = request;

    // Check robots.txt
    const isAllowed = await this.checkRobotsTxt(url);
    if (!isAllowed) {
      return {
        success: false,
        error: 'URL is disallowed by robots.txt',
        desktopScreenshot: '',
        mobileScreenshot: '',
        pageTitle: '',
        pageContent: {
          title: '',
          metaDescription: '',
          bodyHtml: '',
          computedStyles: {},
          images: [],
          fonts: [],
          colors: { background: [], text: [], accent: [] }
        }
      };
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const context = await this.browser!.newContext({
      viewport: DESKTOP_VIEWPORT,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for full load
      await this.waitForFullLoad(page);

      // Get page title
      const pageTitle = await page.title();

      // Extract page content
      const pageContent = await this.extractPageContent(page);

      // Capture desktop screenshot
      const desktopScreenshot = path.join(outputDir, 'original-desktop.png');
      await page.screenshot({
        path: desktopScreenshot,
        fullPage: true
      });

      // Switch to mobile viewport
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.waitForTimeout(500);

      // Capture mobile screenshot
      const mobileScreenshot = path.join(outputDir, 'original-mobile.png');
      await page.screenshot({
        path: mobileScreenshot,
        fullPage: true
      });

      await context.close();

      return {
        success: true,
        desktopScreenshot,
        mobileScreenshot,
        pageTitle,
        pageContent
      };

    } catch (error) {
      await context.close();

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during rendering',
        desktopScreenshot: '',
        mobileScreenshot: '',
        pageTitle: '',
        pageContent: {
          title: '',
          metaDescription: '',
          bodyHtml: '',
          computedStyles: {},
          images: [],
          fonts: [],
          colors: { background: [], text: [], accent: [] }
        }
      };
    }
  }

  /**
   * Render HTML content and capture screenshots (for diff testing)
   */
  async renderHtml(htmlContent: string, outputDir: string, prefix: string = 'generated'): Promise<{
    desktopScreenshot: string;
    mobileScreenshot: string;
  }> {
    await this.init();

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const context = await this.browser!.newContext({
      viewport: DESKTOP_VIEWPORT
    });

    const page = await context.newPage();

    try {
      // Load HTML content
      await page.setContent(htmlContent, { waitUntil: 'networkidle' });

      // Wait for fonts and images
      await this.waitForFullLoad(page);

      // Capture desktop screenshot
      const desktopScreenshot = path.join(outputDir, `${prefix}-desktop.png`);
      await page.screenshot({
        path: desktopScreenshot,
        fullPage: true
      });

      // Switch to mobile viewport
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.waitForTimeout(500);

      // Capture mobile screenshot
      const mobileScreenshot = path.join(outputDir, `${prefix}-mobile.png`);
      await page.screenshot({
        path: mobileScreenshot,
        fullPage: true
      });

      await context.close();

      return {
        desktopScreenshot,
        mobileScreenshot
      };

    } catch (error) {
      await context.close();
      throw error;
    }
  }
}

export const browserRenderMCP = new BrowserRenderMCP();
