import { describe, expect, it } from "vitest";
import { REPORT_OFFERS } from "../commerce/report-catalog";
import {
  LEARNING_KEYS,
  LEARNING_RESEARCH_WORKFLOW,
  LEARNING_SOURCES,
  NOTICE_GUIDE,
  NOTICE_LESSONS,
  NOTICE_TEMPLATES,
  learningResourceMarkdown,
  learningWorkflowJson,
} from "./notice-learning";

describe("TruthWeaver public learning and governed exports", () => {
  it("has one source-backed public sample for each prepared digital category", () => {
    expect(LEARNING_KEYS).toEqual(["guide", "templates", "course", "bundle"]);
    expect(new Set(LEARNING_KEYS.map((key) => REPORT_OFFERS[key].sku)).size).toBe(4);
    for (const key of LEARNING_KEYS) {
      expect(REPORT_OFFERS[key].variantGid).toMatch(/^gid:\/\/shopify\/ProductVariant\/\d+$/);
      expect(learningResourceMarkdown(key)).toContain("NOT A PAID DELIVERABLE");
      expect(learningResourceMarkdown(key)).toContain("Not legal advice");
      expect(learningResourceMarkdown(key)).toContain("Official source index");
    }
  });

  it("includes the six guide steps, four fill-in templates, and five lesson self-checks", () => {
    expect(NOTICE_GUIDE).toHaveLength(6);
    expect(NOTICE_TEMPLATES).toHaveLength(4);
    expect(NOTICE_LESSONS.map((lesson) => lesson.number)).toEqual([1, 2, 3, 4, 5]);
    expect(NOTICE_LESSONS.every((lesson) => lesson.question && lesson.answer && lesson.exercise)).toBe(true);
    expect(learningResourceMarkdown("guide")).toContain("Separate stated dates from verified deadlines");
    expect(learningResourceMarkdown("templates")).toContain("Stated-date and deadline tracker");
    expect(learningResourceMarkdown("course")).toContain("Lesson 5:");
    expect(learningResourceMarkdown("bundle")).toContain("The free educational samples below do not prove any purchase");
  });

  it("keeps every cited source traceable to a known official website", () => {
    const known = new Set(LEARNING_SOURCES.map((source) => source.id));
    expect(known.size).toBe(LEARNING_SOURCES.length);
    const allowed = new Set(["www.uscourts.gov", "www.usa.gov", "www.consumerfinance.gov"]);
    for (const source of LEARNING_SOURCES) {
      expect(allowed.has(new URL(source.url).hostname)).toBe(true);
      expect(source.status).toBe("SOURCE_LINK_REVIEWED_NOT_LAW_VERIFIED");
      expect(source.scope).toBeTruthy();
    }
    for (const item of [...NOTICE_GUIDE, ...NOTICE_TEMPLATES, ...NOTICE_LESSONS]) {
      for (const id of item.sourceIds) expect(known.has(id)).toBe(true);
    }
  });

  it("exports portable JSON but never confuses it with connected or publishing automation", () => {
    const workflow = JSON.parse(learningWorkflowJson());
    expect(workflow.schema).toBe("truthweaver/education-source-review@v1");
    expect(workflow.adaptersConnected).toBe(false);
    expect(workflow.gates.autoPublish).toBe(false);
    expect(workflow.gates.autoSell).toBe(false);
    expect(workflow.gates.autoFileLegalDocuments).toBe(false);
    expect(workflow.gates.requireHumanPublicationApproval).toBe(true);
    expect(workflow.sources).toHaveLength(LEARNING_SOURCES.length);
    expect(workflow.catalogSkus).toHaveLength(4);
    expect(LEARNING_RESEARCH_WORKFLOW.steps.map((step) => step.id)).toContain("redteam");
  });

  it("does not export a paid snapshot or customer-specific notice as a public resource", () => {
    expect(LEARNING_KEYS).not.toContain("snapshot");
    expect(learningResourceMarkdown("bundle")).toContain("Notice Snapshot is a separately verified");
    expect(learningResourceMarkdown("guide")).not.toContain("Paid order ID");
  });
});
