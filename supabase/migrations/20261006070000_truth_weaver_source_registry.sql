-- Truth Weaver concrete legal-source and legal-book expansion.
-- Extends the existing source-family registry without creating duplicate roots.
-- A linked source family is not a claim of exhaustive jurisdiction coverage.

-- Concrete jurisdictions -----------------------------------------------------

INSERT INTO public.jurisdictions (parent_id, name, country_code, layer, legal_system, notes)
SELECT parent.id, 'Pennsylvania', 'US', 'state',
       'common law with codified statutes and regulations',
       'Commonwealth of Pennsylvania. Federal and local law may also apply.'
FROM public.jurisdictions parent
WHERE parent.name = 'United States (Federal)'
  AND NOT EXISTS (
    SELECT 1 FROM public.jurisdictions
    WHERE name = 'Pennsylvania' AND country_code = 'US' AND layer = 'state'
  );

INSERT INTO public.jurisdictions (parent_id, name, country_code, layer, legal_system, notes)
SELECT parent.id, 'Philadelphia', 'US', 'municipal',
       'municipal law within Pennsylvania',
       'City and County of Philadelphia. Pennsylvania and federal law may also apply.'
FROM public.jurisdictions parent
WHERE parent.name = 'Pennsylvania'
  AND NOT EXISTS (
    SELECT 1 FROM public.jurisdictions
    WHERE name = 'Philadelphia' AND country_code = 'US' AND layer = 'municipal'
  );

INSERT INTO public.jurisdictions (name, country_code, layer, legal_system, notes)
SELECT 'Canada', 'CA', 'country',
       'federal system; common law outside Quebec and civil law in Quebec private law',
       'Province or territory may also control the issue.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.jurisdictions WHERE name = 'Canada' AND country_code = 'CA'
);

INSERT INTO public.jurisdictions (name, country_code, layer, legal_system, notes)
SELECT 'Nigeria', 'NG', 'country',
       'federal system with statutory, common, customary and Islamic-law dimensions',
       'State and local law can matter; federal-only research is not universally sufficient.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.jurisdictions WHERE name = 'Nigeria' AND country_code = 'NG'
);

INSERT INTO public.jurisdictions (name, country_code, layer, legal_system, notes)
SELECT 'Thailand', 'TH', 'country', 'civil law system',
       'Official Thai-language sources may control over translations.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.jurisdictions WHERE name = 'Thailand' AND country_code = 'TH'
);

-- Concrete official/discovery source families -------------------------------

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Pennsylvania General Assembly', 'statute_code',
       'Pennsylvania General Assembly', 'https://www.legis.state.pa.us',
       true, true, 'primary', 'Pennsylvania statutory authority',
       'Official Pennsylvania legislative source family.',
       'Check current text, effective dates, amendments, uncodified acts and historical versions when relevant.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Pennsylvania'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.legis.state.pa.us');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Pennsylvania Code and Bulletin', 'regulation',
       'Commonwealth of Pennsylvania', 'https://www.pacodeandbulletin.gov',
       true, true, 'primary', 'Pennsylvania administrative authority',
       'Official Pennsylvania Code and Pennsylvania Bulletin source family.',
       'Check Code currency, Bulletin changes, effective dates and historical material when required.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Pennsylvania'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.pacodeandbulletin.gov');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Unified Judicial System of Pennsylvania', 'judicial_decision',
       'Unified Judicial System of Pennsylvania', 'https://www.pacourts.us',
       true, true, 'primary', 'Pennsylvania judicial authority',
       'Official Pennsylvania judiciary source family.',
       'Check precedential status, court level, later history, rule amendments and effective dates.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Pennsylvania'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.pacourts.us');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'City of Philadelphia', 'jurisdiction_defined_authority',
       'City of Philadelphia', 'https://www.phila.gov',
       true, true, 'discovery', 'Official city material; page-level legal force varies',
       'Official municipal pages, departments, forms and guidance.',
       'Trace a proposition to the Philadelphia Code, regulation, order, decision or other governing instrument before VERIFIED LAW.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Philadelphia'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.phila.gov');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Justice Laws Website', 'statute_code',
       'Department of Justice Canada', 'https://laws-lois.justice.gc.ca',
       true, true, 'primary', 'Canadian federal statutes and regulations',
       'Official consolidated federal Acts and regulations.',
       'Check consolidation currency, commencement, previous versions and amending enactments.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Canada'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://laws-lois.justice.gc.ca');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Supreme Court of Canada Decisions', 'judicial_decision',
       'Supreme Court of Canada', 'https://decisions.scc-csc.ca',
       true, true, 'primary', 'Supreme Court of Canada judicial authority',
       'Official Supreme Court of Canada decision source family.',
       'Check disposition, later history and the proposition for which the decision is cited.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Canada'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://decisions.scc-csc.ca');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Federal Ministry of Justice Nigeria', 'jurisdiction_defined_authority',
       'Federal Ministry of Justice, Nigeria', 'https://justice.gov.ng',
       true, true, 'discovery', 'Official ministry material; page-level legal force varies',
       'Official Nigerian federal legal-publication and ministry source family.',
       'Verify the specific current Act, gazette, court decision or other operative authority and effective date.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Nigeria'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://justice.gov.ng');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'National Assembly of Nigeria', 'enacted_act',
       'National Assembly of the Federal Republic of Nigeria', 'https://nass.gov.ng',
       true, true, 'discovery', 'Federal legislative source family; document availability varies',
       'Official National Assembly source family.',
       'Verify enacted text, assent/publication, amendments, commencement and current status in authoritative publication.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Nigeria'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://nass.gov.ng');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Royal Thai Government Gazette', 'gazette',
       'Royal Thai Government Gazette', 'https://ratchakitcha.soc.go.th',
       true, true, 'primary', 'Official gazette publication',
       'Official Thai government gazette source family.',
       'Check promulgation, effective date, amendment/repeal and authoritative later text; Thai-language text may control.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Thailand'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://ratchakitcha.soc.go.th');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Office of the Council of State Thailand', 'statute_code',
       'Office of the Council of State, Thailand', 'https://www.krisdika.go.th',
       true, true, 'discovery', 'Official legal-information source family',
       'Official Council of State legal-information source family.',
       'Verify authoritative Thai text, effective date, amendment/repeal and translation status.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Thailand'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.krisdika.go.th');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Supreme Court of the United Kingdom', 'judicial_decision',
       'Supreme Court of the United Kingdom', 'https://www.supremecourt.uk',
       true, true, 'primary', 'UK Supreme Court judicial authority',
       'Official UK Supreme Court source family.',
       'Check disposition, later treatment and the UK legal system/territorial extent relevant to the proposition.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'United Kingdom'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.supremecourt.uk');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Court of Justice of the European Union', 'judicial_decision',
       'Court of Justice of the European Union', 'https://curia.europa.eu',
       true, true, 'primary', 'EU judicial authority',
       'Official CJEU source family.',
       'Check procedural posture, judgment/order status, later treatment and applicable EU/member-state context.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'European Union'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://curia.europa.eu');

-- Legal books / published authorities ----------------------------------------

UPDATE public.legal_books
SET edition = COALESCE(edition, 'First edition'),
    licensing_note = 'Public-domain historical work. Use a verified edition or library scan for page-level citation.',
    secondary_role_note = 'SECONDARY / HISTORICAL. Useful for doctrine and history; not current governing law.'
WHERE title = 'Blackstone, Commentaries on the Laws of England'
  AND author = 'William Blackstone';

INSERT INTO public.legal_books
(title, author, edition, year, publisher, topic, book_type, catalog_url, licensing_note, secondary_role_note)
SELECT 'Commentaries on the Constitution of the United States', 'Joseph Story',
       'First edition', 1833, 'Hilliard, Gray, and Company',
       'United States constitutional law; historical doctrine', 'treatise', NULL,
       'Public-domain historical work. Use a verified edition or library scan for page-level citation.',
       'SECONDARY / HISTORICAL. Useful for doctrine and history; not current governing law.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.legal_books
  WHERE title = 'Commentaries on the Constitution of the United States'
    AND author = 'Joseph Story'
);

INSERT INTO public.legal_books
(title, author, edition, year, publisher, topic, book_type, catalog_url, licensing_note, secondary_role_note)
SELECT 'Restatement (Second) of Contracts', 'American Law Institute',
       'Second', 1981, 'American Law Institute Publishers',
       'Contracts', 'restatement',
       'https://www.ali.org/publications/show/contracts/',
       'Copyrighted/licensed publication. Store metadata and lawful excerpts only unless licensed for full-text use.',
       'SECONDARY / PERSUASIVE. It can be influential but does not itself establish governing law.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.legal_books
  WHERE title = 'Restatement (Second) of Contracts'
    AND author = 'American Law Institute'
);
