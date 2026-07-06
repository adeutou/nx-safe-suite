import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createEnv } from "../src/create-env";
import { EnvValidationError } from "../src/errors";

describe("createEnv", () => {
  describe("successful validation", () => {
    it("returns a fully typed object when all variables are valid", () => {
      const env = createEnv({
        server: {
          DATABASE_URL: z.string().url(),
        },
        client: {
          NEXT_PUBLIC_API_URL: z.string().url(),
        },
        runtimeEnv: {
          DATABASE_URL: "postgres://localhost:5432/db",
          NEXT_PUBLIC_API_URL: "https://api.example.com",
        },
      });

      expect(env.DATABASE_URL).toBe("postgres://localhost:5432/db");
      expect(env.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
    });

    it("supports shared variables alongside server and client", () => {
      const env = createEnv({
        server: { SECRET: z.string() },
        client: { NEXT_PUBLIC_URL: z.string() },
        shared: { NODE_ENV: z.enum(["development", "production", "test"]) },
        runtimeEnv: {
          SECRET: "abc",
          NEXT_PUBLIC_URL: "https://x.test",
          NODE_ENV: "test",
        },
      });

      expect(env.NODE_ENV).toBe("test");
    });

    it("applies Zod transforms and defaults", () => {
      const env = createEnv({
        server: {
          PORT: z.coerce.number().default(3000),
        },
        runtimeEnv: {},
      });

      expect(env.PORT).toBe(3000);
    });

    it("returns a frozen object", () => {
      const env = createEnv({
        server: { SECRET: z.string() },
        runtimeEnv: { SECRET: "abc" },
      });

      expect(Object.isFrozen(env)).toBe(true);
    });
  });

  describe("validation failures with onValidationError: 'throw'", () => {
    it("throws an EnvValidationError listing every invalid field", () => {
      let caught: unknown;

      try {
        createEnv({
          server: {
            DATABASE_URL: z.string().url(),
            API_SECRET: z.string().min(10),
          },
          runtimeEnv: {
            DATABASE_URL: "not-a-url",
            API_SECRET: "short",
          },
          onValidationError: "throw",
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      const error = caught as EnvValidationError;
      expect(error.fieldErrors.map((f) => f.key).sort()).toEqual([
        "API_SECRET",
        "DATABASE_URL",
      ]);
    });

    it("reports missing required variables", () => {
      let caught: unknown;

      try {
        createEnv({
          server: { DATABASE_URL: z.string().url() },
          runtimeEnv: {},
          onValidationError: "throw",
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      expect((caught as EnvValidationError).fieldErrors[0]?.key).toBe("DATABASE_URL");
    });
  });

  describe("validation failures with onValidationError: 'exit' (default)", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, "exit").mockImplementation(((() => {
        throw new Error("process.exit called");
      }) as unknown) as typeof process.exit);
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("logs a readable report and calls process.exit(1)", () => {
      expect(() =>
        createEnv({
          server: { DATABASE_URL: z.string().url() },
          runtimeEnv: { DATABASE_URL: "nope" },
        }),
      ).toThrow("process.exit called");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]?.[0]).toContain("DATABASE_URL");
    });
  });

  describe("client prefix validation", () => {
    it("throws synchronously if a client key doesn't match the prefix", () => {
      expect(() =>
        createEnv({
          // @ts-expect-error -- intentionally invalid key for the test
          client: { API_URL: z.string() },
          runtimeEnv: { API_URL: "https://x.test" },
        }),
      ).toThrow(/must start with "NEXT_PUBLIC_"/);
    });

    it("allows a custom prefix", () => {
      const env = createEnv({
        client: { PUBLIC_FOO: z.string() },
        runtimeEnv: { PUBLIC_FOO: "bar" },
        clientPrefix: "PUBLIC_",
      });

      expect(env.PUBLIC_FOO).toBe("bar");
    });

    it("skips the prefix check entirely when clientPrefix is an empty string", () => {
      const env = createEnv({
        // @ts-expect-error -- intentionally bypassing the prefix convention
        client: { FOO: z.string() },
        runtimeEnv: { FOO: "bar" },
        clientPrefix: "",
      });

      expect(env.FOO).toBe("bar");
    });
  });

  describe("skipValidation", () => {
    it("returns the raw runtimeEnv without validating or freezing strictly", () => {
      const env = createEnv({
        server: { DATABASE_URL: z.string().url() },
        runtimeEnv: { DATABASE_URL: "not-a-url-but-skipped" },
        skipValidation: true,
      });

      expect(env.DATABASE_URL).toBe("not-a-url-but-skipped");
    });
  });
});
