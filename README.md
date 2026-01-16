# Website Plunder

A web application that converts public website URLs into single, self-contained HTML files that visually replicate the original page.

## What It Does

Given a public website URL, Website Plunder generates a downloadable `.html` file that:
- Visually matches the target page
- Contains inline CSS (no external stylesheets)
- Contains inline JavaScript (minimal, no frameworks)
- Opens correctly as a standalone file (`file://` or `http`)
- Is human-readable and easy to edit

This is a **visual clone**, not a DOM scraper. The output is clean, semantic HTML designed for human readability.

## Architecture

The system uses four specialized MCPs (Modular Component Processors), each with a single responsibility:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ BrowserRenderMCP│ ──▶ │ VisionLayoutMCP │ ──▶ │   CodegenMCP    │ ──▶ │   DiffTestMCP   │
│                 │     │                 │     │                 │     │                 │
│ • Playwright    │     │ • Layout plan   │     │ • HTML gen      │     │ • Pixelmatch    │
│ • Screenshots   │     │ • Typography    │     │ • Inline CSS    │     │ • Diff images   │
│ • Content       │     │ • Colors        │     │ • Inline JS     │     │ • Thresholds    │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                                                      │
         └──────────────────────── Refinement Loop ◀────────────────────────────┘
```

### MCP Responsibilities

1. **BrowserRenderMCP**
   - Renders pages via Playwright Chromium
   - Captures full-page screenshots (desktop 1440×900, mobile 390×844)
   - Extracts page content, computed styles, images, fonts, colors
   - Respects robots.txt

2. **VisionLayoutMCP**
   - Analyzes page structure from HTML and styles
   - Produces a structured JSON layout plan
   - Identifies sections (header, hero, content, offers, footer)
   - Extracts typography hierarchy and color scheme

3. **CodegenMCP**
   - Converts layout plan to single HTML file
   - Generates semantic HTML with CSS variables
   - Uses Flexbox/Grid exclusively (no absolute positioning)
   - Wraps offers in `<section class="offer" data-offer-id="...">`

4. **DiffTestMCP**
   - Renders generated HTML via Playwright
   - Compares screenshots using pixelmatch
   - Returns mismatch percentages and diff images
   - Suggests deterministic adjustments for refinement

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd website_plunder-v2

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Running the Server

```bash
# Development mode
npm run dev

# Or build and run production
npm run build
npm start
```

The server starts at http://localhost:3000

### Using the Web UI

1. Open http://localhost:3000 in your browser
2. Enter a public URL (e.g., `https://example.com`)
3. Click "Plunder Page"
4. Wait for processing (typically 30-60 seconds)
5. Download the generated HTML file

### API Usage

```bash
# Start a plunder job
curl -X POST http://localhost:3000/api/plunder \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Response: { "jobId": "...", "status": "pending" }

# Poll for status
curl http://localhost:3000/api/plunder/{jobId}

# Download when complete
curl http://localhost:3000/api/plunder/{jobId}/download > plundered-page.html
```

## Verification Test

Run the automated verification against the test page:

```bash
npm run verify
```

This runs the full pipeline against `https://seniorsavingsbuddy.com/lp6`:

1. Renders original page → screenshots
2. Generates single-file HTML clone
3. Renders clone → screenshots
4. Compares with pixelmatch
5. If mismatch exceeds threshold (Desktop > 6%, Mobile > 8%):
   - Refines layout plan deterministically
   - Regenerates and retests
6. Maximum 3 refinement iterations
7. Outputs best-scoring HTML file

Results are saved to `output/lp6-verification/`.

## Output Format

The generated HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title</title>
  <style>
    /* CSS Variables for easy customization */
    :root {
      --color-primary: #007bff;
      --color-text: #212529;
      /* ... */
    }
    /* Semantic styles using Flexbox/Grid */
  </style>
</head>
<body>
  <header class="header">...</header>
  <section class="hero">...</section>
  <section class="offer" data-offer-id="offer_1">...</section>
  <footer class="footer">...</footer>
  <script>
    /* Minimal JS - no frameworks */
  </script>
</body>
</html>
```

## Configuration

### Thresholds

Default mismatch thresholds (in `src/mcps/DiffTestMCP.ts`):
- Desktop: 6%
- Mobile: 8%

### Viewports

- Desktop: 1440×900
- Mobile: 390×844

## Project Structure

```
website_plunder-v2/
├── src/
│   ├── server.ts              # Express server
│   ├── routes/
│   │   └── plunder.ts         # API routes and orchestration
│   ├── mcps/
│   │   ├── BrowserRenderMCP.ts
│   │   ├── VisionLayoutMCP.ts
│   │   ├── CodegenMCP.ts
│   │   └── DiffTestMCP.ts
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   └── verification/
│       └── lp6-test.ts        # Verification test harness
├── public/
│   └── index.html             # Pirate-themed frontend
├── output/                    # Generated files
├── package.json
├── tsconfig.json
└── README.md
```

## Limitations

- **Not pixel-perfect**: Visual approximation, not exact reproduction
- **No JS behavior**: Does not clone JavaScript functionality
- **Single page only**: No multi-page crawling
- **Public pages only**: Cannot access authenticated content
- **External resources**: Some images/fonts may not load if CORS-restricted
- **Dynamic content**: Cannot capture content loaded via JavaScript after initial render

## Non-Goals

The following are explicitly out of scope:

- Pixel-perfect fidelity
- JavaScript behavior cloning
- Multi-page crawling
- User authentication
- CMS features
- CDN publishing
- Multiple output formats

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Server**: Express
- **Browser**: Playwright (Chromium)
- **Diff**: pixelmatch + pngjs
- **Frontend**: Vanilla HTML/CSS/JS

## License

MIT
