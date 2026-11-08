import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Merchant access must come only from a redeemed invite, never from a migration
// that hard-codes a role grant for a named account.
const MIGRATION_DIRS = ["drizzle/migrations", "supabase/migrations"];
const HARDCODED_GRANT = /insert\s+into\s+public\.user_roles[\s\S]{0,400}?where\s+[\w.]*email\s*=/i;

function migrationFiles(): { path: string; sql: string }[] {
  return MIGRATION_DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => ({ path: join(dir, name), sql: readFileSync(join(dir, name), "utf8") })),
  );
}

describe("merchant role migrations", () => {
  it("never grant a role to an account selected by email", () => {
    const offenders = migrationFiles().filter(({ sql }) => HARDCODED_GRANT.test(sql)).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("detects the grant pattern that was removed", () => {
    expect(HARDCODED_GRANT.test(
      "INSERT INTO public.user_roles (user_id, role)\n  SELECT id, 'merchant'::public.app_role FROM auth.users WHERE email = 'x@y.z'",
    )).toBe(true);
  });
});
