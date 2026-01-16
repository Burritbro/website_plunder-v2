/**
 * LP6 Verification Test Harness
 *
 * Simplified test using direct page extraction
 */

import * as path from 'path';
import * as fs from 'fs';

import { browserRenderMCP } from '../mcps/BrowserRenderMCP';
import { diffTestMCP } from '../mcps/DiffTestMCP';

const TEST_URL = 'https://seniorsavingsbuddy.com/lp6';
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'lp6-verification');

interface VerificationResult {
  success: boolean;
  desktopMismatch: number;
  mobileMismatch: number;
  htmlPath: string;
  duration: number;
}

async function runVerification(): Promise<VerificationResult> {
  const startTime = Date.now();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║        LP6 VERIFICATION TEST - Website Plunder                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Target URL: ${TEST_URL}`);
  console.log(`Output Dir: ${OUTPUT_DIR}`);
  console.log('');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Step 1: Extract page
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Extracting page...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const result = await browserRenderMCP.extractPage(TEST_URL, OUTPUT_DIR);

    if (!result.success) {
      throw new Error(result.error || 'Failed to extract page');
    }

    console.log(`  ✓ Page title: ${result.title}`);
    console.log(`  ✓ Desktop screenshot saved`);
    console.log(`  ✓ Mobile screenshot saved`);
    console.log(`  ✓ HTML size: ${(result.html.length / 1024).toFixed(1)} KB`);
    console.log('');

    // Step 2: Test extracted HTML
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Testing extracted HTML...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const testDir = path.join(OUTPUT_DIR, 'test');
    const diffResult = await diffTestMCP.test({
      originalDesktop: result.desktopScreenshot,
      originalMobile: result.mobileScreenshot,
      generatedHtml: result.html,
      outputDir: testDir
    });

    console.log(`  Desktop mismatch: ${diffResult.desktopMismatch.toFixed(2)}%`);
    console.log(`  Mobile mismatch: ${diffResult.mobileMismatch.toFixed(2)}%`);
    console.log('');

    // Save final HTML
    const finalPath = path.join(OUTPUT_DIR, 'plundered-page.html');
    fs.writeFileSync(finalPath, result.html, 'utf-8');

    const duration = Date.now() - startTime;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    VERIFICATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Desktop match: ${(100 - diffResult.desktopMismatch).toFixed(1)}%`);
    console.log(`  Mobile match: ${(100 - diffResult.mobileMismatch).toFixed(1)}%`);
    console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`  Output: ${finalPath}`);
    console.log('═══════════════════════════════════════════════════════════════');

    return {
      success: true,
      desktopMismatch: diffResult.desktopMismatch,
      mobileMismatch: diffResult.mobileMismatch,
      htmlPath: finalPath,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('                    VERIFICATION FAILED');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    console.error('═══════════════════════════════════════════════════════════════');

    return {
      success: false,
      desktopMismatch: 100,
      mobileMismatch: 100,
      htmlPath: '',
      duration
    };

  } finally {
    await browserRenderMCP.close();
  }
}

if (require.main === module) {
  runVerification()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runVerification };
