/**
 * VisionLayoutMCP
 *
 * Responsibility: Analyzes page content and computed styles to produce a structured layout plan.
 * - Identifies sections (header, hero, content, offer cards, footer)
 * - Determines spacing and layout patterns
 * - Extracts typography hierarchy
 * - Identifies colors and background blocks
 *
 * Note: This is a deterministic analyzer, not an LLM-based vision system.
 * It parses the HTML structure and computed styles to build the layout plan.
 */

import {
  LayoutAnalysisRequest,
  LayoutPlan,
  LayoutSection,
  LayoutElement,
  PageContent,
  ComputedStyleMap,
  GlobalStyles,
  TypographyPlan,
  ColorScheme,
  SectionType,
  ElementType,
  LayoutConfig,
  SectionStyles,
  ElementStyles
} from '../types';

export class VisionLayoutMCP {
  /**
   * Parse RGB/RGBA color string to hex
   */
  private rgbToHex(rgb: string): string {
    if (rgb.startsWith('#')) return rgb;

    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return rgb;
  }

  /**
   * Get the most common color from an array
   */
  private getMostCommonColor(colors: string[], defaultColor: string): string {
    if (colors.length === 0) return defaultColor;

    const counts = new Map<string, number>();
    for (const color of colors) {
      const hex = this.rgbToHex(color);
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon = defaultColor;
    for (const [color, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = color;
      }
    }
    return mostCommon;
  }

  /**
   * Determine section type from HTML content and classes
   */
  private determineSectionType(html: string, classes: string): SectionType {
    const lowerClasses = classes.toLowerCase();
    const lowerHtml = html.toLowerCase();

    if (lowerClasses.includes('header') || lowerHtml.includes('<header')) return 'header';
    if (lowerClasses.includes('footer') || lowerHtml.includes('<footer')) return 'footer';
    if (lowerClasses.includes('hero') || lowerClasses.includes('banner')) return 'hero';
    if (lowerClasses.includes('offer') || lowerClasses.includes('card')) return 'offer-list';
    if (lowerClasses.includes('cta') || lowerClasses.includes('action')) return 'cta';
    if (lowerClasses.includes('feature')) return 'features';
    if (lowerClasses.includes('testimonial') || lowerClasses.includes('review')) return 'testimonials';

    return 'content';
  }

  /**
   * Extract element type from tag name and attributes
   */
  private getElementType(tag: string, classes: string): ElementType {
    const lowerTag = tag.toLowerCase();
    const lowerClasses = classes.toLowerCase();

    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(lowerTag)) return 'heading';
    if (lowerTag === 'p') return 'paragraph';
    if (lowerTag === 'img') return 'image';
    if (lowerTag === 'button' || lowerClasses.includes('btn') || lowerClasses.includes('button')) return 'button';
    if (lowerTag === 'a') return 'link';
    if (lowerTag === 'ul' || lowerTag === 'ol') return 'list';
    if (lowerTag === 'li') return 'list-item';
    if (lowerClasses.includes('card') || lowerClasses.includes('offer')) return 'card';
    if (lowerTag === 'hr') return 'divider';
    if (lowerTag === 'div' || lowerTag === 'section' || lowerTag === 'article') return 'container';

    return 'text';
  }

  /**
   * Parse CSS value to standardized form
   */
  private parseSpacing(value: string | undefined): string {
    if (!value) return '0';
    // Convert px to rem for consistency
    const pxMatch = value.match(/^(\d+(?:\.\d+)?)px$/);
    if (pxMatch) {
      const px = parseFloat(pxMatch[1]);
      return `${(px / 16).toFixed(2)}rem`;
    }
    return value;
  }

  /**
   * Extract layout configuration from computed styles
   */
  private extractLayoutConfig(styles: Record<string, string>): LayoutConfig {
    const config: LayoutConfig = {
      display: 'block'
    };

    const display = styles.display || 'block';
    if (display === 'flex') {
      config.display = 'flex';
      config.direction = styles.flexDirection === 'column' ? 'column' : 'row';
      config.justify = styles.justifyContent || 'flex-start';
      config.align = styles.alignItems || 'stretch';
      config.gap = this.parseSpacing(styles.gap);
    } else if (display === 'grid') {
      config.display = 'grid';
      config.gridTemplate = styles.gridTemplateColumns || 'auto';
      config.gap = this.parseSpacing(styles.gap);
    }

    if (styles.maxWidth) {
      config.maxWidth = styles.maxWidth;
    }

    if (styles.padding) {
      config.padding = styles.padding;
    }

    if (styles.margin) {
      config.margin = styles.margin;
    }

    return config;
  }

  /**
   * Parse HTML to extract structured elements
   */
  private parseHtmlToElements(html: string, computedStyles: ComputedStyleMap): LayoutElement[] {
    const elements: LayoutElement[] = [];

    // Simple regex-based parser (not a full DOM parser, but sufficient for our needs)
    // We'll extract key elements like headings, paragraphs, images, buttons, etc.

    // Extract headings
    const headingRegex = /<(h[1-6])[^>]*(?:class="([^"]*)")?[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = headingRegex.exec(html)) !== null) {
      const tag = match[1];
      const classes = match[2] || '';
      const content = match[3].replace(/<[^>]*>/g, '').trim();

      if (content) {
        elements.push({
          id: `${tag}-${elements.length}`,
          type: 'heading',
          tag: tag,
          content,
          styles: this.extractElementStyles(tag, classes, computedStyles)
        });
      }
    }

    // Extract paragraphs
    const pRegex = /<p[^>]*(?:class="([^"]*)")?[^>]*>([\s\S]*?)<\/p>/gi;
    while ((match = pRegex.exec(html)) !== null) {
      const classes = match[1] || '';
      const content = match[2].replace(/<[^>]*>/g, '').trim();

      if (content && content.length > 10) {
        elements.push({
          id: `p-${elements.length}`,
          type: 'paragraph',
          tag: 'p',
          content,
          styles: this.extractElementStyles('p', classes, computedStyles)
        });
      }
    }

    // Extract images
    const imgRegex = /<img[^>]*src="([^"]*)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      const alt = match[2] || '';

      elements.push({
        id: `img-${elements.length}`,
        type: 'image',
        tag: 'img',
        src,
        alt,
        styles: {}
      });
    }

    // Extract buttons and CTAs
    const buttonRegex = /<(?:button|a)[^>]*(?:class="([^"]*)")?[^>]*(?:href="([^"]*)")?[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
    while ((match = buttonRegex.exec(html)) !== null) {
      const classes = match[1] || '';
      const href = match[2];
      const content = match[3].replace(/<[^>]*>/g, '').trim();

      if (content && (classes.includes('btn') || classes.includes('button') || classes.includes('cta'))) {
        elements.push({
          id: `btn-${elements.length}`,
          type: 'button',
          tag: 'a',
          content,
          href: href || '#',
          styles: this.extractElementStyles('button', classes, computedStyles)
        });
      }
    }

    return elements;
  }

  /**
   * Extract element styles from computed styles map
   */
  private extractElementStyles(tag: string, classes: string, computedStyles: ComputedStyleMap): ElementStyles {
    // Find matching computed styles
    for (const [selector, data] of Object.entries(computedStyles)) {
      if (selector.startsWith(tag) || (classes && selector.includes(classes))) {
        const styles = data.styles;
        return {
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          fontFamily: styles.fontFamily,
          color: styles.color ? this.rgbToHex(styles.color) : undefined,
          backgroundColor: styles.backgroundColor ? this.rgbToHex(styles.backgroundColor) : undefined,
          padding: styles.padding,
          margin: styles.margin,
          borderRadius: styles.borderRadius,
          textAlign: styles.textAlign,
          lineHeight: styles.lineHeight
        };
      }
    }
    return {};
  }

  /**
   * Build color scheme from extracted colors
   */
  private buildColorScheme(colors: { background: string[]; text: string[]; accent: string[] }): ColorScheme {
    const bgColors = colors.background.map(c => this.rgbToHex(c));
    const textColors = colors.text.map(c => this.rgbToHex(c));
    const accentColors = colors.accent.map(c => this.rgbToHex(c));

    return {
      primary: accentColors[0] || '#007bff',
      secondary: accentColors[1] || '#6c757d',
      accent: accentColors[2] || '#ffc107',
      background: bgColors.find(c => c !== '#ffffff' && c !== '#000000') || '#ffffff',
      surface: bgColors.find(c => c !== '#ffffff') || '#f8f9fa',
      text: textColors.find(c => c !== '#ffffff') || '#212529',
      textMuted: textColors.find(c => c.includes('6') || c.includes('7') || c.includes('8')) || '#6c757d',
      border: '#dee2e6'
    };
  }

  /**
   * Build typography plan from computed styles
   */
  private buildTypographyPlan(computedStyles: ComputedStyleMap): TypographyPlan {
    // Default typography plan
    const plan: TypographyPlan = {
      baseSize: '16px',
      scale: 1.25,
      h1: { fontSize: '2.5rem', fontWeight: '700', lineHeight: '1.2', marginBottom: '1rem' },
      h2: { fontSize: '2rem', fontWeight: '600', lineHeight: '1.3', marginBottom: '0.75rem' },
      h3: { fontSize: '1.5rem', fontWeight: '600', lineHeight: '1.4', marginBottom: '0.5rem' },
      h4: { fontSize: '1.25rem', fontWeight: '500', lineHeight: '1.4', marginBottom: '0.5rem' },
      body: { fontSize: '1rem', fontWeight: '400', lineHeight: '1.6', marginBottom: '1rem' },
      small: { fontSize: '0.875rem', fontWeight: '400', lineHeight: '1.5', marginBottom: '0.5rem' }
    };

    // Extract from computed styles if available
    for (const [selector, data] of Object.entries(computedStyles)) {
      const styles = data.styles;
      if (selector.startsWith('h1')) {
        plan.h1.fontSize = styles.fontSize || plan.h1.fontSize;
        plan.h1.fontWeight = styles.fontWeight || plan.h1.fontWeight;
        plan.h1.lineHeight = styles.lineHeight || plan.h1.lineHeight;
      } else if (selector.startsWith('h2')) {
        plan.h2.fontSize = styles.fontSize || plan.h2.fontSize;
        plan.h2.fontWeight = styles.fontWeight || plan.h2.fontWeight;
      } else if (selector.startsWith('h3')) {
        plan.h3.fontSize = styles.fontSize || plan.h3.fontSize;
        plan.h3.fontWeight = styles.fontWeight || plan.h3.fontWeight;
      } else if (selector.startsWith('p')) {
        plan.body.fontSize = styles.fontSize || plan.body.fontSize;
        plan.body.lineHeight = styles.lineHeight || plan.body.lineHeight;
      }
    }

    return plan;
  }

  /**
   * Build global styles from page content
   */
  private buildGlobalStyles(pageContent: PageContent): GlobalStyles {
    const colors = pageContent.colors;
    const fonts = pageContent.fonts;

    return {
      bodyBackground: this.getMostCommonColor(colors.background, '#ffffff'),
      bodyColor: this.getMostCommonColor(colors.text, '#333333'),
      fontFamily: fonts.length > 0
        ? `${fonts[0]}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      lineHeight: '1.6',
      maxWidth: '1200px'
    };
  }

  /**
   * Identify and build sections from HTML content
   */
  private buildSections(pageContent: PageContent): LayoutSection[] {
    const html = pageContent.bodyHtml;
    const computedStyles = pageContent.computedStyles;
    const sections: LayoutSection[] = [];

    // Parse major sections from HTML
    const sectionRegex = /<(header|section|main|footer|article|div)[^>]*(?:class="([^"]*)")?[^>]*(?:id="([^"]*)")?[^>]*>([\s\S]*?)<\/\1>/gi;

    let order = 0;
    let match;

    while ((match = sectionRegex.exec(html)) !== null) {
      const tag = match[1];
      const classes = match[2] || '';
      const id = match[3] || '';
      const content = match[4];

      // Skip very small sections
      if (content.length < 50) continue;

      const sectionType = this.determineSectionType(content, classes);
      const elements = this.parseHtmlToElements(content, computedStyles);

      // Skip sections with no meaningful content
      if (elements.length === 0) continue;

      const section: LayoutSection = {
        id: id || `section-${order}`,
        type: sectionType,
        order: order++,
        layout: this.extractLayoutConfig({}),
        children: elements,
        styles: {
          padding: '2rem 1rem'
        }
      };

      // Special handling for offer cards
      if (sectionType === 'offer-list' || classes.includes('offer') || classes.includes('card')) {
        section.layout = {
          display: 'flex',
          direction: 'column',
          gap: '1.5rem',
          maxWidth: '800px',
          padding: '1rem'
        };
      }

      sections.push(section);
    }

    // If no sections found, create a default content section
    if (sections.length === 0) {
      const elements = this.parseHtmlToElements(html, computedStyles);
      sections.push({
        id: 'main-content',
        type: 'content',
        order: 0,
        layout: {
          display: 'block',
          maxWidth: '1200px',
          padding: '2rem 1rem'
        },
        children: elements,
        styles: {}
      });
    }

    return sections;
  }

  /**
   * Analyze the page and produce a structured layout plan
   */
  analyze(request: LayoutAnalysisRequest): LayoutPlan {
    const { pageContent } = request;

    const globalStyles = this.buildGlobalStyles(pageContent);
    const typography = this.buildTypographyPlan(pageContent.computedStyles);
    const colorScheme = this.buildColorScheme(pageContent.colors);
    const sections = this.buildSections(pageContent);

    return {
      viewport: {
        desktop: { width: 1440, height: 900 },
        mobile: { width: 390, height: 844 }
      },
      sections,
      globalStyles,
      typography,
      colorScheme
    };
  }

  /**
   * Refine layout plan based on diff results
   * This makes deterministic adjustments to improve visual match
   */
  refine(layoutPlan: LayoutPlan, adjustments: string[]): LayoutPlan {
    const refined = JSON.parse(JSON.stringify(layoutPlan)) as LayoutPlan;

    for (const adjustment of adjustments) {
      if (adjustment.includes('spacing')) {
        // Increase section padding
        for (const section of refined.sections) {
          if (section.styles.padding) {
            const current = parseFloat(section.styles.padding) || 2;
            section.styles.padding = `${current * 1.1}rem 1rem`;
          }
        }
      }

      if (adjustment.includes('font')) {
        // Adjust font sizes
        const scale = adjustment.includes('larger') ? 1.05 : 0.95;
        refined.typography.h1.fontSize = this.scaleFontSize(refined.typography.h1.fontSize, scale);
        refined.typography.h2.fontSize = this.scaleFontSize(refined.typography.h2.fontSize, scale);
        refined.typography.h3.fontSize = this.scaleFontSize(refined.typography.h3.fontSize, scale);
        refined.typography.body.fontSize = this.scaleFontSize(refined.typography.body.fontSize, scale);
      }

      if (adjustment.includes('line-height')) {
        const scale = adjustment.includes('increase') ? 1.1 : 0.9;
        refined.typography.body.lineHeight = String(parseFloat(refined.typography.body.lineHeight) * scale);
      }

      if (adjustment.includes('card-width')) {
        // Adjust card/offer widths
        for (const section of refined.sections) {
          if (section.type === 'offer-list' || section.type === 'offer-card') {
            section.layout.maxWidth = adjustment.includes('wider') ? '900px' : '700px';
          }
        }
      }

      if (adjustment.includes('alignment')) {
        // Adjust alignment
        for (const section of refined.sections) {
          section.layout.align = adjustment.includes('center') ? 'center' : 'flex-start';
        }
      }
    }

    return refined;
  }

  /**
   * Scale font size by a factor
   */
  private scaleFontSize(fontSize: string, scale: number): string {
    const match = fontSize.match(/^([\d.]+)(rem|px|em)$/);
    if (match) {
      const value = parseFloat(match[1]) * scale;
      return `${value.toFixed(2)}${match[2]}`;
    }
    return fontSize;
  }
}

export const visionLayoutMCP = new VisionLayoutMCP();
