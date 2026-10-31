import { pageHead } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AuthorityChip, IntegrationBadge } from "@/components/counsel/ui-bits";
import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { listSources } from "@/lib/counsel";

export const Route = createFileRoute("/sources")({
  head: () =>
    pageHead({ path: '/sources', title: 'Official Legal Sources We Check | Truth Weaver Counsel', description: 'The official law websites, courts and government sources Truth Weaver checks, which places are covered today, and where coverage is still limited.', breadcrumbs: [{ name: "Home", path: "/" }, { name: 'Sources', path: '/sources' }] }), => (
          <li key={s.id} className={tw.card}>
            <div className="flex flex-wrap gap-2">
              <AuthorityChip source={s} />
              <IntegrationBadge status={s.integration_status} />
            </div>
            <h2 className="mt-2 font-serif text-lg">{s.name}</h2>
            {s.issuing_body && <p className="mt-1 text-sm text-parchment/70">Issuing body: {s.issuing_body}</p>}
            {s.coverage_description && <p className="mt-2 text-sm text-parchment/70">{s.coverage_description}</p>}
            <dl className="mt-3 grid gap-1 border-t border-parchment/10 pt-3 text-xs text-parchment/60">
              <div>
                <dt className="inline font-semibold text-parchment/75">Official-source record: </dt>
                <dd className="inline">{sourceRecord(s.is_official, "marked official", "not marked official")}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-parchment/75">Authenticity record: </dt>
                <dd className="inline">{sourceRecord(s.is_authentic, "marked authentic", "not marked authentic")}</dd>
              </div>
              {s.authority_weight && (
                <div>
                  <dt className="inline font-semibold text-parchment/75">Authority context: </dt>
                  <dd className="inline">{s.authority_weight}</dd>
                </div>
              )}
            </dl>
            {s.currentness_strategy && (
              <p className="mt-3 text-xs leading-5 text-parchment/60">
                <span className="font-semibold text-parchment/75">Currentness guidance: </span>
                {s.currentness_strategy}
              </p>
            )}
            {s.base_url && (
              <a href={s.base_url} target="_blank" rel="noreferrer" className="mt-3 inline-block break-all text-xs text-gold">
                Open source site ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </CounselPage>
  );
}
