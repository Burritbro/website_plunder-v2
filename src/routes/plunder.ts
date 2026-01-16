/**
 * Plunder Route
 *
 * Orchestrates the page plundering process:
 * 1. Render original page via BrowserRenderMCP
 * 2. Analyze layout via VisionLayoutMCP
 * 3. Generate HTML via CodegenMCP
 * 4. Test via DiffTestMCP
 * 5. Refine if necessary (up to 3 iterations)
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

import { browserRenderMCP } from '../mcps/BrowserRenderMCP';
import { visionLayoutMCP } from '../mcps/VisionLayoutMCP';
import { codegenMCP } from '../mcps/CodegenMCP';
import { diffTestMCP } from '../mcps/DiffTestMCP';
import {
  PlunderJob,
  PlunderRequest,
  PlunderResponse,
  IterationResult,
  LayoutPlan
} from '../types';

const router = Router();

// In-memory job storage
const jobs = new Map<string, PlunderJob>();

// Max refinement iterations
const MAX_ITERATIONS = 3;

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), 'output');

/**
 * Validate URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * POST /api/plunder
 * Start a new plunder job
 */
router.post('/', async (req: Request, res: Response) => {
  const { url } = req.body as PlunderRequest;

  // Validate URL
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({
      jobId: '',
      status: 'failed',
      message: 'Invalid URL. Please provide a valid http or https URL.'
    } as PlunderResponse);
  }

  // Create job
  const jobId = uuidv4();
  const jobDir = path.join(OUTPUT_DIR, jobId);

  const job: PlunderJob = {
    id: jobId,
    url,
    status: 'pending',
    createdAt: new Date(),
    iterations: []
  };

  jobs.set(jobId, job);

  // Start processing in background
  processJob(job, jobDir).catch(error => {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
  });

  // Return immediately with job ID
  return res.json({
    jobId,
    status: 'pending',
    message: 'Plunder job started. Poll /api/plunder/:jobId for status.'
  } as PlunderResponse);
});

/**
 * GET /api/plunder/:jobId
 * Get job status and result
 */
router.get('/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      jobId,
      status: 'failed',
      message: 'Job not found'
    } as PlunderResponse);
  }

  const response: PlunderResponse = {
    jobId: job.id,
    status: job.status,
    iterations: job.iterations
  };

  if (job.status === 'completed' && job.result) {
    response.downloadUrl = `/api/plunder/${jobId}/download`;
    response.htmlContent = job.result.htmlContent;
  }

  if (job.status === 'failed') {
    response.message = job.error || 'Unknown error';
  }

  return res.json(response);
});

/**
 * GET /api/plunder/:jobId/download
 * Download the generated HTML file
 */
router.get('/:jobId/download', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job || job.status !== 'completed' || !job.result) {
    return res.status(404).json({
      jobId,
      status: 'failed',
      message: 'Job not found or not completed'
    });
  }

  const filePath = job.result.htmlPath;

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      jobId,
      status: 'failed',
      message: 'Generated file not found'
    });
  }

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="plundered-page.html"');
  return res.sendFile(filePath);
});

/**
 * Process the plunder job
 */
async function processJob(job: PlunderJob, jobDir: string): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  try {
    // Step 1: Render original page
    job.status = 'rendering';
    console.log(`[${job.id}] Rendering original page: ${job.url}`);

    const renderResult = await browserRenderMCP.render({
      url: job.url,
      outputDir: jobDir
    });

    if (!renderResult.success) {
      throw new Error(renderResult.error || 'Failed to render page');
    }

    // Step 2: Analyze layout
    job.status = 'analyzing';
    console.log(`[${job.id}] Analyzing layout...`);

    let layoutPlan = visionLayoutMCP.analyze({
      desktopScreenshot: renderResult.desktopScreenshot,
      mobileScreenshot: renderResult.mobileScreenshot,
      pageContent: renderResult.pageContent
    });

    // Step 3: Generate and test loop
    let bestHtml = '';
    let bestMismatch = { desktop: 100, mobile: 100 };
    let iteration = 0;

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`[${job.id}] Iteration ${iteration}/${MAX_ITERATIONS}`);

      // Generate HTML
      job.status = 'generating';
      const htmlPath = path.join(jobDir, `generated-v${iteration}.html`);

      const codegenResult = codegenMCP.generateAndSave(
        { layoutPlan, pageContent: renderResult.pageContent },
        htmlPath
      );

      // Test HTML
      job.status = 'testing';
      console.log(`[${job.id}] Testing generated HTML...`);

      const iterationDir = path.join(jobDir, `iteration-${iteration}`);
      const diffResult = await diffTestMCP.test({
        originalDesktop: renderResult.desktopScreenshot,
        originalMobile: renderResult.mobileScreenshot,
        generatedHtml: codegenResult.html,
        outputDir: iterationDir
      });

      // Record iteration result
      const iterationResult: IterationResult = {
        iteration,
        desktopMismatch: diffResult.desktopMismatch,
        mobileMismatch: diffResult.mobileMismatch
      };
      job.iterations.push(iterationResult);

      console.log(`[${job.id}] Desktop mismatch: ${diffResult.desktopMismatch}%, Mobile mismatch: ${diffResult.mobileMismatch}%`);

      // Track best result
      const totalMismatch = diffResult.desktopMismatch + diffResult.mobileMismatch;
      const bestTotalMismatch = bestMismatch.desktop + bestMismatch.mobile;

      if (totalMismatch < bestTotalMismatch) {
        bestHtml = codegenResult.html;
        bestMismatch = {
          desktop: diffResult.desktopMismatch,
          mobile: diffResult.mobileMismatch
        };
      }

      // Check if passes threshold
      if (diffResult.passesThreshold) {
        console.log(`[${job.id}] Passes threshold! Finishing.`);
        bestHtml = codegenResult.html;
        bestMismatch = {
          desktop: diffResult.desktopMismatch,
          mobile: diffResult.mobileMismatch
        };
        break;
      }

      // Refine if not last iteration
      if (iteration < MAX_ITERATIONS) {
        job.status = 'refining';
        console.log(`[${job.id}] Refining layout...`);

        const adjustments = diffTestMCP.suggestAdjustments(
          diffResult.desktopMismatch,
          diffResult.mobileMismatch,
          iteration
        );

        iterationResult.adjustments = adjustments;
        layoutPlan = visionLayoutMCP.refine(layoutPlan, adjustments);
      }
    }

    // Save final HTML
    const finalPath = path.join(jobDir, 'plundered-page.html');
    fs.writeFileSync(finalPath, bestHtml, 'utf-8');

    // Mark job as completed
    job.status = 'completed';
    job.completedAt = new Date();
    job.result = {
      htmlPath: finalPath,
      htmlContent: bestHtml,
      finalDesktopMismatch: bestMismatch.desktop,
      finalMobileMismatch: bestMismatch.mobile,
      iterations: iteration
    };

    console.log(`[${job.id}] Completed! Final mismatch - Desktop: ${bestMismatch.desktop}%, Mobile: ${bestMismatch.mobile}%`);

  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${job.id}] Failed:`, job.error);
  } finally {
    // Clean up browser
    await browserRenderMCP.close();
  }
}

export default router;
