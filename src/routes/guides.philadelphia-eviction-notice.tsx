import { pageHead, faqPageJsonLd } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileCheck,
  FileText,
  Landmark,
  Scale,
  ShieldAlert,
} from "lucide-react";

import { CounselPage, tw } from "@/components/counsel/page";

const GUIDE_FAQ = [
  {
    q: "How much notice is required for an eviction in Pennsylvania?",
    a: "Under 68 P.S. § 250.501, Pennsylvania requires 10 days written notice to quit for nonpayment of rent. For lease expiration or breaches other than nonpayment, 15 days notice is required for leases of one year or less, and 30 days for leases exceeding one year.",
  },
  {
    q: "Does Philadelphia require participation in the Eviction Diversion Program?",
    a: "Yes. Under Philadelphia Code § 9-804, residential landlords must participate in the City of Philadelphia Eviction Diversion Program (EDP) before filing an eviction complaint in the Philadelphia Municipal Court.",
  },
  {
    q: "Can a Philadelphia landlord evict without a Certificate of Rental Suitability?",
    a: "Under Philadelphia Code § 9-3903, a landlord must maintain a valid rental license and have issued a Certificate of Rental Suitability and the Partners for Good Housing handbook. Failure to do so bars the landlord from recovering rent or proceeding with eviction for the unlicensed period.",
  },
];

export const Route = createFileRoute("/guides/philadelphia-eviction-notice")({
  head: () =>
    pageHead({
      path: "/guides/philadelphia-eviction-notice",
      title: "Philadelphia Eviction Notice Guide: 68 P.S. § 250.501 & Phila. Code § 9-804 | Truth Weaver Counsel",
      description: "Plain-English guide to Philadelphia eviction notice requirements under PA 68 P.S. § 250.501 and Philadelphia Code § 9-804, including the Eviction Diversion Program and rental license rules.",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Shop & Guides", path: "/shop" },
        { name: "Philadelphia Eviction Notice Guide", path: "/guides/philadelphia-eviction-notice" },
      ],
      jsonLd: [faqPageJsonLd(GUIDE_FAQ)],
    }),
  component: PhiladelphiaEvictionGuidePage,
});

function PhiladelphiaEvictionGuidePage() {
  const [activeTab, setActiveTab] = useState<"statutes" | "philadelphia" | "checkpoints">("statutes");

  return (
    <CounselPage
      title="Philadelphia Eviction Notice Requirements"
      eyebrow="Statutory reference & municipal rules · 68 P.S. § 250.501 & Phila. Code § 9-804"
      actions={
        <Link to="/notice-analyzer" className={tw.btn}>
          Analyze a notice scan
        </Link>
      }
    >
      {/* Authority Banner */}
      <div className="mb-8 rounded-2xl border border-gold/30 bg-forest-deep/60 p-6">
        <div className="flex items-start gap-4">
          <Scale className="mt-1 h-6 w-6 shrink-0 text-gold" aria-hidden />
          <div className="space-y-2">
            <h2 className="font-serif text-xl font-semibold text-parchment">
              Governing Law Framework: Commonwealth & Municipal Law
            </h2>
            <p className="text-sm leading-6 text-parchment/80">
              In Philadelphia, eviction notices must satisfy both Commonwealth baseline statute (Pennsylvania Landlord and Tenant Act of 1951, 68 P.S. § 250.501) and strict municipal ordinances (Philadelphia Code Chapter 9-800 &amp; Chapter 9-3900). A notice that fails either standard is legally defective.
            </p>
            <p className="text-xs font-semibold uppercase tracking-wider text-warn">
              NON-AUTHORIZING REFERENCE · GOVERNING LAW AND RELEVANT COURT ARE THE AUTHORITY
            </p>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-parchment/15 pb-4">
        <button
          type="button"
          onClick={() => setActiveTab("statutes")}
          className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-colors ${
            activeTab === "statutes" ? "bg-gold text-ink" : "border border-gold/20 text-parchment/75 hover:text-gold"
          }`}
        >
          1. Pennsylvania Statute (68 P.S. § 250.501)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("philadelphia")}
          className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-colors ${
            activeTab === "philadelphia" ? "bg-gold text-ink" : "border border-gold/20 text-parchment/75 hover:text-gold"
          }`}
        >
          2. Philadelphia Municipal Code (§ 9-804 & EDP)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("checkpoints")}
          className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition-colors ${
            activeTab === "checkpoints" ? "bg-gold text-ink" : "border border-gold/20 text-parchment/75 hover:text-gold"
          }`}
        >
          3. Notice Validity Checklist
        </button>
      </div>

      {activeTab === "statutes" && (
        <div className="space-y-6">
          <section className={tw.card}>
            <div className="flex items-center gap-3">
              <Landmark className="h-5 w-5 text-gold" aria-hidden />
              <h2 className="font-serif text-2xl text-parchment">
                Pennsylvania Landlord and Tenant Act of 1951 — Section 501
              </h2>
            </div>
            <p className="mt-2 text-xs text-parchment/60">Citation: 68 P.S. § 250.501 (Notice to quit)</p>
            <div className="mt-4 space-y-4 text-sm leading-6 text-parchment/80">
              <p>
                Under Pennsylvania law, a landlord cannot simply file an eviction lawsuit or change locks without first serving a proper written “Notice to Quit”. Section 250.501 sets the mandatory minimum notice periods based on the cause:
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gold/20 bg-ink/40 p-4">
                  <div className="flex items-center gap-2 text-gold">
                    <Calendar className="h-4 w-4" />
                    <span className="font-serif text-base font-semibold">10-Day Notice</span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-parchment">Nonpayment of Rent</p>
                  <p className="mt-1 text-xs text-parchment/70">
                    Required when the sole ground is unpaid rent. The tenant has the right to cure by paying lawful rent arrears before the notice expires.
                  </p>
                </div>
                <div className="rounded-xl border border-gold/20 bg-ink/40 p-4">
                  <div className="flex items-center gap-2 text-gold">
                    <Calendar className="h-4 w-4" />
                    <span className="font-serif text-base font-semibold">15-Day Notice</span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-parchment">Lease ≤ 1 Year / Breach</p>
                  <p className="mt-1 text-xs text-parchment/70">
                    Applies for expiration of a lease term of one year or less, or for alleged lease violations other than nonpayment.
                  </p>
                </div>
                <div className="rounded-xl border border-gold/20 bg-ink/40 p-4">
                  <div className="flex items-center gap-2 text-gold">
                    <Calendar className="h-4 w-4" />
                    <span className="font-serif text-base font-semibold">30-Day Notice</span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-parchment">Lease &gt; 1 Year</p>
                  <p className="mt-1 text-xs text-parchment/70">
                    Required when the original lease term exceeds one year, or for alleged non-rent breaches between September 1 and April 1.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className={tw.card}>
            <h3 className="font-serif text-xl text-parchment">Service Requirements Under 68 P.S. § 250.501</h3>
            <p className="mt-2 text-sm leading-6 text-parchment/75">
              Notice cannot be served by email, text message, or verbal statement alone. The statute permits service only by:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-parchment/80">
              <li>Personal delivery directly to the tenant in hand.</li>
              <li>Leaving the notice at the leased premises with an adult in charge or resident.</li>
              <li>Posting the notice conspicuously on the leased premises (e.g. affixed to the front entry door).</li>
            </ul>
          </section>
        </div>
      )}

      {activeTab === "philadelphia" && (
        <div className="space-y-6">
          <section className={tw.card}>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-gold" aria-hidden />
              <h2 className="font-serif text-2xl text-parchment">Philadelphia Code § 9-804 &amp; Eviction Diversion</h2>
            </div>
            <p className="mt-2 text-xs text-parchment/60">Citation: Philadelphia Code Title 9, Chapter 9-800 &amp; Chapter 9-3900</p>
            <div className="mt-4 space-y-4 text-sm leading-6 text-parchment/80">
              <p>
                Philadelphia enforces critical tenant protections that supersede ordinary statewide procedures. A landlord who bypasses these requirements cannot legally proceed in Philadelphia Municipal Court:
              </p>
              <div className="space-y-3">
                <div className="rounded-xl border border-gold/20 bg-ink/40 p-4">
                  <h3 className="font-serif text-base font-semibold text-gold">
                    1. Mandatory Eviction Diversion Program (EDP) Participation
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-parchment/75">
                    Under Phila. Code § 9-804, landlords must apply for the City’s Eviction Diversion Program and participate in mediation for at least 30 days before filing an eviction complaint in Municipal Court. Filing without an EDP certificate is unlawful.
                  </p>
                </div>
                <div className="rounded-xl border border-gold/20 bg-ink/40 p-4">
                  <h3 className="font-serif text-base font-semibold text-gold">
                    2. Certificate of Rental Suitability &amp; Housing License (Phila. Code § 9-3903)
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-parchment/75">
                    A Philadelphia landlord cannot collect rent or evict if they lack an active Rental License from the Department of Licenses and Inspections (L&amp;I). Landlords must also have provided the tenant with a valid Certificate of Rental Suitability and the City handbook at lease signing.
                  </p>
                </div>
                <div className="rounded-xl border border-gold/20 bg-ink/40 p-4">
                  <h3 className="font-serif text-base font-semibold text-gold">
                    3. Lead Certification for Pre-1978 Residential Properties (Phila. Code § 6-800)
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-parchment/75">
                    For properties constructed prior to 1978, landlords must provide proof of lead-free or lead-safe certification to L&amp;I and the tenant. Failure to maintain lead certification bars rental collection and Municipal Court eviction filings.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "checkpoints" && (
        <div className="space-y-6">
          <section className={tw.card}>
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-gold" aria-hidden />
              <h2 className="font-serif text-2xl text-parchment">Notice Validity Checkpoints</h2>
            </div>
            <p className="mt-2 text-sm text-parchment/70">
              When reviewing a Philadelphia eviction notice or notice to quit, verify these evidentiary checkpoints:
            </p>
            <div className="mt-4 space-y-3">
              {[
                { title: "Sufficient Days Counted", desc: "Did the notice give the full 10, 15, or 30 days required by 68 P.S. § 250.501, excluding date of service?" },
                { title: "Statutory Service Method", desc: "Was the notice handed to an adult or posted conspicuously, rather than sent solely by electronic messaging?" },
                { title: "Eviction Diversion Notice Attached", desc: "Does the notice include required City of Philadelphia Eviction Diversion Program contact info and rights notice under Phila. Code § 9-804?" },
                { title: "Active Rental License on File", desc: "Does the landlord have an active L&I rental license and provided a Certificate of Rental Suitability under Phila. Code § 9-3903?" },
                { title: "Warranty of Habitability", desc: "Are there outstanding L&I code violations or uninhabitable conditions governed by Pugh v. Holmes, 486 Pa. 272 (1979)?" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-xl border border-parchment/10 bg-ink/30 p-3.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                  <div>
                    <h3 className="text-sm font-semibold text-parchment">{item.title}</h3>
                    <p className="mt-0.5 text-xs leading-5 text-parchment/70">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={tw.card}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
              <div>
                <h3 className="font-serif text-lg font-semibold text-parchment">Need Help Analyzing a Specific Notice?</h3>
                <p className="mt-1 text-sm leading-6 text-parchment/75">
                  Upload or scan your written notice in our free in-browser Notice Analyzer to identify stated deadlines, claimed obligations, and potential statutory discrepancies.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link to="/notice-analyzer" className={tw.btn}>Open Notice Analyzer</Link>
                  <Link to="/legal-library" className={tw.ghost}>Browse Legal Library</Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Frequently Asked Questions */}
      <section className={`${tw.card} mt-8`}>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gold" aria-hidden />
          <h2 className="font-serif text-2xl text-parchment">Frequently Asked Questions</h2>
        </div>
        <div className="mt-4 divide-y divide-parchment/10">
          {GUIDE_FAQ.map((faq, idx) => (
            <div key={idx} className="py-4">
              <h3 className="font-serif text-base font-semibold text-gold-soft">{faq.q}</h3>
              <p className="mt-1.5 text-sm leading-6 text-parchment/75">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimers & Sources */}
      <footer className="mt-8 rounded-xl border border-parchment/10 p-5 text-xs leading-5 text-parchment/55">
        <p className="font-semibold text-parchment/75">Statutory Sources &amp; Legal Citations:</p>
        <p className="mt-1">
          Pennsylvania Landlord and Tenant Act of 1951, Act of Apr. 6, 1951, P.L. 69, No. 20, Art. V, § 501, codified at 68 P.S. § 250.501.
          Philadelphia Code, Title 9 (Regulation of Businesses, Trades and Professions), Chapter 9-800 (Landlord and Tenant) &amp; Chapter 9-3900 (Property Licenses and Owner Accountability).
          Supreme Court of Pennsylvania, <em>Pugh v. Holmes</em>, 486 Pa. 272, 405 A.2d 897 (1979).
        </p>
        <p className="mt-2 text-warn">
          Educational reference only. Truth Weaver Counsel is not a law firm and does not provide legal representation. If you are facing an eviction hearing in Philadelphia Municipal Court, contact Community Legal Services of Philadelphia (CLS) or the Eviction Diversion Program helpline.
        </p>
      </footer>
    </CounselPage>
  );
}
