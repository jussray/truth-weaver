export type FaqItem = { q: string; a: string; link?: { href: string; label: string } };

/** Plain-language answers; server-rendered so people and search tools see the same text. */
export const HOME_FAQ: FaqItem[] = [
  {
    q: "What is free on Truth Weaver?",
    a: "Legal research by location and the legal notice reader are free to use, with no account needed. Paid guides and reports are still being prepared and are not on sale yet.",
  },
  {
    q: "Does Truth Weaver give legal advice?",
    a: "No. Truth Weaver is not a law firm. It finds official law sources, explains them in plain English and shows what still needs checking. For advice about your situation, talk to a qualified lawyer where it happened.",
  },
  {
    q: "How are legal sources checked?",
    a: "We look only on registered official websites for the place you name, open the page, and try to match the citation. A result is only shown as verified law when an official source, its date and its citation all check out. Otherwise it is clearly marked as unverified.",
    link: { href: "/connectors#how-we-check-sources", label: "How we check sources" },
  },
  {
    q: "Which places are covered?",
    a: "Coverage is limited and not every country, state or city is included. If we cannot confirm the place, the result says the location is unknown instead of guessing.",
    link: { href: "/sources", label: "See the sources we check" },
  },
];

export const NOTICE_FAQ: FaqItem[] = [
  {
    q: "What does the Legal Notice Analyzer do?",
    a: "It reads a notice you paste or upload and lists the dates, demands and questions to ask a lawyer. It does not decide whether the notice is valid or what law applies.",
  },
  {
    q: "What happens to the notice I add?",
    a: "Scanned images are read in your browser first. Blurry scans below 85% clarity are rejected so you can retake them. The notice text is only sent to our server for review after you agree, and the raw text is not saved to your account.",
  },
  {
    q: "Can I rely on the dates it finds?",
    a: "Use them as a starting point only. Always check each date against the original notice, and confirm deadlines with the court, agency or a qualified lawyer.",
  },
  {
    q: "Is it free?",
    a: "Yes, reading a notice is free and does not need an account.",
    link: { href: "/#legal-research", label: "Start free legal research" },
  },
];

export function Faq({ id, title, items }: { id: string; title: string; items: FaqItem[] }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto max-w-4xl px-5 py-12 sm:px-6">
      <h2 id={`${id}-title`} className="font-serif text-3xl text-parchment">{title}</h2>
      <div className="mt-6 divide-y divide-gold/15 rounded-2xl border border-gold/20 bg-forest-deep/25">
        {items.map((item) => (
          <details key={item.q} className="group p-5" open>
            <summary className="cursor-pointer list-none font-semibold text-parchment marker:hidden">
              <h3 className="inline text-base">{item.q}</h3>
            </summary>
            <p className="mt-2 text-sm leading-6 text-parchment/70">
              {item.a}{" "}
              {item.link && <a href={item.link.href} className="text-gold underline-offset-4 hover:underline">{item.link.label}</a>}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
