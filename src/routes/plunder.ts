/**
 * Plunder Route
 *
 * Simplified approach: Extract page HTML with styles directly
 * No complex analysis or regeneration - just capture what's there.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

import { browserRenderMCP } from '../mcps/BrowserRenderMCP';
import { diffTestMCP } from '../mcps/DiffTestMCP';

const router = Router();

// Job types
interface PlunderJob {
  id: string;
  url: string;
  status: 'pending' | 'rendering' | 'testing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  result?: {
    htmlPath: string;
    htmlContent: string;
    desktopMismatch: number;
    mobileMismatch: number;
  };
}

interface PlunderResponse {
  jobId: string;
  status: string;
  message?: string;
  downloadUrl?: string;
  desktopMatch?: number;
  mobileMatch?: number;
}

// In-memory job storage
const jobs = new Map<string, PlunderJob>();

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
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({
      jobId: '',
      status: 'failed',
      message: 'Invalid URL. Please provide a valid http or https URL.'
    });
  }

  const jobId = uuidv4();
  const jobDir = path.join(OUTPUT_DIR, jobId);

  const job: PlunderJob = {
    id: jobId,
    url,
    status: 'pending',
    createdAt: new Date()
  };

  jobs.set(jobId, job);

  // Process in background
  processJob(job, jobDir).catch(error => {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
  });

  return res.json({
    jobId,
    status: 'pending',
    message: 'Plunder job started.'
  });
});

/**
 * GET /api/plunder/:jobId
 * Get job status
 */
router.get('/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      jobId,
      status: 'failed',
      message: 'Job not found'
    });
  }

  const response: PlunderResponse = {
    jobId: job.id,
    status: job.status
  };

  if (job.status === 'completed' && job.result) {
    response.downloadUrl = `/api/plunder/${jobId}/download`;
    response.desktopMatch = 100 - job.result.desktopMismatch;
    response.mobileMatch = 100 - job.result.mobileMismatch;
  }

  if (job.status === 'failed') {
    response.message = job.error || 'Unknown error';
  }

  return res.json(response);
});

/**
 * GET /api/plunder/:jobId/download
 * Download generated HTML
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
 * Process the plunder job - simplified direct extraction
 */
async function processJob(job: PlunderJob, jobDir: string): Promise<void> {
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  try {
    // Step 1: Extract page with styles
    job.status = 'rendering';
    console.log(`[${job.id}] Extracting page: ${job.url}`);

    const result = await browserRenderMCP.extractPage(job.url, jobDir);

    if (!result.success) {
      throw new Error(result.error || 'Failed to extract page');
    }

    // Step 2: Test the extracted HTML
    job.status = 'testing';
    console.log(`[${job.id}] Testing extracted HTML...`);

    const testDir = path.join(jobDir, 'test');
    const diffResult = await diffTestMCP.test({
      originalDesktop: result.desktopScreenshot,
      originalMobile: result.mobileScreenshot,
      generatedHtml: result.html,
      outputDir: testDir
    });

    // Save final HTML
    const finalPath = path.join(jobDir, 'plundered-page.html');
    fs.writeFileSync(finalPath, result.html, 'utf-8');

    // Complete
    job.status = 'completed';
    job.completedAt = new Date();
    job.result = {
      htmlPath: finalPath,
      htmlContent: result.html,
      desktopMismatch: diffResult.desktopMismatch,
      mobileMismatch: diffResult.mobileMismatch
    };

    console.log(`[${job.id}] Completed! Desktop: ${diffResult.desktopMismatch.toFixed(1)}%, Mobile: ${diffResult.mobileMismatch.toFixed(1)}%`);

  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${job.id}] Failed:`, job.error);
  } finally {
    await browserRenderMCP.close();
  }
}

export default router;
