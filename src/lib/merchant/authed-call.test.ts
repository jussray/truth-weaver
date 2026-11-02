import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));

import { authed } from "./authed-call";

describe("authenticated merchant server calls", () => {
  beforeEach(() => getSession.mockReset());

  it("rejects missing sessions before invoking a protected operation", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const operation = vi.fn(async () => ({ ok: true }));

    await expect(authed(operation)).rejects.toThrow("Please sign in again.");
    expect(operation).not.toHaveBeenCalled();
  });

  it("passes a valid bearer token and precisely the requested input", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "test-session-token" } },
    });
    const data = { orderId: "gid://shopify/Order/1", reason: "Authorized customer service" };
    const operation = vi.fn(async (_opts: {
      data?: typeof data;
      headers?: { Authorization: string };
    }) => ({ ok: true as const }));

    await expect(authed(operation, data)).resolves.toEqual({ ok: true });
    expect(operation).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith({
      data,
      headers: { Authorization: "Bearer test-session-token" },
    });
  });

  it("does not call the protected operation when session lookup fails", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    getSession.mockRejectedValueOnce(new Error("Session provider unavailable"));
    const operation = vi.fn(async () => ({ ok: true }));

    let failure: unknown;
    try {
      await authed(operation);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("Session provider unavailable");
    expect(operation).not.toHaveBeenCalled();
  });
});
