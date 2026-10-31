import { pageHead } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AuthorityChip, IntegrationBadge } from "@/components/counsel/ui-bits";
import { CounselPage, StateBox, tw } from "@/components/counsel/page";
import { listSources } from "@/lib/counsel";

export const Route = createFileRoute("/sources")({
  head: () =>
    pageHead({ path: '/sources', title: 'Official Legal Sources We Check | Truth Weaver Counsel', description: 'The official law websites, courts and government sources Truth Weaver checks, which places are covered today, and where coverage is still limited.', breadcrumbs: [{ name: "Home", path: "/" }, { name: 'Sources', path: '/sources' }] }),)}
      </ul>
    </CounselPage>
  );
}
