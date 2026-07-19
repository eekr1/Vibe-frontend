import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stylesDirectory = join(projectRoot, 'src', 'styles');
const tokensCss = readFileSync(join(stylesDirectory, 'tokens.css'), 'utf8');
const baseCss = readFileSync(join(stylesDirectory, 'base.css'), 'utf8');
const styleEntry = readFileSync(join(projectRoot, 'src', 'styles.css'), 'utf8');
const indexHtml = readFileSync(join(projectRoot, 'index.html'), 'utf8');

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(path) : entry.name.endsWith('.css') ? [path] : [];
  });
}

function tokenValue(name: string): string {
  const match = tokensCss.match(new RegExp('--' + name + ':\\s*([^;]+);'));
  if (!match) {
    throw new Error('Missing token --' + name);
  }
  return match[1].trim().toLowerCase();
}

function rgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as [number, number, number];
}

function relativeLuminance(hex: string): number {
  return rgb(hex)
    .map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe('Wave 01 design foundation contract', () => {
  it('locks the canonical Hall, surface, text, accent and semantic state palette', () => {
    expect({
      hall: tokenValue('color-bg-hall'),
      surface: tokenValue('color-surface-standard'),
      elevated: tokenValue('color-surface-elevated'),
      hover: tokenValue('color-surface-hover'),
      primaryText: tokenValue('color-text-primary'),
      secondaryText: tokenValue('color-text-secondary'),
      mutedText: tokenValue('color-text-muted'),
      accent: tokenValue('color-accent'),
      accentHover: tokenValue('color-accent-hover'),
      accentPressed: tokenValue('color-accent-pressed'),
      accentContrast: tokenValue('color-accent-contrast'),
      success: tokenValue('color-success'),
      warning: tokenValue('color-warning'),
      danger: tokenValue('color-danger')
    }).toEqual({
      hall: '#090a0f',
      surface: '#10121a',
      elevated: '#171a24',
      hover: '#1d2130',
      primaryText: '#f5f7fa',
      secondaryText: '#a8afbf',
      mutedText: '#7b8396',
      accent: '#ff625a',
      accentHover: '#ff766f',
      accentPressed: '#e9544d',
      accentContrast: '#090a0f',
      success: '#5ed7a0',
      warning: '#f0b55a',
      danger: '#e45b6a'
    });
  });

  it('self-hosts only the approved Manrope and Inter weights with safe fallbacks', () => {
    expect(styleEntry).toContain("@fontsource/manrope/latin-ext-600.css");
    expect(styleEntry).toContain("@fontsource/manrope/latin-ext-700.css");
    expect(styleEntry).toContain("@fontsource/inter/latin-ext-400.css");
    expect(styleEntry).toContain("@fontsource/inter/latin-ext-500.css");
    expect(styleEntry).toContain("@fontsource/inter/latin-ext-600.css");
    expect(tokenValue('font-family-heading')).toContain('manrope');
    expect(tokenValue('font-family-base')).toContain('inter');
    expect(baseCss).toContain(':where(h1, h2, h3, h4)');
    expect(baseCss).toContain('font-family: var(--font-family-heading)');
  });

  it('centralizes spacing, borders, glass and shadow boundaries without a parallel surface system', () => {
    expect(['0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem', '3rem', '4rem', '6rem']).toEqual([
      tokenValue('space-1'),
      tokenValue('space-2'),
      tokenValue('space-3'),
      tokenValue('space-4'),
      tokenValue('space-6'),
      tokenValue('space-8'),
      tokenValue('space-12'),
      tokenValue('space-16'),
      tokenValue('space-24')
    ]);
    expect(tokenValue('color-border-normal')).toBe('rgba(255, 255, 255, 0.08)');
    expect(tokenValue('color-border-active')).toBe('rgba(255, 255, 255, 0.12)');
    expect(tokenValue('glass-background')).toBe('rgba(16, 18, 26, 0.78)');
    expect(tokenValue('glass-blur')).toBe('18px');
    expect(tokenValue('glass-border')).toBe('rgba(255, 255, 255, 0.1)');
    expect(tokenValue('glass-shadow')).toBe('0 18px 60px rgba(0, 0, 0, 0.38)');
    expect(tokenValue('shadow-elevated')).toBe('0 16px 48px rgba(0, 0, 0, 0.32)');
    expect(tokenValue('color-bg-glass')).toBe('var(--color-surface-standard)');
  });

  it('keeps radius, motion, focus and z-index values in the central token source', () => {
    expect(['10px', '14px', '18px', '22px']).toEqual([
      tokenValue('radius-sm'),
      tokenValue('radius-md'),
      tokenValue('radius-lg'),
      tokenValue('radius-xl')
    ]);
    expect(['140ms', '220ms', '360ms']).toEqual([
      tokenValue('motion-instant'),
      tokenValue('motion-surface'),
      tokenValue('motion-spatial')
    ]);
    expect(tokenValue('focus-outline')).toBe('2px solid var(--color-accent)');
    expect(['0', '2', '3', '10', '30', '50', '70', '90']).toEqual([
      tokenValue('z-base'),
      tokenValue('z-player-state'),
      tokenValue('z-player-lock'),
      tokenValue('z-sticky'),
      tokenValue('z-menu'),
      tokenValue('z-overlay'),
      tokenValue('z-modal'),
      tokenValue('z-critical')
    ]);
  });

  it('keeps normal text tokens at WCAG AA contrast on all three matte depth levels', () => {
    const backgrounds = ['#090a0f', '#10121a', '#171a24'];
    const texts = ['#f5f7fa', '#a8afbf', '#7b8396'];
    for (const background of backgrounds) {
      for (const text of texts) {
        expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('defines every referenced CSS custom property and leaves no self-referencing token', () => {
    const css = cssFiles(stylesDirectory).map((file) => readFileSync(file, 'utf8')).join('\n');
    const definitions = new Set(Array.from(css.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g), (match) => match[1]));
    const references = new Set(Array.from(css.matchAll(/var\(--([a-zA-Z0-9_-]+)/g), (match) => match[1]));
    const missing = Array.from(references).filter((reference) => !definitions.has(reference));
    const selfReferences = Array.from(tokensCss.matchAll(/--([a-zA-Z0-9_-]+):\s*var\(--([a-zA-Z0-9_-]+)\)/g))
      .filter((match) => match[1] === match[2])
      .map((match) => match[1]);
    expect(missing).toEqual([]);
    expect(selfReferences).toEqual([]);
  });

  it('removes the previous foundation palette and aligns the browser theme color', () => {
    const files = cssFiles(stylesDirectory);
    const css = files.map((file) => readFileSync(file, 'utf8')).join('\n').toLowerCase();
    const consumerCss = files.filter((file) => !file.endsWith('tokens.css')).map((file) => readFileSync(file, 'utf8')).join('\n');
    for (const oldValue of ['#0d0f10', '#080909', '#101415', '#151819', '#1c2022', '#24292b', '#e65b4f', '#f06f62', '#f2b37d']) {
      expect(css).not.toContain(oldValue);
    }
    expect(css).not.toContain('#f7c66f');
    expect(css).not.toContain('rgba(4, 7, 18, 0.72)');
    expect(consumerCss).not.toMatch(/z-index:\s*[0-9]+/);
    expect(indexHtml.toLowerCase()).toMatch(/name="theme-color"\s+content="#090a0f"/);
  });
});
