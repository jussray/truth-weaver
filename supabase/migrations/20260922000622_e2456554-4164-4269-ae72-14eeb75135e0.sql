CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.jurisdictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES public.jurisdictions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  country_code TEXT,
  layer TEXT NOT NULL,
  legal_system TEXT,
  official_languages TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jurisdictions TO anon, authenticated;
GRANT ALL ON public.jurisdictions TO service_role;
ALTER TABLE public.jurisdictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jurisdictions readable by everyone" ON public.jurisdictions FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER jurisdictions_updated_at BEFORE UPDATE ON public.jurisdictions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.legal_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jurisdiction_id UUID REFERENCES public.jurisdictions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  issuing_body TEXT,
  base_url TEXT,
  is_official BOOLEAN NOT NULL DEFAULT false,
  is_authentic BOOLEAN,
  source_role TEXT NOT NULL DEFAULT 'discovery',
  authority_weight TEXT,
  coverage_description TEXT,
  currentness_strategy TEXT,
  integration_status TEXT NOT NULL DEFAULT 'not_yet_integrated',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.legal_sources TO anon, authenticated;
GRANT ALL ON public.legal_sources TO service_role;
ALTER TABLE public.legal_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_sources readable by everyone" ON public.legal_sources FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER legal_sources_updated_at BEFORE UPDATE ON public.legal_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.legal_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jurisdiction_id UUID REFERENCES public.jurisdictions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  author TEXT,
  edition TEXT,
  year INTEGER,
  publisher TEXT,
  topic TEXT,
  book_type TEXT NOT NULL DEFAULT 'treatise',
  isbn TEXT,
  catalog_url TEXT,
  licensing_note TEXT,
  secondary_role_note TEXT NOT NULL DEFAULT 'Secondary source. Explains and helps discover law; cannot itself establish VERIFIED LAW.',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.legal_books TO anon, authenticated;
GRANT ALL ON public.legal_books TO service_role;
ALTER TABLE public.legal_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_books readable by everyone" ON public.legal_books FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER legal_books_updated_at BEFORE UPDATE ON public.legal_books FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  facts TEXT,
  jurisdiction_id UUID REFERENCES public.jurisdictions(id) ON DELETE SET NULL,
  jurisdiction_note TEXT,
  event_date DATE,
  as_of_date DATE,
  issue_area TEXT,
  parties TEXT,
  sides TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issues TO authenticated;
GRANT ALL ON public.issues TO service_role;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own issues" ON public.issues FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER issues_updated_at BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  proposition TEXT NOT NULL,
  truth_state TEXT NOT NULL DEFAULT 'INFERRED',
  reasoning_summary TEXT,
  jurisdiction_id UUID REFERENCES public.jurisdictions(id) ON DELETE SET NULL,
  source_ids UUID[] NOT NULL DEFAULT '{}',
  contrary_source_ids UUID[] NOT NULL DEFAULT '{}',
  citation TEXT,
  pinpoint TEXT,
  verified_at TIMESTAMPTZ,
  currentness_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO authenticated;
GRANT ALL ON public.findings TO service_role;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own findings" ON public.findings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER findings_updated_at BEFORE UPDATE ON public.findings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.issue_elements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  element TEXT NOT NULL,
  burden_side TEXT,
  evidence_needed TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  legal_source_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_elements TO authenticated;
GRANT ALL ON public.issue_elements TO service_role;
ALTER TABLE public.issue_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own issue_elements" ON public.issue_elements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER issue_elements_updated_at BEFORE UPDATE ON public.issue_elements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.remedies_defenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  legal_source_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remedies_defenses TO authenticated;
GRANT ALL ON public.remedies_defenses TO service_role;
ALTER TABLE public.remedies_defenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own remedies_defenses" ON public.remedies_defenses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER remedies_defenses_updated_at BEFORE UPDATE ON public.remedies_defenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.issue_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.legal_sources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  relevance_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issue_id, source_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_sources TO authenticated;
GRANT ALL ON public.issue_sources TO service_role;
ALTER TABLE public.issue_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own issue_sources" ON public.issue_sources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.issue_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.legal_books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  relevance_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issue_id, book_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_books TO authenticated;
GRANT ALL ON public.issue_books TO service_role;
ALTER TABLE public.issue_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own issue_books" ON public.issue_books FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.red_team_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  finding_id UUID REFERENCES public.findings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'pending_research',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.red_team_checks TO authenticated;
GRANT ALL ON public.red_team_checks TO service_role;
ALTER TABLE public.red_team_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own red_team_checks" ON public.red_team_checks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER red_team_checks_updated_at BEFORE UPDATE ON public.red_team_checks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.research_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entry TEXT NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'note',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_log TO authenticated;
GRANT ALL ON public.research_log TO service_role;
ALTER TABLE public.research_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own research_log" ON public.research_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);