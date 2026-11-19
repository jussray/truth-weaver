import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Download, ExternalLink, FileText, GraduationCap, Package } from "lucide-react";
import { z } from "zod";

import { SiteChrome } from "@/components/storefront/site-chrome";
import { pageHead } from "@/lib/seo";
import { REPORT_OFFERS } from "@/lib/commerce/report-catalog";
import {
  LEARNING_KEYS,
  LEARNING_RESEARCH_WORKFLOW,
  LEARNING_SOURCES,
  NOTICE_GUIDE,
  NOTICE_LESSONS,
  NOTICE_TEMPLATES,
  PUBLIC_MATERIAL_STATUS,
  type LearningKey,
} from "@/lib/education/notice-learning";

const searchSchema = z.object({
  resource: z.enum(["guide", "templates", "course", "bundle"]).optional(),
});

export const Route = createFileRoute("/learn")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => pageHead({
    path: "/learn",
    title: "Notice learning samples | Truth Weaver Counsel",
    description: "Educational notice guides, worksheets and five lessons with official source references. Not a purchased report or legal advice.",
    noindex: true,
  }),
  component: NoticeLearningPage,
});

const ICONS: Record<LearningKey, typeof BookOpen> = {
  guide: BookOpen,
  templates: FileText,
  course: GraduationCap,
  bundle: Package,
};

function SourceLinks({ ids }: { ids: readonly string[] }) {
  const sources = ids.map((id) => LEARNING_SOURCES.find((item) => item.id === id)).filter((item) => item !== undefined);
  if (!sources.length) return null;
  return (
    <div className="mt-4 border-t border-gold/10 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gold-soft">Official source pointers</p>
      <ul className="mt-2 space-y-1 text-sm">
        {sources.map((source) => (
          <li key={source.id}>
            <a href={source.url} rel="noopener noreferrer" target="_blank" className="text-gold-soft underline underline-offset-2 hover:text-gold">
              {source.title} <ExternalLink className="inline h-3 w-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GuideContent() {
  return (
    <section data-testid="learning-guide" aria-label="Notice response guide" className="space-y-5">
      <h2 className="font-serif text-2xl text-parchment">Notice Response Guide: educational steps</h2>
      {NOTICE_GUIDE.map((section) => (
        <article key={section.id} className="rounded-2xl border border-gold/20 bg-forest-deep/35 p-5 sm:p-7">
          <h3 className="font-serif text-xl text-parchment">{section.title}</h3>
          {section.text.map((paragraph) => <p key={paragraph} className="mt-3 leading-7 text-parchment/75">{paragraph}</p>)}
          <h4 className="mt-5 text-xs font-bold uppercase tracking-widest text-gold">Try this</h4>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-6 text-parchment/80">
            {section.actions.map((action) => <li key={action}>{action}</li>)}
          </ul>
          <SourceLinks ids={section.sourceIds} />
        </article>
      ))}
    </section>
  );
}

function TemplateContent() {
  return (
    <section data-testid="learning-templates" aria-label="Notice worksheets" className="space-y-5">
      <h2 className="font-serif text-2xl text-parchment">Printable, fill-in worksheets</h2>
      <p className="text-sm leading-6 text-parchment/65">These are neutral organizers, not official forms. Download the PDF or Markdown for a copy you can fill in privately.</p>
      {NOTICE_TEMPLATES.map((template) => (
        <article key={template.id} className="rounded-2xl border border-gold/20 bg-forest-deep/35 p-5 sm:p-7">
          <h3 className="font-serif text-xl text-parchment">{template.title}</h3>
          <p className="mt-2 text-sm leading-6 text-parchment/70">{template.instructions}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {template.fields.map((field) => (
              <div key={field} className="min-h-20 rounded-lg border border-gold/15 bg-ink/25 px-3 py-2">
                <span className="text-xs font-semibold text-gold-soft">{field}</span>
                <div aria-hidden className="mt-5 border-b border-parchment/20" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-parchment/60">{template.caution}</p>
          <SourceLinks ids={template.sourceIds} />
        </article>
      ))}
    </section>
  );
}

function CourseContent() {
  return (
    <section data-testid="learning-course" aria-label="Five-lesson notice basics course" className="space-y-5">
      <h2 className="font-serif text-2xl text-parchment">Notice Basics: five short lessons</h2>
      <p className="text-sm leading-6 text-parchment/65">Follow the lessons in order, then open each self-check answer. No account, tracking, or grades are required.</p>
      {NOTICE_LESSONS.map((lesson) => (
        <article key={lesson.number} data-testid="learning-lesson" className="rounded-2xl border border-gold/20 bg-forest-deep/35 p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-gold">Lesson {lesson.number} of 5</p>
          <h3 className="mt-2 font-serif text-xl text-parchment">{lesson.title}</h3>
          <p className="mt-2 text-sm font-semibold text-gold-soft">Goal: {lesson.objective}</p>
          {lesson.reading.map((paragraph) => <p key={paragraph} className="mt-3 leading-7 text-parchment/75">{paragraph}</p>)}
          <p className="mt-4 text-sm leading-6 text-parchment/80"><strong className="text-parchment">Practice:</strong> {lesson.exercise}</p>
          <details className="mt-5 rounded-lg border border-gold/25 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-parchment">Self-check: {lesson.question}</summary>
            <p className="mt-3 text-sm leading-6 text-parchment/75">{lesson.answer}</p>
          </details>
          <SourceLinks ids={lesson.sourceIds} />
        </article>
      ))}
    </section>
  );
}

function NoticeLearningPage() {
  const { resource } = Route.useSearch();
  const selected: LearningKey = resource ?? "guide";
  const offer = REPORT_OFFERS[selected];
  const [working, setWorking] = useState<"pdf" | "markdown" | "workflow" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportFile(format: "pdf" | "markdown" | "workflow") {
    if (working) return;
    setWorking(format);
    setExportError(null);
    try {
      const exporter = await import("@/lib/education/notice-download");
      if (format === "workflow") exporter.exportEducationWorkflow();
      else await exporter.exportEducationResource(selected, format);
    } catch {
      setExportError("This export could not be created on this device. Your existing content was not changed.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <SiteChrome>
      <main className="mx-auto max-w-6xl px-5 py-12 text-parchment sm:px-6">
        <a href="/shop" className="text-sm text-gold-soft underline underline-offset-4">Back to Counsel Store</a>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.3em] text-gold">Truth Weaver education</p>
        <h1 className="mt-3 font-serif text-4xl sm:text-5xl">Read, practice, verify</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-parchment/75">
          Review source-backed educational samples while full personalized products remain on launch hold.
          You do not need to upload your notice, enter private facts, or purchase anything to use this page.
        </p>
        <p data-testid="learning-safety" className="mt-4 max-w-3xl border-l-2 border-gold px-4 text-sm leading-6 text-parchment/70">
          {PUBLIC_MATERIAL_STATUS}. These materials are not official court forms. Actual deadlines, remedies,
          and legal requirements depend on the governing law and facts of your situation.
        </p>
        <nav aria-label="Learning materials" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LEARNING_KEYS.map((key) => {
            const Icon = ICONS[key];
            return (
              <a
                key={key}
                href={`/learn?resource=${key}`}
                aria-current={selected === key ? "page" : undefined}
                className={`rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${selected === key ? "border-gold bg-gold/10" : "border-parchment/20 bg-forest-deep/30 hover:border-gold/50"}`}
              >
                <Icon className="h-6 w-6 text-gold" aria-hidden />
                <strong className="mt-2 block font-serif text-lg">{REPORT_OFFERS[key].label}</strong>
                <span className="mt-1 block text-xs text-parchment/55">Read free sample</span>
              </a>
            );
          })}
        </nav>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-gold/20 bg-forest-deep/50 p-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold">Selected resource</p>
            <h2 className="mt-1 font-serif text-2xl">{offer.label}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-parchment/65">{offer.summary}</p>
            <p className="mt-1 text-xs text-parchment/55">Planned paid product price: ${offer.priceUsd}. This sample is free and not a purchase entitlement.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!working} onClick={() => void exportFile("pdf")} className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-bold text-ink disabled:opacity-60"><Download className="h-4 w-4" aria-hidden />{working === "pdf" ? "Preparing PDF…" : "Download sample PDF"}</button>
            <button type="button" disabled={!!working} onClick={() => void exportFile("markdown")} className="rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold-soft disabled:opacity-60">{working === "markdown" ? "Preparing…" : "Export Markdown"}</button>
          </div>
        </div>
        {exportError && <p role="alert" className="mt-3 text-sm text-warn">{exportError}</p>}

        <div className="mt-9">
          {(selected === "guide" || selected === "bundle") && <GuideContent />}
          {(selected === "templates" || selected === "bundle") && <div className="mt-9"><TemplateContent /></div>}
          {(selected === "course" || selected === "bundle") && <div className="mt-9"><CourseContent /></div>}
          {selected === "bundle" && <p className="mt-7 rounded-xl border border-gold/20 p-4 text-sm text-parchment/70">The planned paid bundle also includes a private, buyer-specific Notice Snapshot. That part is intentionally excluded from the free sample. Viewing or exporting this page does not verify payment.</p>}
        </div>

        <section aria-labelledby="source-index" className="mt-12 border-t border-gold/20 pt-7">
          <h2 id="source-index" className="font-serif text-2xl">Official sources to verify</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-parchment/65">Links were reviewed for editorial research on November 19, 2026. Their currentness, completeness, and applicability to any particular notice have not been established.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {LEARNING_SOURCES.map((source) => (
              <li key={source.id} className="rounded-xl border border-gold/20 bg-forest-deep/30 p-4">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-soft underline underline-offset-2">{source.title} <ExternalLink className="inline h-3 w-3" aria-hidden /></a>
                <p className="mt-2 text-xs leading-5 text-parchment/65">{source.scope}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-parchment/50">Source link reviewed · Law not verified</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="workflow-export" className="mt-9 rounded-xl border border-gold/25 bg-forest-deep/40 p-5 sm:p-7">
          <h2 id="workflow-export" className="font-serif text-2xl">Research and editorial workflow</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-parchment/70">Export the versioned review contract for GitHub, GitBook, Exa research, and a future Cloudflare Workflows adapter. This is a portable workflow definition, not a connected or running autopilot.</p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {LEARNING_RESEARCH_WORKFLOW.steps.map((step, index) => (
              <li key={step.id} className="rounded-lg border border-gold/10 p-3">
                <span className="text-xs font-bold uppercase text-gold">Gate {index + 1}: {step.id}</span>
                <p className="mt-1 text-sm leading-5 text-parchment/70">{step.action}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button type="button" disabled={!!working} onClick={() => void exportFile("workflow")} className="rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold-soft disabled:opacity-60">Export review workflow JSON</button>
            <span className="text-xs leading-5 text-parchment/60">Auto-publish, payments, and legal filings disabled. Human review required.</span>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
