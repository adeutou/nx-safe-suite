import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSS_PATH = path.resolve(__dirname, "../style.css");

const css = readFileSync(CSS_PATH, "utf-8");

/**
 * Returns the contents of the first `@media` block whose condition matches
 * `mediaRegex`, or null if no such block is found. Uses simple brace
 * counting so nested rules inside the block are captured correctly.
 */
function extractMediaBlock(source, mediaRegex) {
  const match = mediaRegex.exec(source);
  if (!match) return null;

  const startOfBlock = source.indexOf("{", match.index);
  if (startOfBlock === -1) return null;

  let depth = 0;
  for (let i = startOfBlock; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(startOfBlock + 1, i);
      }
    }
  }
  return null;
}

describe("style.css — design tokens", () => {
  it("defines every custom property referenced by index.html and docs.js-driven classes", () => {
    const expectedTokens = [
      "--bg",
      "--bg-sidebar",
      "--bg-surface",
      "--bg-code",
      "--border",
      "--accent",
      "--accent-soft",
      "--text",
      "--text-muted",
      "--text-dim",
      "--white",
      "--pkg-env",
      "--pkg-api",
      "--pkg-guard",
      "--pkg-cache",
      "--pkg-audit",
      "--font-sans",
      "--font-mono",
      "--sidebar-w",
      "--header-h",
      "--radius",
    ];

    const rootBlock = extractMediaBlock(css, /:root\s*/);
    expect(rootBlock, ":root block not found").not.toBeNull();

    for (const token of expectedTokens) {
      const tokenRegex = new RegExp(`${token}\\s*:`);
      expect(tokenRegex.test(rootBlock), `missing token ${token}`).toBe(true);
    }
  });
});

describe("style.css — section visibility (docs.js contract)", () => {
  it("hides sections by default and shows them when .visible is toggled", () => {
    expect(/\.doc-section\s*\{[^}]*display:\s*none/.test(css)).toBe(true);
    expect(/\.doc-section\.visible\s*\{[^}]*display:\s*block/.test(css)).toBe(true);
  });
});

describe("style.css — navigation active states (docs.js contract)", () => {
  it("styles the active sidebar nav-item", () => {
    expect(/\.nav-item\.active\s*\{[^}]*color:\s*var\(--accent\)/.test(css)).toBe(true);
  });

  it("styles the active mobile bottom-nav button", () => {
    expect(/\.mobile-nav-btn\.active\s*\{[^}]*color:\s*var\(--accent\)/.test(css)).toBe(true);
  });

  it("defines the colored dot indicator used inside mobile-nav-btn", () => {
    expect(/\.mobile-nav-btn\s+\.dot\s*\{/.test(css)).toBe(true);
  });
});

describe("style.css — mobile overlay and sidebar (docs.js contract)", () => {
  it("hides the overlay by default and shows it when .visible is toggled", () => {
    expect(/(?:^|\n)\.overlay\s*\{[^}]*display:\s*none/.test(css)).toBe(true);
    expect(/\.overlay\.visible\s*\{[^}]*display:\s*block/.test(css)).toBe(true);
  });

  it("slides the sidebar into view when .open is toggled inside the mobile breakpoint", () => {
    const mobileBlock = extractMediaBlock(css, /@media\s*\(max-width:\s*768px\)/);
    expect(mobileBlock, "max-width: 768px media block not found").not.toBeNull();
    expect(/sidebar\.open\s*\{[^}]*transform:\s*translateX\(0\)/.test(mobileBlock)).toBe(true);
  });

  it("hides desktop-only header text inside the mobile breakpoint", () => {
    const mobileBlock = extractMediaBlock(css, /@media\s*\(max-width:\s*768px\)/);
    expect(/\.header-link \.link-label\s*\{[^}]*display:\s*none/.test(mobileBlock)).toBe(true);
  });
});

describe("style.css — mobile bottom navigation", () => {
  it("hides the bottom nav by default", () => {
    expect(/\.mobile-bottom-nav\s*\{[^}]*display:\s*none/.test(css)).toBe(true);
  });

  it("shows the bottom nav inside the mobile breakpoint", () => {
    const mobileBlock = extractMediaBlock(css, /@media\s*\(max-width:\s*768px\)/);
    expect(/\.mobile-bottom-nav\s*\{[^}]*display:\s*block/.test(mobileBlock)).toBe(true);
  });
});

describe("style.css — table-wrap (index.html contract)", () => {
  it("styles the .table-wrap container introduced for scrollable tables", () => {
    expect(/\.table-wrap\s*\{/.test(css)).toBe(true);
    expect(/\.table-wrap\s*\{[^}]*overflow-x:\s*auto/.test(css)).toBe(true);
  });
});

describe("style.css — accessibility", () => {
  it("disables transitions and animations for prefers-reduced-motion", () => {
    const reducedMotionBlock = extractMediaBlock(
      css,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    );
    expect(reducedMotionBlock, "prefers-reduced-motion block not found").not.toBeNull();
    expect(/transition:\s*none\s*!important/.test(reducedMotionBlock)).toBe(true);
    expect(/animation:\s*none\s*!important/.test(reducedMotionBlock)).toBe(true);
  });
});