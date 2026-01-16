/**
 * CodegenMCP
 *
 * Responsibility: Converts the layout plan into a SINGLE HTML FILE.
 * - Generates semantic HTML
 * - Creates inline <style> with CSS variables
 * - Adds minimal inline <script> (no frameworks)
 * - Uses Flexbox / Grid exclusively
 * - Output is human-readable and easy to modify
 *
 * Special handling for offer pages: each offer is wrapped in
 * <section class="offer" data-offer-id="offer_name">...</section>
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CodegenRequest,
  CodegenResult,
  LayoutPlan,
  LayoutSection,
  LayoutElement,
  PageContent
} from '../types';

export class CodegenMCP {
  /**
   * Generate CSS from layout plan
   */
  private generateCSS(layoutPlan: LayoutPlan): string {
    const { globalStyles, typography, colorScheme } = layoutPlan;

    return `
/* ===========================================
   CSS Variables - Easy to customize
   =========================================== */
:root {
  /* Colors */
  --color-primary: ${colorScheme.primary};
  --color-secondary: ${colorScheme.secondary};
  --color-accent: ${colorScheme.accent};
  --color-background: ${colorScheme.background};
  --color-surface: ${colorScheme.surface};
  --color-text: ${colorScheme.text};
  --color-text-muted: ${colorScheme.textMuted};
  --color-border: ${colorScheme.border};

  /* Typography */
  --font-family: ${globalStyles.fontFamily};
  --font-size-base: ${typography.baseSize};
  --line-height-base: ${globalStyles.lineHeight};

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;

  /* Layout */
  --max-width: ${globalStyles.maxWidth};
  --border-radius: 8px;
}

/* ===========================================
   Reset & Base Styles
   =========================================== */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
  background-color: var(--color-background);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

a {
  color: var(--color-primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* ===========================================
   Typography
   =========================================== */
h1 {
  font-size: ${typography.h1.fontSize};
  font-weight: ${typography.h1.fontWeight};
  line-height: ${typography.h1.lineHeight};
  margin-bottom: ${typography.h1.marginBottom};
  color: var(--color-text);
}

h2 {
  font-size: ${typography.h2.fontSize};
  font-weight: ${typography.h2.fontWeight};
  line-height: ${typography.h2.lineHeight};
  margin-bottom: ${typography.h2.marginBottom};
  color: var(--color-text);
}

h3 {
  font-size: ${typography.h3.fontSize};
  font-weight: ${typography.h3.fontWeight};
  line-height: ${typography.h3.lineHeight};
  margin-bottom: ${typography.h3.marginBottom};
  color: var(--color-text);
}

h4 {
  font-size: ${typography.h4.fontSize};
  font-weight: ${typography.h4.fontWeight};
  line-height: ${typography.h4.lineHeight};
  margin-bottom: ${typography.h4.marginBottom};
  color: var(--color-text);
}

p {
  font-size: ${typography.body.fontSize};
  line-height: ${typography.body.lineHeight};
  margin-bottom: ${typography.body.marginBottom};
  color: var(--color-text);
}

.text-muted {
  color: var(--color-text-muted);
}

.text-small {
  font-size: ${typography.small.fontSize};
}

/* ===========================================
   Layout Components
   =========================================== */
.container {
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--spacing-md);
}

.section {
  padding: var(--spacing-2xl) var(--spacing-md);
}

.flex {
  display: flex;
}

.flex-column {
  flex-direction: column;
}

.flex-row {
  flex-direction: row;
}

.flex-wrap {
  flex-wrap: wrap;
}

.justify-center {
  justify-content: center;
}

.justify-between {
  justify-content: space-between;
}

.align-center {
  align-items: center;
}

.gap-sm {
  gap: var(--spacing-sm);
}

.gap-md {
  gap: var(--spacing-md);
}

.gap-lg {
  gap: var(--spacing-lg);
}

.text-center {
  text-align: center;
}

/* ===========================================
   Header Styles
   =========================================== */
.header {
  background-color: var(--color-surface);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
}

.nav {
  display: flex;
  gap: var(--spacing-lg);
}

.nav a {
  color: var(--color-text);
  font-weight: 500;
}

/* ===========================================
   Hero Styles
   =========================================== */
.hero {
  padding: var(--spacing-2xl) var(--spacing-md);
  text-align: center;
  background-color: var(--color-surface);
}

.hero h1 {
  max-width: 800px;
  margin: 0 auto var(--spacing-lg);
}

.hero p {
  max-width: 600px;
  margin: 0 auto var(--spacing-xl);
  color: var(--color-text-muted);
  font-size: 1.125rem;
}

/* ===========================================
   Content Styles
   =========================================== */
.content {
  padding: var(--spacing-xl) var(--spacing-md);
}

.content .container {
  max-width: 800px;
}

/* ===========================================
   Offer / Card Styles
   =========================================== */
.offer-list {
  padding: var(--spacing-xl) var(--spacing-md);
}

.offer-list .container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 800px;
}

.offer {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  padding: var(--spacing-lg);
  transition: box-shadow 0.2s ease;
}

.offer:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.offer-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.offer-logo {
  width: 60px;
  height: 60px;
  object-fit: contain;
  border-radius: var(--border-radius);
}

.offer-title {
  flex: 1;
}

.offer-title h3 {
  margin-bottom: var(--spacing-xs);
}

.offer-rating {
  color: var(--color-accent);
  font-weight: 600;
}

.offer-description {
  margin-bottom: var(--spacing-md);
  color: var(--color-text-muted);
}

.offer-features {
  list-style: none;
  margin-bottom: var(--spacing-md);
}

.offer-features li {
  padding: var(--spacing-xs) 0;
  padding-left: var(--spacing-lg);
  position: relative;
}

.offer-features li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--color-primary);
  font-weight: 600;
}

/* ===========================================
   Button Styles
   =========================================== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-secondary);
  text-decoration: none;
}

.btn-secondary {
  background-color: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background-color: var(--color-border);
  text-decoration: none;
}

.btn-large {
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: 1.125rem;
}

.btn-block {
  display: flex;
  width: 100%;
}

/* ===========================================
   CTA Styles
   =========================================== */
.cta {
  padding: var(--spacing-2xl) var(--spacing-md);
  background-color: var(--color-primary);
  color: white;
  text-align: center;
}

.cta h2 {
  color: white;
  margin-bottom: var(--spacing-md);
}

.cta p {
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: var(--spacing-lg);
}

.cta .btn-primary {
  background-color: white;
  color: var(--color-primary);
}

/* ===========================================
   Footer Styles
   =========================================== */
.footer {
  padding: var(--spacing-xl) var(--spacing-md);
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-border);
  text-align: center;
  color: var(--color-text-muted);
  font-size: ${typography.small.fontSize};
}

.footer a {
  color: var(--color-text-muted);
}

/* ===========================================
   Responsive Styles
   =========================================== */
@media (max-width: 768px) {
  :root {
    --font-size-base: 15px;
  }

  h1 {
    font-size: calc(${typography.h1.fontSize} * 0.75);
  }

  h2 {
    font-size: calc(${typography.h2.fontSize} * 0.8);
  }

  h3 {
    font-size: calc(${typography.h3.fontSize} * 0.85);
  }

  .header .container {
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .nav {
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--spacing-md);
  }

  .offer-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .btn-large {
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .section {
    padding: var(--spacing-lg) var(--spacing-sm);
  }

  .offer {
    padding: var(--spacing-md);
  }
}
    `.trim();
  }

  /**
   * Generate HTML element from LayoutElement
   */
  private generateElement(element: LayoutElement, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    const { type, tag, content, src, alt, href, children, styles, dataAttributes } = element;

    // Build inline style string
    const styleStr = Object.entries(styles || {})
      .filter(([_, v]) => v)
      .map(([k, v]) => `${this.camelToKebab(k)}: ${v}`)
      .join('; ');

    // Build data attributes string
    const dataStr = Object.entries(dataAttributes || {})
      .map(([k, v]) => `data-${k}="${this.escapeHtml(v)}"`)
      .join(' ');

    const styleAttr = styleStr ? ` style="${styleStr}"` : '';
    const dataAttr = dataStr ? ` ${dataStr}` : '';

    switch (type) {
      case 'heading':
        return `${indent}<${tag}${styleAttr}>${this.escapeHtml(content || '')}</${tag}>`;

      case 'paragraph':
        return `${indent}<p${styleAttr}>${this.escapeHtml(content || '')}</p>`;

      case 'image':
        const imgAlt = alt ? ` alt="${this.escapeHtml(alt)}"` : '';
        return `${indent}<img src="${src || ''}"${imgAlt}${styleAttr} loading="lazy">`;

      case 'button':
      case 'link':
        const linkHref = href || '#';
        const btnClass = type === 'button' ? ' class="btn btn-primary"' : '';
        return `${indent}<a href="${linkHref}"${btnClass}${styleAttr}>${this.escapeHtml(content || '')}</a>`;

      case 'list':
        const listItems = (children || [])
          .map(child => this.generateElement(child, depth + 1))
          .join('\n');
        return `${indent}<ul${styleAttr}>\n${listItems}\n${indent}</ul>`;

      case 'list-item':
        return `${indent}<li${styleAttr}>${this.escapeHtml(content || '')}</li>`;

      case 'card':
        const cardContent = (children || [])
          .map(child => this.generateElement(child, depth + 1))
          .join('\n');
        return `${indent}<div class="offer"${dataAttr}${styleAttr}>\n${cardContent}\n${indent}</div>`;

      case 'container':
        const containerContent = (children || [])
          .map(child => this.generateElement(child, depth + 1))
          .join('\n');
        return `${indent}<div${styleAttr}>\n${containerContent}\n${indent}</div>`;

      case 'divider':
        return `${indent}<hr${styleAttr}>`;

      case 'text':
      default:
        return `${indent}<span${styleAttr}>${this.escapeHtml(content || '')}</span>`;
    }
  }

  /**
   * Generate HTML section from LayoutSection
   */
  private generateSection(section: LayoutSection): string {
    const { id, type, children, layout, styles } = section;

    // Determine tag and class based on section type
    let tag = 'section';
    let className = type;

    if (type === 'header') tag = 'header';
    else if (type === 'footer') tag = 'footer';
    else if (type === 'content') tag = 'main';

    // Build style string
    const sectionStyles = { ...styles };
    const styleStr = Object.entries(sectionStyles)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${this.camelToKebab(k)}: ${v}`)
      .join('; ');
    const styleAttr = styleStr ? ` style="${styleStr}"` : '';

    // Build data attribute for offers
    const dataAttr = type === 'offer-card' ? ` data-offer-id="${id}"` : '';

    // Generate children HTML
    const childrenHtml = children
      .map(child => this.generateElement(child, 2))
      .join('\n');

    // Use container wrapper for centered content
    const useContainer = ['hero', 'content', 'cta', 'offer-list'].includes(type);

    if (useContainer) {
      return `
  <${tag} class="${className}"${dataAttr}${styleAttr}>
    <div class="container">
${childrenHtml}
    </div>
  </${tag}>`.trim();
    }

    return `
  <${tag} class="${className}"${dataAttr}${styleAttr}>
    <div class="container">
${childrenHtml}
    </div>
  </${tag}>`.trim();
  }

  /**
   * Generate minimal JavaScript for the page
   */
  private generateJS(): string {
    return `
/* ===========================================
   Minimal JavaScript - No frameworks
   =========================================== */
(function() {
  'use strict';

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Add loaded class for any CSS transitions
  document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('loaded');
  });
})();
    `.trim();
  }

  /**
   * Generate complete HTML document
   */
  generate(request: CodegenRequest): string {
    const { layoutPlan, pageContent } = request;

    const css = this.generateCSS(layoutPlan);
    const js = this.generateJS();

    // Generate sections HTML
    const sectionsHtml = layoutPlan.sections
      .sort((a, b) => a.order - b.order)
      .map(section => this.generateSection(section))
      .join('\n\n');

    // Build meta tags
    const title = pageContent.title || 'Plundered Page';
    const description = pageContent.metaDescription || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${this.escapeHtml(description)}">
  <title>${this.escapeHtml(title)}</title>

  <style>
${css}
  </style>
</head>
<body>

${sectionsHtml}

  <script>
${js}
  </script>
</body>
</html>`;
  }

  /**
   * Generate and save HTML file
   */
  generateAndSave(request: CodegenRequest, outputPath: string): CodegenResult {
    const html = this.generate(request);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, html, 'utf-8');

    return {
      html,
      filePath: outputPath
    };
  }

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const codegenMCP = new CodegenMCP();
