import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  INTEGRATION_STATUS_LABEL,
  classifyAuthority,
  type AuthorityClass,
  type IntegrationStatus,
  type TruthState,
} from "@/domain/law";
import type { LegalSource } from "@/lib/counsel";

const truthTone: Record<TruthState, string> = {
  "VERIFIED LAW": "border-law/60 bg-law/15 text-law",
  SUPPORTED: "border-supported/60 bg-supported/15 text-supported",
  "ALLEGED FACT": "border-warn/50 bg-warn/10 text-warn",
  INFERRED: "border-border bg-muted text-muted-foreground",
  CONTRADICTED: "border-danger/60 bg-danger/15 text-danger",
  STALE: "border-warn/60 bg-warn/15 text-warn",
  "JURISDICTION UNKNOWN": "border-danger/50 bg-danger/10 text-danger",
  "UNVERIFIED LAW": "border-warn/60 bg-warn/10 text-warn",
  "NOT APPLICABLE": "border-border bg-muted text-muted-foreground",
};

export function TruthBadge({ state }: { state: string }) {
  const tone = truthTone[state as TruthState] ?? truthTone.INFERRED;
  return (
    <span className={cn("label-mono inline-flex items-center rounded border px-2 py-0.5", tone)}>
      {state}
    </span>
  );
}

const authorityTone: Record<AuthorityClass, string> = {
  "PRIMARY LAW": "border-law/60 bg-law/15 text-law",
  SECONDARY: "border-supported/50 bg-supported/10 text-supported",
  DISCOVERY: "border-border bg-muted text-muted-foreground",
};

export function AuthorityChip({ source }: { source: LegalSource }) {
  const klass = classifyAuthority(source);
  return (
    <span className={cn("label-mono inline-flex items-center rounded border px-2 py-0.5", authorityTone[klass])}>
      {klass}
    </span>
  );
}

export function IntegrationBadge({ status }: { status: string }) {
  const tone =
    status === "implemented_adapter"
      ? "border-ok/60 bg-ok/15 text-ok"
      : status === "linked_source_family"
        ? "border-supported/50 bg-supported/10 text-supported"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span className={cn("label-mono inline-flex items-center rounded border px-2 py-0.5", tone)}>
      {INTEGRATION_STATUS_LABEL[status as IntegrationStatus] ?? status}
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel p-4 sm:p-5", className)}>
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="label-mono block">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
