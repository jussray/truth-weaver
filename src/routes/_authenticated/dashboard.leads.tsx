import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle,
  FilePlus,
  Filter,
  Inbox,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react";

import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";
import { createIssue } from "@/lib/counsel";

export interface InquiryLead {
  id: string;
  client_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  category: "housing_urgent" | "debt_defense" | "legal_demand" | "contracts" | "general_legal_inquiry";
  jurisdiction: string;
  deadline_date: string | null;
  summary: string;
  urgency: "normal" | "urgent" | "critical";
  status: "new" | "triaged" | "converted" | "dismissed";
  epistemic_status: "ALLEGED_FACT";
  converted_issue_id?: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<InquiryLead["category"], string> = {
  housing_urgent: "Housing & Eviction Defense",
  debt_defense: "Debt Collection Defense",
  legal_demand: "Legal Demand / Notice to Vacate",
  contracts: "Contract / Lease Agreement",
  general_legal_inquiry: "General Legal Inquiry",
};

const LOCAL_STORAGE_KEY = "truth_weaver_tw_inquiries";

const DEFAULT_INQUIRIES: InquiryLead[] = [
  {
    id: "inq-philadelphia-101",
    client_name: "Philadelphia Tenant Intake",
    contact_email: "tenant.intake@example.org",
    contact_phone: "215-555-0192",
    category: "housing_urgent",
    jurisdiction: "Philadelphia, PA",
    deadline_date: "2026-12-05",
    summary: "Received 10-day notice to quit for alleged rent arrears. Landlord has no current Certificate of Rental Suitability on file with Philadelphia L&I.",
    urgency: "critical",
    status: "new",
    epistemic_status: "ALLEGED_FACT",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "inq-consumer-102",
    client_name: "Consumer Debt Defense Client",
    contact_email: "client102@example.org",
    contact_phone: null,
    category: "debt_defense",
    jurisdiction: "Pennsylvania",
    deadline_date: "2026-12-15",
    summary: "Served with court summons and complaint by third-party debt buyer for credit account beyond Pennsylvania statute of limitations (42 Pa.C.S. § 5525).",
    urgency: "urgent",
    status: "new",
    epistemic_status: "ALLEGED_FACT",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export const Route = createFileRoute("/_authenticated/dashboard/leads")({
  head: () => ({
    meta: [
      { title: "Inquiry Leads & Legal Intake — Truth Weaver Counsel" },
      { name: "description", content: "In-app inquiry intake and lead inbox for legal research." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DashboardLeadsPage,
});

function DashboardLeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<InquiryLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Form state
  const [clientName, setClientName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [category, setCategory] = useState<InquiryLead["category"]>("housing_urgent");
  const [jurisdiction, setJurisdiction] = useState("Philadelphia, PA");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [summary, setSummary] = useState("");
  const [urgency, setUrgency] = useState<InquiryLead["urgency"]>("urgent");
  const [submitting, setSubmitting] = useState(false);

  // Load inquiries on mount
  useEffect(() => {
    async function loadInquiries() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("tw_inquiries" as any)
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setLeads(data as unknown as InquiryLead[]);
        } else {
          // Fall back to localStorage or defaults
          const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (saved) {
            try {
              setLeads(JSON.parse(saved));
            } catch {
              setLeads(DEFAULT_INQUIRIES);
            }
          } else {
            setLeads(DEFAULT_INQUIRIES);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_INQUIRIES));
          }
        }
      } catch {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        setLeads(saved ? JSON.parse(saved) : DEFAULT_INQUIRIES);
      } finally {
        setLoading(false);
      }
    }
    loadInquiries();
  }, []);

  function saveLeads(updated: InquiryLead[]) {
    setLeads(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  }

  async function handleCreateInquiry(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const newLead: InquiryLead = {
      id: `tw_inq_${Date.now()}`,
      client_name: clientName.trim(),
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      category,
      jurisdiction: jurisdiction.trim() || "Philadelphia, PA",
      deadline_date: deadlineDate || null,
      summary: summary.trim(),
      urgency,
      status: "new",
      epistemic_status: "ALLEGED_FACT",
      created_at: new Date().toISOString(),
    };

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await supabase.from("tw_inquiries" as any).insert({
          ...newLead,
          user_id: auth.user.id,
        });
      }
    } catch (err) {
      console.warn("Supabase tw_inquiries insert fallback to local:", err);
    }

    const updated = [newLead, ...leads];
    saveLeads(updated);

    // Reset form
    setClientName("");
    setContactEmail("");
    setContactPhone("");
    setDeadlineDate("");
    setSummary("");
    setShowIntakeForm(false);
    setSubmitting(false);
    setFeedback({ kind: "success", text: `Inquiry intake recorded for ${newLead.client_name} (ALLEGED_FACT).` });
  }

  async function convertToMatter(lead: InquiryLead) {
    setFeedback(null);
    try {
      const issue = await createIssue({
        title: `${CATEGORY_LABELS[lead.category]}: ${lead.client_name}`,
        issue_area: lead.category === "housing_urgent" ? "Housing & Real Estate" : "Credit & Debt",
        jurisdiction_note: lead.jurisdiction,
        as_of_date: lead.deadline_date ?? new Date().toISOString().slice(0, 10),
      });

      const updated = leads.map((item) =>
        item.id === lead.id ? { ...item, status: "converted" as const, converted_issue_id: issue.id } : item
      );
      saveLeads(updated);
      setFeedback({
        kind: "success",
        text: `Inquiry converted to Research Matter "${issue.title}". Opening matter...`,
      });
      setTimeout(() => {
        navigate({ to: "/issues/$issueId", params: { issueId: issue.id } });
      }, 1000);
    } catch (err) {
      setFeedback({ kind: "error", text: `Could not create matter: ${(err as Error).message}` });
    }
  }

  function updateStatus(id: string, status: InquiryLead["status"]) {
    const updated = leads.map((l) => (l.id === id ? { ...l, status } : l));
    saveLeads(updated);
    setFeedback({ kind: "success", text: `Lead status updated to ${status}.` });
  }

  function deleteLead(id: string) {
    const updated = leads.filter((l) => l.id !== id);
    saveLeads(updated);
    setFeedback({ kind: "success", text: "Inquiry lead removed." });
  }

  const filtered = leads.filter((l) => {
    if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = l.client_name.toLowerCase().includes(q);
      const matchSummary = l.summary.toLowerCase().includes(q);
      const matchJurisdiction = l.jurisdiction.toLowerCase().includes(q);
      if (!matchName && !matchSummary && !matchJurisdiction) return false;
    }
    return true;
  });

  return (
    <CounselPage
      title="Inquiry leads & legal intake"
      eyebrow="Research workspace · tw_inquiries intake"
      actions={
        <button
          type="button"
          onClick={() => setShowIntakeForm(!showIntakeForm)}
          className={tw.btn}
        >
          {showIntakeForm ? "Close intake form" : "+ New inquiry intake"}
        </button>
      }
    >
      <WorkspaceNav />

      {feedback && (
        <div className="mb-6">
          {feedback.kind === "error" ? (
            <StateBox kind="error">{feedback.text}</StateBox>
          ) : (
            <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-200">
              {feedback.text}
            </div>
          )}
        </div>
      )}

      {/* Epistemic boundary notice */}
      <div className="mb-6 rounded-2xl border border-gold/25 bg-forest-deep/60 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
          <div className="space-y-1">
            <h2 className="font-serif text-lg font-semibold text-parchment">
              Inquiry Intake Epistemic Status: ALLEGED_FACT
            </h2>
            <p className="text-xs leading-5 text-parchment/75">
              All intake records and client narratives are classified as <span className="font-semibold text-gold">ALLEGED_FACT</span>. They represent raw reported claims, not verified law. Formal legal propositions must be checked against registered primary sources before citing as verified law.
            </p>
          </div>
        </div>
      </div>

      {/* Intake Form */}
      {showIntakeForm && (
        <section className={`${tw.card} mb-8 border-gold/40`}>
          <div className="flex items-center gap-2 border-b border-parchment/10 pb-4">
            <FilePlus className="h-5 w-5 text-gold" />
            <h2 className="font-serif text-2xl text-parchment">Record Legal Inquiry Intake</h2>
          </div>
          <form onSubmit={handleCreateInquiry} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className={tw.label}>Client / Subject Name or Identifier</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Doe or Unit 4B Tenant"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className={tw.input}
                />
              </label>
              <label className="block space-y-1">
                <span className={tw.label}>Jurisdiction</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Philadelphia, PA or Pennsylvania"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className={tw.input}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-1">
                <span className={tw.label}>Contact Email (optional)</span>
                <input
                  type="email"
                  placeholder="client@example.org"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={tw.input}
                />
              </label>
              <label className="block space-y-1">
                <span className={tw.label}>Contact Phone (optional)</span>
                <input
                  type="tel"
                  placeholder="e.g. 215-555-0100"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className={tw.input}
                />
              </label>
              <label className="block space-y-1">
                <span className={tw.label}>Notice / Hearing Deadline</span>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className={tw.input}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className={tw.label}>Legal Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as InquiryLead["category"])}
                  className={tw.input}
                >
                  <option value="housing_urgent">Housing & Eviction Defense</option>
                  <option value="debt_defense">Debt Collection Defense</option>
                  <option value="legal_demand">Legal Demand / Notice to Vacate</option>
                  <option value="contracts">Contract / Lease Agreement</option>
                  <option value="general_legal_inquiry">General Legal Inquiry</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className={tw.label}>Urgency Level</span>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as InquiryLead["urgency"])}
                  className={tw.input}
                >
                  <option value="normal">Normal Priority</option>
                  <option value="urgent">Urgent (&lt; 14 days)</option>
                  <option value="critical">Critical Deadline (&lt; 5 days)</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className={tw.label}>Inquiry Summary &amp; Alleged Facts (Non-Authorizing)</span>
              <textarea
                required
                rows={4}
                placeholder="State the facts reported by the client or notice text (e.g. date received, claimed amounts, rental license status)..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className={`${tw.input} resize-y`}
              />
            </label>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowIntakeForm(false)}
                className={tw.ghost}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={tw.btn}
              >
                {submitting ? "Saving intake..." : "Record Inquiry (ALLEGED_FACT)"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filter and Search Bar */}
      <section className={`${tw.card} mb-6 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-parchment/15 bg-ink/40 px-3 py-2">
            <Search className="h-4 w-4 text-parchment/50" />
            <input
              type="text"
              placeholder="Search by client name, jurisdiction, or facts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-parchment placeholder:text-parchment/40 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-parchment/70">
              <Filter className="h-3.5 w-3.5 text-gold" />
              <span>Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-parchment/20 bg-ink px-2 py-1 text-xs text-parchment"
              >
                <option value="all">All Categories</option>
                <option value="housing_urgent">Housing</option>
                <option value="debt_defense">Debt Defense</option>
                <option value="legal_demand">Legal Demand</option>
                <option value="general_legal_inquiry">General</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-parchment/70">
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-parchment/20 bg-ink px-2 py-1 text-xs text-parchment"
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="triaged">Triaged</option>
                <option value="converted">Converted to Matter</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Inquiry Leads List */}
      {loading ? (
        <StateBox kind="loading">Loading inquiry leads...</StateBox>
      ) : filtered.length === 0 ? (
        <StateBox kind="empty">
          No inquiries found matching your filters. Click “+ New inquiry intake” to record a lead.
        </StateBox>
      ) : (
        <ul className="space-y-4">
          {filtered.map((lead) => {
            const isCritical = lead.urgency === "critical";
            const isUrgent = lead.urgency === "urgent";

            return (
              <li
                key={lead.id}
                className={`${tw.card} transition-colors hover:border-gold/40`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-parchment/10 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-xl font-semibold text-parchment">
                        {lead.client_name}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                          isCritical
                            ? "bg-warn/20 text-warn"
                            : isUrgent
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-parchment/10 text-parchment/70"
                        }`}
                      >
                        {lead.urgency}
                      </span>
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                        {lead.epistemic_status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-parchment/65">
                      {CATEGORY_LABELS[lead.category]} · {lead.jurisdiction}
                      {lead.deadline_date && ` · Deadline: ${lead.deadline_date}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        lead.status === "converted"
                          ? "text-emerald-400"
                          : lead.status === "triaged"
                          ? "text-gold"
                          : lead.status === "dismissed"
                          ? "text-parchment/40"
                          : "text-parchment/80"
                      }`}
                    >
                      Status: {lead.status}
                    </span>
                  </div>
                </div>

                {/* Summary / Reported facts */}
                <p className="mt-3 text-sm leading-6 text-parchment/85">{lead.summary}</p>

                {/* Contact metadata */}
                {(lead.contact_email || lead.contact_phone) && (
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-parchment/60">
                    {lead.contact_email && <span>Email: {lead.contact_email}</span>}
                    {lead.contact_phone && <span>Phone: {lead.contact_phone}</span>}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-parchment/10 pt-3">
                  <div className="flex flex-wrap gap-2">
                    {lead.status !== "converted" ? (
                      <button
                        type="button"
                        onClick={() => convertToMatter(lead)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gold/90"
                      >
                        <Briefcase className="h-3.5 w-3.5" />
                        Convert to Legal Matter
                      </button>
                    ) : lead.converted_issue_id ? (
                      <Link
                        to="/issues/$issueId"
                        params={{ issueId: lead.converted_issue_id }}
                        className="inline-flex items-center gap-1.5 text-xs text-gold underline"
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        Open Converted Matter
                      </Link>
                    ) : (
                      <span className="text-xs text-emerald-400">Converted</span>
                    )}

                    <Link
                      to="/notice-analyzer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-parchment/20 px-3 py-1.5 text-xs text-parchment/80 hover:border-gold hover:text-gold"
                    >
                      <Inbox className="h-3.5 w-3.5" />
                      Analyze Notice Scan
                    </Link>
                  </div>

                  <div className="flex items-center gap-2">
                    {lead.status === "new" && (
                      <button
                        type="button"
                        onClick={() => updateStatus(lead.id, "triaged")}
                        className="text-xs text-parchment/70 hover:text-gold"
                      >
                        Mark Triaged
                      </button>
                    )}
                    {lead.status !== "dismissed" && lead.status !== "converted" && (
                      <button
                        type="button"
                        onClick={() => updateStatus(lead.id, "dismissed")}
                        className="text-xs text-parchment/50 hover:text-warn"
                      >
                        Dismiss
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteLead(lead.id)}
                      className="p-1 text-parchment/40 hover:text-warn"
                      title="Delete inquiry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CounselPage>
  );
}
