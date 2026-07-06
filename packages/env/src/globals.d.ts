// Minimal ambient declaration so we can detect a browser context
// (`typeof globalThis.window === "undefined"`) without pulling in the
// full `dom` lib, which would bring hundreds of unrelated browser globals
// into a package that's meant to run primarily in Node/Edge runtimes.
export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var window: any | undefined;
}
