import { describe, expect, it } from "vitest";
import { VERSION } from "../src/index";

describe("package smoke test", () => {
  it("exports a version", () => {
    expect(VERSION).toBeDefined();
  });
});
