import { describe, expect, it, vi, beforeEach } from "vitest";
import { maskSensitiveFields, maskEntry } from "../src/masking";
import { createAuditLog } from "../src/audit";
import { ConsoleTransport } from "../src/transports/console";
import { PrismaTransport } from "../src/transports/prisma";
import type { AuditEntry, AuditTransport } from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransport(): AuditTransport & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    async send(entry) {
      entries.push(entry);
    },
  };
}

// ---------------------------------------------------------------------------
// maskSensitiveFields
// ---------------------------------------------------------------------------

describe("maskSensitiveFields()", () => {
  it("masks a top-level sensitive field", () => {
    const result = maskSensitiveFields(
      { email: "albert@example.com", name: "Albert" },
      ["email"],
    ) as Record<string, unknown>;
    expect(result.email).toBe("[REDACTED]");
    expect(result.name).toBe("Albert");
  });

  it("is case-insensitive", () => {
    const result = maskSensitiveFields({ EMAIL: "x@y.com" }, ["email"]) as Record<string, unknown>;
    expect(result.EMAIL).toBe("[REDACTED]");
  });

  it("masks nested fields recursively", () => {
    const result = maskSensitiveFields(
      { user: { email: "x@y.com", age: 30 } },
      ["email"],
    ) as Record<string, Record<string, unknown>>;
    const user = result["user"]!;
    expect(user["email"]).toBe("[REDACTED]");
    expect(user["age"]).toBe(30);
  });

  it("masks fields inside arrays", () => {
    const result = maskSensitiveFields(
      { users: [{ email: "a@b.com" }, { email: "c@d.com" }] },
      ["email"],
    ) as Record<string, Array<Record<string, unknown>>>;
    const users = result["users"]!;
    expect(users[0]?.["email"]).toBe("[REDACTED]");
    expect(users[1]?.["email"]).toBe("[REDACTED]");
  });

  it("leaves primitives untouched", () => {
    expect(maskSensitiveFields("hello", ["email"])).toBe("hello");
    expect(maskSensitiveFields(42, ["email"])).toBe(42);
    expect(maskSensitiveFields(null, ["email"])).toBeNull();
  });

  it("returns value unchanged when sensitiveFields is empty", () => {
    const obj = { email: "x@y.com" };
    expect(maskSensitiveFields(obj, [])).toBe(obj);
  });

  it("does not mutate the original object", () => {
    const original = { password: "secret", name: "Albert" };
    maskSensitiveFields(original, ["password"]);
    expect(original.password).toBe("secret");
  });
});

describe("maskEntry()", () => {
  it("masks actor and payload fields", () => {
    const entry: AuditEntry = {
      action: "user.login",
      actor: { id: "u1", name: "Albert", email: "a@b.com" } as never,
      payload: { password: "s3cr3t", reason: "test" },
    };
    const masked = maskEntry(entry, ["password", "email"]);
    expect((masked.actor as Record<string, unknown>).email).toBe("[REDACTED]");
    expect((masked.payload as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((masked.payload as Record<string, unknown>).reason).toBe("test");
  });

  it("leaves action and resource untouched", () => {
    const entry: AuditEntry = {
      action: "user.create",
      resource: { type: "user", id: "123" },
    };
    const masked = maskEntry(entry, ["id"]);
    // resource.id should NOT be masked — only actor and payload are processed
    expect(masked.resource?.id).toBe("123");
  });
});

// ---------------------------------------------------------------------------
// createAuditLog
// ---------------------------------------------------------------------------

describe("createAuditLog()", () => {
  it("throws when no transports are provided", () => {
    expect(() => createAuditLog({ transports: [] })).toThrow();
  });

  it("sends to all transports in parallel", async () => {
    const t1 = makeTransport();
    const t2 = makeTransport();
    const audit = createAuditLog({ transports: [t1, t2] });

    await audit.log({ action: "user.create" });

    expect(t1.entries).toHaveLength(1);
    expect(t2.entries).toHaveLength(1);
  });

  it("auto-populates timestamp and status", async () => {
    const t = makeTransport();
    const audit = createAuditLog({ transports: [t] });

    await audit.log({ action: "user.login" });

    const entry = t.entries[0]!;
    expect(typeof entry.timestamp).toBe("string");
    expect(entry.status).toBe("success");
  });

  it("respects defaultStatus override", async () => {
    const t = makeTransport();
    const audit = createAuditLog({ transports: [t], defaultStatus: "attempt" });

    await audit.log({ action: "login.attempt" });
    expect(t.entries[0]?.status).toBe("attempt");
  });

  it("status in entry overrides defaultStatus", async () => {
    const t = makeTransport();
    const audit = createAuditLog({ transports: [t] });

    await audit.log({ action: "user.login", status: "failure" });
    expect(t.entries[0]?.status).toBe("failure");
  });

  it("attaches serviceName to every entry", async () => {
    const t = makeTransport();
    const audit = createAuditLog({ serviceName: "my-app", transports: [t] });

    await audit.log({ action: "order.create" });
    expect(t.entries[0]?.service).toBe("my-app");
  });

  it("masks sensitive fields before sending", async () => {
    const t = makeTransport();
    const audit = createAuditLog({
      transports: [t],
      sensitiveFields: ["password", "ssn"],
    });

    await audit.log({
      action: "user.update",
      payload: { password: "hunter2", ssn: "123-45-6789", name: "Albert" },
    });

    const payload = t.entries[0]?.payload as Record<string, unknown>;
    expect(payload.password).toBe("[REDACTED]");
    expect(payload.ssn).toBe("[REDACTED]");
    expect(payload.name).toBe("Albert");
  });

  it("throws when a transport fails (silent: false)", async () => {
    const failing: AuditTransport = {
      async send() {
        throw new Error("transport down");
      },
    };
    const audit = createAuditLog({ transports: [failing], silent: false });

    await expect(audit.log({ action: "x" })).rejects.toThrow("transport down");
  });

  it("swallows transport errors when silent: true", async () => {
    const failing: AuditTransport = {
      async send() {
        throw new Error("transport down");
      },
    };
    const audit = createAuditLog({ transports: [failing], silent: true });

    await expect(audit.log({ action: "x" })).resolves.toBeUndefined();
  });

  it("still sends to healthy transports when one fails (silent: true)", async () => {
    const good = makeTransport();
    const bad: AuditTransport = { async send() { throw new Error("down"); } };
    const audit = createAuditLog({ transports: [bad, good], silent: true });

    await audit.log({ action: "test" });
    expect(good.entries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// ConsoleTransport
// ---------------------------------------------------------------------------

describe("ConsoleTransport", () => {
  it("writes to console.log by default", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const t = new ConsoleTransport();
    await t.send({ action: "test.event", timestamp: "2026-07-07T00:00:00Z" });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain("test.event");
    spy.mockRestore();
  });

  it("writes to console.error when stream is stderr", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const t = new ConsoleTransport({ stream: "stderr" });
    await t.send({ action: "test.error" });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("pretty-prints when pretty: true", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const t = new ConsoleTransport({ pretty: true });
    await t.send({ action: "test.pretty" });
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).toContain("\n"); // pretty JSON has newlines
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// PrismaTransport
// ---------------------------------------------------------------------------

describe("PrismaTransport", () => {
  it("calls model.create with the mapped entry", async () => {
    const create = vi.fn().mockResolvedValue({});
    const t = new PrismaTransport({ model: { create } });
    await t.send({ action: "invoice.create", timestamp: "2026-07-07T00:00:00Z" });
    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.action).toBe("invoice.create");
    expect(data.timestamp).toBeInstanceOf(Date);
  });

  it("uses custom mapEntry when provided", async () => {
    const create = vi.fn().mockResolvedValue({});
    const t = new PrismaTransport({
      model: { create },
      mapEntry: (entry) => ({ act: entry.action, ts: new Date() }),
    });
    await t.send({ action: "user.login" });
    const data = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.act).toBe("user.login");
    expect(data.action).toBeUndefined();
  });
});
