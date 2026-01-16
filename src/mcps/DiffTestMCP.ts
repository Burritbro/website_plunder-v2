/**
 * DiffTestMCP
 *
 * Responsibility: Compares original screenshots with generated HTML screenshots.
 * - Renders generated HTML via Playwright
 * - Captures screenshots (desktop + mobile)
 * - Compares against original screenshots using pixelmatch
 * - Outputs mismatch percentage and diff images
 */

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { browserRenderMCP } from './BrowserRenderMCP';
import { DiffTestRequest, DiffTestResult } from '../types';

// Thresholds for acceptable mismatch
const DESKTOP_THRESHOLD = 6;  // 6%
const MOBILE_THRESHOLD = 8;   // 8%

export class DiffTestMCP {
  /**
   * Read PNG file and return PNG object
   */
  private async readPNG(filePath: string): Promise<PNG> {
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(new PNG())
        .on('parsed', function() {
          resolve(this as PNG);
        })
        .on('error', reject);
    });
  }

  /**
   * Write PNG object to file
   */
  private async writePNG(png: PNG, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filePath);
      png.pack().pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  /**
   * Resize PNG to match target dimensions
   */
  private resizePNG(source: PNG, targetWidth: number, targetHeight: number): PNG {
    const result = new PNG({ width: targetWidth, height: targetHeight });

    // Simple nearest-neighbor scaling
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = Math.floor(x * source.width / targetWidth);
        const srcY = Math.floor(y * source.height / targetHeight);
        const srcIdx = (srcY * source.width + srcX) * 4;
        const dstIdx = (y * targetWidth + x) * 4;

        result.data[dstIdx] = source.data[srcIdx];
        result.data[dstIdx + 1] = source.data[srcIdx + 1];
        result.data[dstIdx + 2] = source.data[srcIdx + 2];
        result.data[dstIdx + 3] = source.data[srcIdx + 3];
      }
    }

    return result;
  }

  /**
   * Compare two screenshots and return mismatch percentage
   */
  private async compareScreenshots(
    original: string,
    generated: string,
    diffOutput: string
  ): Promise<number> {
    // Read both PNGs
    const img1 = await this.readPNG(original);
    const img2 = await this.readPNG(generated);

    // Determine comparison dimensions (use the larger of the two)
    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);

    // Resize images if needed
    const resized1 = (img1.width !== width || img1.height !== height)
      ? this.resizePNG(img1, width, height)
      : img1;
    const resized2 = (img2.width !== width || img2.height !== height)
      ? this.resizePNG(img2, width, height)
      : img2;

    // Create diff image
    const diff = new PNG({ width, height });

    // Run pixelmatch comparison
    const mismatchedPixels = pixelmatch(
      resized1.data,
      resized2.data,
      diff.data,
      width,
      height,
      {
        threshold: 0.1,  // Sensitivity threshold
        includeAA: false, // Ignore anti-aliasing differences
        alpha: 0.1
      }
    );

    // Calculate mismatch percentage
    const totalPixels = width * height;
    const mismatchPercent = (mismatchedPixels / totalPixels) * 100;

    // Save diff image
    await this.writePNG(diff, diffOutput);

    return mismatchPercent;
  }

  /**
   * Run the diff test
   */
  async test(request: DiffTestRequest): Promise<DiffTestResult> {
    const { originalDesktop, originalMobile, generatedHtml, outputDir } = request;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      // Render generated HTML
      const { desktopScreenshot: genDesktop, mobileScreenshot: genMobile } =
        await browserRenderMCP.renderHtml(generatedHtml, outputDir, 'generated');

      // Compare desktop screenshots
      const desktopDiffImage = path.join(outputDir, 'diff-desktop.png');
      const desktopMismatch = await this.compareScreenshots(
        originalDesktop,
        genDesktop,
        desktopDiffImage
      );

      // Compare mobile screenshots
      const mobileDiffImage = path.join(outputDir, 'diff-mobile.png');
      const mobileMismatch = await this.compareScreenshots(
        originalMobile,
        genMobile,
        mobileDiffImage
      );

      // Check if passes thresholds
      const passesThreshold =
        desktopMismatch <= DESKTOP_THRESHOLD &&
        mobileMismatch <= MOBILE_THRESHOLD;

      return {
        success: true,
        desktopMismatch: Math.round(desktopMismatch * 100) / 100,
        mobileMismatch: Math.round(mobileMismatch * 100) / 100,
        desktopDiffImage,
        mobileDiffImage,
        passesThreshold
      };

    } catch (error) {
      return {
        success: false,
        desktopMismatch: 100,
        mobileMismatch: 100,
        desktopDiffImage: '',
        mobileDiffImage: '',
        passesThreshold: false
      };
    }
  }

  /**
   * Determine what adjustments to make based on diff results
   */
  suggestAdjustments(desktopMismatch: number, mobileMismatch: number, iteration: number): string[] {
    const adjustments: string[] = [];

    // Progressive adjustments based on iteration and mismatch type
    if (iteration === 1) {
      // First refinement: basic adjustments
      if (desktopMismatch > DESKTOP_THRESHOLD) {
        adjustments.push('spacing:increase');
        adjustments.push('font:larger');
      }
      if (mobileMismatch > MOBILE_THRESHOLD) {
        adjustments.push('card-width:narrower');
        adjustments.push('line-height:increase');
      }
    } else if (iteration === 2) {
      // Second refinement: different approach
      if (desktopMismatch > DESKTOP_THRESHOLD) {
        adjustments.push('spacing:decrease');
        adjustments.push('alignment:center');
      }
      if (mobileMismatch > MOBILE_THRESHOLD) {
        adjustments.push('font:smaller');
        adjustments.push('card-width:wider');
      }
    } else {
      // Third refinement: fine-tuning
      if (desktopMismatch > DESKTOP_THRESHOLD) {
        adjustments.push('line-height:decrease');
      }
      if (mobileMismatch > MOBILE_THRESHOLD) {
        adjustments.push('spacing:decrease');
      }
    }

    return adjustments;
  }

  /**
   * Get current thresholds
   */
  getThresholds(): { desktop: number; mobile: number } {
    return {
      desktop: DESKTOP_THRESHOLD,
      mobile: MOBILE_THRESHOLD
    };
  }
}

export const diffTestMCP = new DiffTestMCP();
