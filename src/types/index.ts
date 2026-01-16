/**
 * Website Plunder - Type Definitions
 */

// ============================================
// Browser Render MCP Types
// ============================================

export interface RenderRequest {
  url: string;
  outputDir: string;
}

export interface RenderResult {
  success: boolean;
  error?: string;
  desktopScreenshot: string;  // Path to desktop screenshot
  mobileScreenshot: string;   // Path to mobile screenshot
  pageTitle: string;
  pageContent: PageContent;
}

export interface PageContent {
  title: string;
  metaDescription: string;
  bodyHtml: string;
  computedStyles: ComputedStyleMap;
  images: ImageInfo[];
  fonts: string[];
  colors: ColorPalette;
}

export interface ComputedStyleMap {
  [selector: string]: {
    styles: Record<string, string>;
    boundingBox: BoundingBox;
  };
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageInfo {
  src: string;
  alt: string;
  width: number;
  height: number;
  dataUrl?: string;  // Base64 encoded for embedding
}

export interface ColorPalette {
  background: string[];
  text: string[];
  accent: string[];
}

// ============================================
// Vision Layout MCP Types
// ============================================

export interface LayoutAnalysisRequest {
  desktopScreenshot: string;
  mobileScreenshot: string;
  pageContent: PageContent;
}

export interface LayoutPlan {
  viewport: {
    desktop: { width: number; height: number };
    mobile: { width: number; height: number };
  };
  sections: LayoutSection[];
  globalStyles: GlobalStyles;
  typography: TypographyPlan;
  colorScheme: ColorScheme;
}

export interface LayoutSection {
  id: string;
  type: SectionType;
  order: number;
  layout: LayoutConfig;
  children: LayoutElement[];
  styles: SectionStyles;
}

export type SectionType =
  | 'header'
  | 'hero'
  | 'content'
  | 'offer-list'
  | 'offer-card'
  | 'features'
  | 'testimonials'
  | 'cta'
  | 'footer'
  | 'generic';

export interface LayoutConfig {
  display: 'flex' | 'grid' | 'block';
  direction?: 'row' | 'column';
  justify?: string;
  align?: string;
  gap?: string;
  gridTemplate?: string;
  maxWidth?: string;
  padding?: string;
  margin?: string;
}

export interface LayoutElement {
  id: string;
  type: ElementType;
  tag: string;
  content?: string;
  src?: string;
  alt?: string;
  href?: string;
  children?: LayoutElement[];
  styles: ElementStyles;
  dataAttributes?: Record<string, string>;
}

export type ElementType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'button'
  | 'link'
  | 'list'
  | 'list-item'
  | 'card'
  | 'icon'
  | 'divider'
  | 'container'
  | 'text';

export interface ElementStyles {
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  border?: string;
  textAlign?: string;
  lineHeight?: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  boxShadow?: string;
}

export interface SectionStyles {
  backgroundColor?: string;
  backgroundImage?: string;
  padding?: string;
  margin?: string;
  minHeight?: string;
  borderBottom?: string;
}

export interface GlobalStyles {
  bodyBackground: string;
  bodyColor: string;
  fontFamily: string;
  lineHeight: string;
  maxWidth: string;
}

export interface TypographyPlan {
  baseSize: string;
  scale: number;
  h1: TypographyLevel;
  h2: TypographyLevel;
  h3: TypographyLevel;
  h4: TypographyLevel;
  body: TypographyLevel;
  small: TypographyLevel;
}

export interface TypographyLevel {
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  marginBottom: string;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
}

// ============================================
// Codegen MCP Types
// ============================================

export interface CodegenRequest {
  layoutPlan: LayoutPlan;
  pageContent: PageContent;
}

export interface CodegenResult {
  html: string;
  filePath: string;
}

// ============================================
// Diff Test MCP Types
// ============================================

export interface DiffTestRequest {
  originalDesktop: string;
  originalMobile: string;
  generatedHtml: string;
  outputDir: string;
}

export interface DiffTestResult {
  success: boolean;
  desktopMismatch: number;  // Percentage 0-100
  mobileMismatch: number;   // Percentage 0-100
  desktopDiffImage: string;
  mobileDiffImage: string;
  passesThreshold: boolean;
}

// ============================================
// Plunder Job Types
// ============================================

export interface PlunderJob {
  id: string;
  url: string;
  status: JobStatus;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  result?: PlunderResult;
  iterations: IterationResult[];
}

export type JobStatus = 'pending' | 'rendering' | 'analyzing' | 'generating' | 'testing' | 'refining' | 'completed' | 'failed';

export interface PlunderResult {
  htmlPath: string;
  htmlContent: string;
  finalDesktopMismatch: number;
  finalMobileMismatch: number;
  iterations: number;
}

export interface IterationResult {
  iteration: number;
  desktopMismatch: number;
  mobileMismatch: number;
  adjustments?: string[];
}

// ============================================
// API Types
// ============================================

export interface PlunderRequest {
  url: string;
}

export interface PlunderResponse {
  jobId: string;
  status: JobStatus;
  message?: string;
  downloadUrl?: string;
  htmlContent?: string;
  iterations?: IterationResult[];
}
