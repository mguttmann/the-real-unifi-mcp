import { describe, expect, it, vi } from "vitest";
import { runGuarded } from "../../src/tools/destructiveGuard.js";

const cfgOff = { confirmWrites: false } as { confirmWrites: boolean };
const cfgOn = { confirmWrites: true } as { confirmWrites: boolean };

describe("runGuarded", () => {
  it("executes directly when confirmWrites=false", async () => {
    const fn = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const res = await runGuarded(cfgOff, {}, { method: "POST", url: "/x" }, fn);
    expect(fn).toHaveBeenCalled();
    expect((res.content[0] as { text: string }).text).toBe("ok");
  });

  it("returns preview when confirmWrites=true and no confirm arg", async () => {
    const fn = vi.fn();
    const res = await runGuarded(cfgOn, {}, { method: "POST", url: "/x", body: { foo: 1 } }, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(res.isError).toBeUndefined();
    const text = (res.content[0] as { text: string }).text;
    expect(text).toContain("preview");
    expect(text).toContain("POST");
  });

  it("executes when confirmWrites=true and confirm=YES", async () => {
    const fn = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    await runGuarded(cfgOn, { confirm: "YES" }, { method: "POST", url: "/x" }, fn);
    expect(fn).toHaveBeenCalled();
  });

  it("redacts sensitive fields in preview body", async () => {
    const res = await runGuarded(
      cfgOn,
      {},
      { method: "POST", url: "/x", body: { name: "n", password: "p" } },
      vi.fn(),
    );
    const text = (res.content[0] as { text: string }).text;
    expect(text).not.toContain('"p"');
    expect(text).toContain("(redacted)");
  });
});
