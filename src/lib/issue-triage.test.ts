import { describe, it, expect } from "vitest";
import { parseTriageText } from "./issue-triage.functions";
describe("triage parse", () => {
  it("validates, dedupes, caps", () => {
    const r = parseTriageText('x {"areas":[{"area":"Immigration","reason":"visa"},{"area":"Immigration","reason":"dup"},{"area":"Fake","reason":"no"},{"area":"Criminal Law","reason":""}]}');
    expect(r).toEqual([{ area: "Immigration", reason: "visa" }]);
  });
  it("throws on malformed", () => { expect(() => parseTriageText("{bad")).toThrow(); expect(() => parseTriageText("none")).toThrow(); });
});
