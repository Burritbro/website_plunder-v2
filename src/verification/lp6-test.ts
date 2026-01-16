/**
 * LP6 Verification Test Harness
 *
 * Automated verification loop using https://seniorsavingsbuddy.com/lp6
 *
 * Test flow:
 * 1. Render original page → screenshots
 * 2. Generate single-file HTML clone
 * 3. Render clone → screenshots
 * 4. Run diff test
 * 5. If mismatch exceeds threshold, refine and regenerate
 * 6. Max 3 refinement loops
 * 7. Output is the best-scoring HTML file
 */

import * as path from 'path';
import * as fs from 'fs';

import { browserRenderMCP } from '../mcps/BrowserRenderMCP';
import { visionLayoutMCP } from '../mcps/VisionLayoutMCP';
import { codegenMCP } from '../mcps/CodegenMCP';
import { diffTestMCP } from '../mcps/DiffTestMCP';
import { LayoutPlan, IterationResult } from '../types';

// Test configuration
const TEST_URL = 'https://seniorsavingsbuddy.com/lp6';
const OUTPUT_DIR = path.join(process.cwd(), 'output', 'lp6-verification');
const MAX_ITERATIONS = 3;

// Thresholds
const DESKTOP_THRESHOLD = 6;  // 6%
const MOBILE_THRESHOLD = 8;   // 8%

interface VerificationResult {
  success: boolean;
  iterations: IterationResult[];
  bestIteration: number;
  finalDesktopMismatch: number;
  finalMobileMismatch: number;
  htmlPath: string;
  passesThreshold: boolean;
  duration: number;
}

/**
 * Run the verification test
 */
async function runVerification(): Promise<VerificationResult> {
  const startTime = Date.now();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║        LP6 VERIFICATION TEST - Website Plunder                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Target URL: ${TEST_URL}`);
  console.log(`Output Dir: ${OUTPUT_DIR}`);
  console.log(`Max Iterations: ${MAX_ITERATIONS}`);
  console.log(`Thresholds: Desktop <= ${DESKTOP_THRESHOLD}%, Mobile <= ${MOBILE_THRESHOLD}%`);
  console.log('');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const iterations: IterationResult[] = [];
  let bestIteration = 0;
  let bestMismatch = { desktop: 100, mobile: 100 };
  let bestHtml = '';

  try {
    // Step 1: Render original page
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Rendering original page...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const renderResult = await browserRenderMCP.render({
      url: TEST_URL,
      outputDir: OUTPUT_DIR
    });

    if (!renderResult.success) {
      throw new Error(renderResult.error || 'Failed to render page');
    }

    console.log(`  ✓ Page title: ${renderResult.pageTitle}`);
    console.log(`  ✓ Desktop screenshot: ${path.basename(renderResult.desktopScreenshot)}`);
    console.log(`  ✓ Mobile screenshot: ${path.basename(renderResult.mobileScreenshot)}`);
    console.log(`  ✓ Images found: ${renderResult.pageContent.images.length}`);
    console.log(`  ✓ Fonts detected: ${renderResult.pageContent.fonts.join(', ') || 'system'}`);
    console.log('');

    // Step 2: Analyze layout
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Analyzing layout...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let layoutPlan = visionLayoutMCP.analyze({
      desktopScreenshot: renderResult.desktopScreenshot,
      mobileScreenshot: renderResult.mobileScreenshot,
      pageContent: renderResult.pageContent
    });

    console.log(`  ✓ Sections identified: ${layoutPlan.sections.length}`);
    layoutPlan.sections.forEach(section => {
      console.log(`    - ${section.type} (${section.children.length} elements)`);
    });
    console.log(`  ✓ Primary color: ${layoutPlan.colorScheme.primary}`);
    console.log(`  ✓ Font family: ${layoutPlan.globalStyles.fontFamily.split(',')[0]}`);
    console.log('');

    // Save layout plan
    const layoutPlanPath = path.join(OUTPUT_DIR, 'layout-plan.json');
    fs.writeFileSync(layoutPlanPath, JSON.stringify(layoutPlan, null, 2), 'utf-8');
    console.log(`  ✓ Layout plan saved: ${path.basename(layoutPlanPath)}`);
    console.log('');

    // Step 3-5: Generate, test, and refine loop
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3-5: Generate → Test → Refine Loop');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let iteration = 0;
    let passesThreshold = false;

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log('');
      console.log(`┌─────────────────────────────────────────────────────────────┐`);
      console.log(`│  ITERATION ${iteration}/${MAX_ITERATIONS}                                               │`);
      console.log(`└─────────────────────────────────────────────────────────────┘`);

      // Generate HTML
      console.log('  Generating HTML...');
      const htmlPath = path.join(OUTPUT_DIR, `generated-v${iteration}.html`);
      const codegenResult = codegenMCP.generateAndSave(
        { layoutPlan, pageContent: renderResult.pageContent },
        htmlPath
      );
      console.log(`    ✓ Generated: ${path.basename(htmlPath)}`);
      console.log(`    ✓ File size: ${(codegenResult.html.length / 1024).toFixed(1)} KB`);

      // Test HTML
      console.log('  Testing visual accuracy...');
      const iterationDir = path.join(OUTPUT_DIR, `iteration-${iteration}`);
      const diffResult = await diffTestMCP.test({
        originalDesktop: renderResult.desktopScreenshot,
        originalMobile: renderResult.mobileScreenshot,
        generatedHtml: codegenResult.html,
        outputDir: iterationDir
      });

      // Record results
      const iterationResult: IterationResult = {
        iteration,
        desktopMismatch: diffResult.desktopMismatch,
        mobileMismatch: diffResult.mobileMismatch
      };

      console.log(`    Desktop mismatch: ${diffResult.desktopMismatch.toFixed(2)}% ${diffResult.desktopMismatch <= DESKTOP_THRESHOLD ? '✓' : '✗'}`);
      console.log(`    Mobile mismatch:  ${diffResult.mobileMismatch.toFixed(2)}% ${diffResult.mobileMismatch <= MOBILE_THRESHOLD ? '✓' : '✗'}`);
      console.log(`    Diff images saved to: ${path.basename(iterationDir)}/`);

      // Track best result
      const totalMismatch = diffResult.desktopMismatch + diffResult.mobileMismatch;
      const bestTotalMismatch = bestMismatch.desktop + bestMismatch.mobile;

      if (totalMismatch < bestTotalMismatch) {
        bestIteration = iteration;
        bestMismatch = {
          desktop: diffResult.desktopMismatch,
          mobile: diffResult.mobileMismatch
        };
        bestHtml = codegenResult.html;
        console.log(`    ★ New best result!`);
      }

      iterations.push(iterationResult);

      // Check threshold
      if (diffResult.passesThreshold) {
        passesThreshold = true;
        console.log('');
        console.log('  ✓ PASSES THRESHOLD - Stopping refinement');
        break;
      }

      // Refine if not last iteration
      if (iteration < MAX_ITERATIONS) {
        console.log('');
        console.log('  Refining layout plan...');
        const adjustments = diffTestMCP.suggestAdjustments(
          diffResult.desktopMismatch,
          diffResult.mobileMismatch,
          iteration
        );
        iterationResult.adjustments = adjustments;
        console.log(`    Adjustments: ${adjustments.join(', ')}`);
        layoutPlan = visionLayoutMCP.refine(layoutPlan, adjustments);
      }
    }

    // Save best HTML
    const finalPath = path.join(OUTPUT_DIR, 'plundered-page.html');
    fs.writeFileSync(finalPath, bestHtml, 'utf-8');

    const duration = Date.now() - startTime;

    // Print summary
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    VERIFICATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Total iterations:    ${iterations.length}`);
    console.log(`  Best iteration:      ${bestIteration}`);
    console.log(`  Final desktop:       ${bestMismatch.desktop.toFixed(2)}% ${bestMismatch.desktop <= DESKTOP_THRESHOLD ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Final mobile:        ${bestMismatch.mobile.toFixed(2)}% ${bestMismatch.mobile <= MOBILE_THRESHOLD ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Passes threshold:    ${passesThreshold ? '✓ YES' : '✗ NO'}`);
    console.log(`  Duration:            ${(duration / 1000).toFixed(1)}s`);
    console.log('');
    console.log(`  Output file:         ${finalPath}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

    return {
      success: true,
      iterations,
      bestIteration,
      finalDesktopMismatch: bestMismatch.desktop,
      finalMobileMismatch: bestMismatch.mobile,
      htmlPath: finalPath,
      passesThreshold,
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
      iterations,
      bestIteration: 0,
      finalDesktopMismatch: 100,
      finalMobileMismatch: 100,
      htmlPath: '',
      passesThreshold: false,
      duration
    };

  } finally {
    // Clean up
    await browserRenderMCP.close();
  }
}

// Run if called directly
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
