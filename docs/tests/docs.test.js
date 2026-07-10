import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.resolve(__dirname, "../index.html");
const DOCS_JS_PATH = path.resolve(__dirname, "../docs.js");

const rawHtml = readFileSync(HTML_PATH, "utf-8");
const docsJsSource = readFileSync(DOCS_JS_PATH, "utf-8");

/* Mirrors the SECTIONS map inside docs.js. Kept here so the tests act as a
 * contract check between docs.js and index.html: if an id is renamed in one
 * place but not the other, these tests fail. */
const SECTIONS = {
  intro: "sec-intro",
  install: "sec-install",
  env: "sec-env",
  "env-api": "sec-env-api",
  "env-recipes": "sec-env-recipes",
  "api-response": "sec-api-response",
  "api-success": "sec-api-success",
  "api-errors": "sec-api-errors",
  "api-pagination": "sec-api-pagination",
  "route-guard": "sec-route-guard",
  "guard-api-routes": "sec-guard-api-routes",
  "guard-actions": "sec-guard-actions",
  "guard-rbac": "sec-guard-rbac",
  "guard-rate": "sec-guard-rate",
  "server-cache": "sec-server-cache",
  "cache-layers": "sec-cache-layers",
  "cache-tags": "sec-cache-tags",
  "cache-swr": "sec-cache-swr",
  "audit-log": "sec-audit-log",
  "audit-transports": "sec-audit-transports",
  "audit-masking": "sec-audit-masking",
  changelog: "sec-changelog",
};

const SUBS = {
  env: "sub-env",
  "env-api": "sub-env",
  "env-recipes": "sub-env",
  "api-response": "sub-api",
  "api-success": "sub-api",
  "api-errors": "sub-api",
  "api-pagination": "sub-api",
  "route-guard": "sub-guard",
  "guard-api-routes": "sub-guard",
  "guard-actions": "sub-guard",
  "guard-rbac": "sub-guard",
  "guard-rate": "sub-guard",
  "server-cache": "sub-cache",
  "cache-layers": "sub-cache",
  "cache-tags": "sub-cache",
  "cache-swr": "sub-cache",
  "audit-log": "sub-audit",
  "audit-transports": "sub-audit",
  "audit-masking": "sub-audit",
};

const ALL_SUBS = ["sub-env", "sub-api", "sub-guard", "sub-cache", "sub-audit"];

/**
 * Boots a fresh jsdom window with the real index.html markup and the real
 * docs.js source (inlined so it runs synchronously without any network
 * fetch). Returns once the `load` event has fired, which guarantees the
 * `DOMContentLoaded` handler registered by docs.js has already executed.
 */
async function bootDom({ urlPath = "/" } = {}) {
  const htmlWithInlineScript = rawHtml.replace(
    '<script src="docs.js"></script>',
    `<script>${docsJsSource}</script>`,
  );

  const dom = new JSDOM(htmlWithInlineScript, {
    runScripts: "dangerously",
    url: `http://localhost${urlPath}`,
  });

  await new Promise((resolve) => {
    dom.window.addEventListener("load", resolve);
  });

  return dom;
}

function setInnerWidth(win, width) {
  Object.defineProperty(win, "innerWidth", {
    value: width,
    configurable: true,
    writable: true,
  });
}

function fireTouch(document, type, points) {
  const event = new document.defaultView.Event(type);
  if (type === "touchstart") {
    event.touches = points;
  } else {
    event.changedTouches = points;
  }
  document.dispatchEvent(event);
}

describe("docs.js — structural contract with index.html", () => {
  let dom;
  let document;

  beforeEach(async () => {
    dom = await bootDom();
    document = dom.window.document;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("has a DOM element for every section referenced in SECTIONS", () => {
    for (const id of Object.values(SECTIONS)) {
      expect(document.getElementById(id), `missing #${id}`).not.toBeNull();
    }
  });

  it("has a DOM element for every sub-nav panel referenced in SUBS", () => {
    for (const id of Object.values(SUBS)) {
      expect(document.getElementById(id), `missing #${id}`).not.toBeNull();
    }
  });

  it("every mobile-nav-btn data-key maps to a valid section", () => {
    const buttons = document.querySelectorAll(".mobile-nav-btn");
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((btn) => {
      const key = btn.getAttribute("data-key");
      expect(Object.prototype.hasOwnProperty.call(SECTIONS, key)).toBe(true);
    });
  });

  it("every nav-item onclick handler targets a valid section key", () => {
    const items = document.querySelectorAll(".nav-item[onclick]");
    expect(items.length).toBeGreaterThan(0);
    items.forEach((item) => {
      const match = item.getAttribute("onclick").match(/navigate\('([^']+)'\)/);
      expect(match, `unexpected onclick on ${item.outerHTML}`).not.toBeNull();
      const key = match[1];
      expect(Object.prototype.hasOwnProperty.call(SECTIONS, key)).toBe(true);
    });
  });
});

describe("docs.js — initial navigation on load", () => {
  let dom;
  let document;

  afterEach(() => {
    dom?.window.close();
  });

  it("shows the intro section when there is no hash", async () => {
    dom = await bootDom({ urlPath: "/" });
    document = dom.window.document;

    expect(document.getElementById("sec-intro").classList.contains("visible")).toBe(true);
    expect(document.getElementById("sec-install").classList.contains("visible")).toBe(false);
  });

  it("navigates to the section named by the URL hash", async () => {
    dom = await bootDom({ urlPath: "/#env" });
    document = dom.window.document;

    expect(document.getElementById("sec-env").classList.contains("visible")).toBe(true);
    expect(document.getElementById("sec-intro").classList.contains("visible")).toBe(false);
    expect(document.getElementById("sub-env").style.display).toBe("block");
  });

  it("falls back to intro for an unknown hash", async () => {
    dom = await bootDom({ urlPath: "/#this-does-not-exist" });
    document = dom.window.document;

    expect(document.getElementById("sec-intro").classList.contains("visible")).toBe(true);
  });

  it("marks the matching sidebar nav-item as active on load", async () => {
    dom = await bootDom({ urlPath: "/#route-guard" });
    document = dom.window.document;

    const activeItem = document.querySelector(".nav-item.active");
    expect(activeItem.getAttribute("onclick")).toBe("navigate('route-guard')");
  });

  it("marks the matching mobile bottom-nav button as active on load", async () => {
    dom = await bootDom({ urlPath: "/#audit-log" });
    document = dom.window.document;

    const activeBtn = document.querySelector(".mobile-nav-btn.active");
    expect(activeBtn.getAttribute("data-key")).toBe("audit-log");
  });
});

describe("docs.js — navigate()", () => {
  let dom;
  let window;
  let document;

  beforeEach(async () => {
    dom = await bootDom();
    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("hides the previous section and shows the requested one", () => {
    window.navigate("env");

    expect(document.getElementById("sec-intro").classList.contains("visible")).toBe(false);
    expect(document.getElementById("sec-env").classList.contains("visible")).toBe(true);
  });

  it("updates the active class on sidebar nav items", () => {
    window.navigate("server-cache");

    const active = document.querySelectorAll(".nav-item.active");
    expect(active.length).toBe(1);
    expect(active[0].getAttribute("onclick")).toBe("navigate('server-cache')");
  });

  it("updates the active class on mobile bottom-nav buttons", () => {
    window.navigate("server-cache");

    const active = document.querySelectorAll(".mobile-nav-btn.active");
    expect(active.length).toBe(1);
    expect(active[0].getAttribute("data-key")).toBe("server-cache");
  });

  it("shows the correct sub-nav panel and hides all others", () => {
    window.navigate("guard-rbac");

    expect(document.getElementById("sub-guard").style.display).toBe("block");
    for (const id of ALL_SUBS) {
      if (id !== "sub-guard") {
        expect(document.getElementById(id).style.display).toBe("none");
      }
    }
  });

  it("hides every sub-nav panel for a section with no sub-nav", () => {
    window.navigate("changelog");

    for (const id of ALL_SUBS) {
      expect(document.getElementById(id).style.display).toBe("none");
    }
  });

  it("updates the URL hash via history.replaceState", () => {
    window.navigate("cache-tags");

    expect(window.location.hash).toBe("#cache-tags");
  });

  it("is a no-op for an unknown key", () => {
    window.navigate("env");
    window.navigate("does-not-exist");

    expect(document.getElementById("sec-env").classList.contains("visible")).toBe(true);
    expect(window.location.hash).toBe("#env");
  });

  it("closes the mobile sidebar after navigating on a narrow viewport", () => {
    setInnerWidth(window, 480);
    window.toggleSidebar();
    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);

    window.navigate("install");

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(false);
    expect(document.getElementById("overlay").classList.contains("visible")).toBe(false);
  });

  it("does not close the sidebar after navigating on a wide viewport", () => {
    setInnerWidth(window, 1280);
    window.toggleSidebar();
    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);

    window.navigate("install");

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);
  });

  it("supports clicking a real sidebar nav-item end to end", () => {
    const envLink = document.querySelector(".nav-item[onclick=\"navigate('env')\"]");
    expect(envLink).not.toBeNull();

    envLink.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("sec-env").classList.contains("visible")).toBe(true);
  });

  it("supports clicking a real mobile bottom-nav button end to end", () => {
    const btn = document.querySelector('.mobile-nav-btn[data-key="audit-log"]');
    expect(btn).not.toBeNull();

    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("sec-audit-log").classList.contains("visible")).toBe(true);
  });
});

describe("docs.js — sidebar controls", () => {
  let dom;
  let window;
  let document;

  beforeEach(async () => {
    dom = await bootDom();
    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("toggleSidebar opens a closed sidebar", () => {
    window.toggleSidebar();

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);
    expect(document.getElementById("overlay").classList.contains("visible")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("toggleSidebar closes an open sidebar", () => {
    window.toggleSidebar();
    window.toggleSidebar();

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(false);
    expect(document.getElementById("overlay").classList.contains("visible")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("clicking the overlay closes the sidebar", () => {
    window.toggleSidebar();

    document
      .getElementById("overlay")
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(false);
  });

  it("pressing Escape closes the sidebar", () => {
    window.toggleSidebar();

    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(false);
  });

  it("pressing a non-Escape key does not close the sidebar", () => {
    window.toggleSidebar();

    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter" }));

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);
  });
});

describe("docs.js — popstate handling", () => {
  let dom;
  let window;
  let document;

  beforeEach(async () => {
    dom = await bootDom();
    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("navigates to the section matching the hash on popstate", () => {
    window.location.hash = "#audit-masking";
    window.dispatchEvent(new window.Event("popstate"));

    expect(document.getElementById("sec-audit-masking").classList.contains("visible")).toBe(true);
  });

  it("falls back to intro when the hash is cleared on popstate", () => {
    window.navigate("env");
    window.location.hash = "";
    window.dispatchEvent(new window.Event("popstate"));

    expect(document.getElementById("sec-intro").classList.contains("visible")).toBe(true);
  });

  it("ignores popstate for a hash that does not map to a section", () => {
    window.navigate("env");
    window.location.hash = "#unknown-section";
    window.dispatchEvent(new window.Event("popstate"));

    /* navigate() is never called for an unknown key, so env stays visible */
    expect(document.getElementById("sec-env").classList.contains("visible")).toBe(true);
  });
});

describe("docs.js — touch swipe gestures", () => {
  let dom;
  let window;
  let document;

  beforeEach(async () => {
    dom = await bootDom();
    window = dom.window;
    document = window.document;
    setInnerWidth(window, 480);
  });

  afterEach(() => {
    dom.window.close();
  });

  it("closes an open sidebar on a left swipe", () => {
    window.toggleSidebar();
    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);

    fireTouch(document, "touchstart", [{ clientX: 300, clientY: 100 }]);
    fireTouch(document, "touchend", [{ clientX: 200, clientY: 110 }]);

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(false);
  });

  it("opens the sidebar on a right swipe starting near the left edge", () => {
    expect(document.getElementById("sidebar").classList.contains("open")).toBe(false);

    fireTouch(document, "touchstart", [{ clientX: 10, clientY: 100 }]);
    fireTouch(document, "touchend", [{ clientX: 95, clientY: 105 }]);

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);
  });

  it("ignores a right swipe that does not start near the left edge", () => {
    fireTouch(document, "touchstart", [{ clientX: 200, clientY: 100 }]);
    fireTouch(document, "touchend", [{ clientX: 285, clientY: 105 }]);

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(false);
  });

  it("ignores a swipe with too much vertical drift", () => {
    window.toggleSidebar();

    fireTouch(document, "touchstart", [{ clientX: 300, clientY: 100 }]);
    fireTouch(document, "touchend", [{ clientX: 200, clientY: 220 }]);

    /* dy = 120 > 40, so the horizontal swipe is not recognised */
    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);
  });

  it("ignores a swipe shorter than the horizontal threshold", () => {
    window.toggleSidebar();

    fireTouch(document, "touchstart", [{ clientX: 300, clientY: 100 }]);
    fireTouch(document, "touchend", [{ clientX: 260, clientY: 105 }]);

    /* dx = -40, threshold is 60 */
    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);
  });
});

describe("docs.js — resize handling", () => {
  let dom;
  let window;
  let document;

  beforeEach(async () => {
    dom = await bootDom();
    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("force-closes the sidebar and restores scrolling when resized to desktop width", () => {
    setInnerWidth(window, 480);
    window.toggleSidebar();
    expect(document.getElementById("sidebar").classList.contains("open")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");

    setInnerWidth(window, 1024);
    window.dispatchEvent(new window.Event("resize"));

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("does nothing when resized while already at desktop width", () => {
    setInnerWidth(window, 1024);

    window.dispatchEvent(new window.Event("resize"));

    expect(document.getElementById("sidebar").classList.contains("open")).toBe(false);
  });
});