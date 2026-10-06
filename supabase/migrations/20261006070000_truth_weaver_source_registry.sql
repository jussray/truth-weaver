-- Truth Weaver legal source registry and legal-book metadata.
-- Registry records describe known source families. They do not claim that every
-- jurisdiction, historical version, or legal issue is fully covered.

INSERT INTO public.jurisdictions (name, country_code, layer, legal_system, notes)
SELECT 'United States federal', 'US', 'country', 'federal constitutional republic; mixed federal/state common-law systems',
       'Federal layer for United States law.'
WHERE NOT EXISTS (SELECT 1 FROM public.jurisdictions WHERE name = 'United States federal' AND layer = 'country');

INSERT INTO public.jurisdictions (parent_id, name, country_code, layer, legal_system, notes)
SELECT parent.id, 'Pennsylvania', 'US', 'state', 'common law with codified statutes and regulations',
       'Commonwealth of Pennsylvania.'
FROM public.jurisdictions parent
WHERE parent.name = 'United States federal'
  AND NOT EXISTS (SELECT 1 FROM public.jurisdictions WHERE name = 'Pennsylvania' AND layer = 'state');

INSERT INTO public.jurisdictions (parent_id, name, country_code, layer, legal_system, notes)
SELECT parent.id, 'Philadelphia', 'US', 'municipal', 'municipal law within Pennsylvania',
       'City and County of Philadelphia. State and federal law may also apply.'
FROM public.jurisdictions parent
WHERE parent.name = 'Pennsylvania'
  AND NOT EXISTS (SELECT 1 FROM public.jurisdictions WHERE name = 'Philadelphia' AND layer = 'municipal');

INSERT INTO public.jurisdictions (name, country_code, layer, legal_system, notes)
SELECT 'United Kingdom', 'GB', 'country', 'multiple UK legal systems',
       'Jurisdiction detail may need England and Wales, Scotland, or Northern Ireland.'
WHERE NOT EXISTS (SELECT 1 FROM public.jurisdictions WHERE name = 'United Kingdom' AND layer = 'country');

INSERT INTO public.jurisdictions (name, country_code, layer, legal_system, notes)
SELECT 'Canada', 'CA', 'country', 'federal system; common law and Quebec civil law',
       'Province or territory may also control.'
WHERE NOT EXISTS (SELECT 1 FROM public.jurisdictions WHERE name = 'Canada' AND layer = 'country');

INSERT INTO public.jurisdictions (name, country_code, layer, legal_system, notes)
SELECT 'Nigeria', 'NG', 'country', 'federal system with statutory, common, customary, and Islamic law dimensions',
       'State and local law can matter; federal-only answers are not universally sufficient.'
WHERE NOT EXISTS (SELECT 1 FROM public.jurisdictions WHERE name = 'Nigeria' AND layer = 'country');

INSERT INTO public.jurisdictions (name, country_code, layer, legal_system, notes)
SELECT 'Thailand', 'TH', 'country', 'civil law system',
       'Official Thai-language sources may control over translations.'
WHERE NOT EXISTS (SELECT 1 FROM public.jurisdictions WHERE name = 'Thailand' AND layer = 'country');

INSERT INTO public.jurisdictions (name, country_code, layer, legal_system, notes)
SELECT 'European Union', NULL, 'supranational', 'supranational European Union law',
       'Member-state law may also apply.'
WHERE NOT EXISTS (SELECT 1 FROM public.jurisdictions WHERE name = 'European Union' AND layer = 'supranational');

-- Source-family registry. linked_source_family means the official source is
-- registered and eligible for source-bound discovery; it is not a claim that
-- every document/version has been integrated or verified.

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'United States Code', 'statute_code',
       'Office of the Law Revision Counsel, U.S. House of Representatives',
       'https://uscode.house.gov', true, true, 'primary',
       'Federal statutes; authority depends on title/status and underlying enactments where relevant.',
       'Official U.S. Code source family.',
       'Check current edition/supplement and source-credit notes; use Statutes at Large where controlling historical enactment text is required.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'United States federal'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://uscode.house.gov');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Electronic Code of Federal Regulations', 'regulation',
       'Office of the Federal Register / U.S. Government Publishing Office',
       'https://www.ecfr.gov', true, true, 'primary',
       'Current codified federal regulations; legal effect and historical date must be checked.',
       'Official eCFR source family.',
       'Check displayed current-through date and, for historical questions, Federal Register or historical CFR material.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'United States federal'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.ecfr.gov');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'GovInfo', 'jurisdiction_defined_authority',
       'U.S. Government Publishing Office',
       'https://www.govinfo.gov', true, true, 'primary',
       'Official publications including statutes, regulations, congressional and other federal materials.',
       'Official federal publication repository.',
       'Use collection/version metadata and publication dates; determine governing force by document class.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'United States federal'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.govinfo.gov');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Supreme Court of the United States', 'judicial_decision',
       'Supreme Court of the United States',
       'https://www.supremecourt.gov', true, true, 'primary',
       'Court opinions and orders; precedential force depends on disposition and later treatment.',
       'Official Supreme Court source family.',
       'Check opinion/order status, later history, and relevant precedent before relying on a proposition.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'United States federal'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.supremecourt.gov');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Pennsylvania General Assembly legislation', 'statute_code',
       'Pennsylvania General Assembly',
       'https://www.legis.state.pa.us', true, true, 'primary',
       'Pennsylvania statutes and legislative material.',
       'Official Pennsylvania legislative source family.',
       'Check current statutory text, effective dates, amendments, uncodified acts where relevant, and historical version for time-specific questions.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Pennsylvania'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.legis.state.pa.us');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Pennsylvania Code and Bulletin', 'regulation',
       'Commonwealth of Pennsylvania',
       'https://www.pacodeandbulletin.gov', true, true, 'primary',
       'Pennsylvania regulations and Pennsylvania Bulletin publication material.',
       'Official Pennsylvania administrative-law source family.',
       'Check current code text, Bulletin changes, effective dates, and historical material where required.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Pennsylvania'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.pacodeandbulletin.gov');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Unified Judicial System of Pennsylvania', 'judicial_decision',
       'Unified Judicial System of Pennsylvania',
       'https://www.pacourts.us', true, true, 'primary',
       'Pennsylvania court opinions, rules, dockets and court materials as published by the judiciary.',
       'Official Pennsylvania judiciary source family.',
       'Check precedential status, court level, later history, rules amendments, and effective dates.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Pennsylvania'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.pacourts.us');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'City of Philadelphia', 'jurisdiction_defined_authority',
       'City of Philadelphia',
       'https://www.phila.gov', true, true, 'discovery',
       'Official city pages, departments, forms and guidance. A city webpage is not automatically an ordinance or binding rule.',
       'Official municipal discovery source family.',
       'Trace legal propositions to the Philadelphia Code, regulation, order, decision, or other governing instrument before VERIFIED LAW.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Philadelphia'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.phila.gov');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'UK Legislation', 'statute_code',
       'The National Archives',
       'https://www.legislation.gov.uk', true, true, 'primary',
       'UK legislation and available revised/consolidated text.',
       'Official UK legislation source family.',
       'Check extent, commencement, amendments, revision status, and the legal system within the UK that governs the issue.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'United Kingdom'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://www.legislation.gov.uk');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Justice Laws Website', 'statute_code',
       'Department of Justice Canada',
       'https://laws-lois.justice.gc.ca', true, true, 'primary',
       'Consolidated federal Acts and regulations of Canada.',
       'Official Canadian federal legislation source family.',
       'Check consolidation currency, coming-into-force information, previous versions, and amending enactments when relevant.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Canada'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://laws-lois.justice.gc.ca');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'EUR-Lex', 'jurisdiction_defined_authority',
       'European Union',
       'https://eur-lex.europa.eu', true, true, 'primary',
       'EU treaties, legislation, Official Journal material and related EU law.',
       'Official EU law source family.',
       'Check document status, consolidated version date, amendments, applicability and member-state implementation where relevant.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'European Union'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://eur-lex.europa.eu');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Federal Ministry of Justice Nigeria', 'jurisdiction_defined_authority',
       'Federal Ministry of Justice, Nigeria',
       'https://justice.gov.ng', true, true, 'discovery',
       'Official ministry material and legal-publication functions; not every page is governing law.',
       'Official Nigerian federal discovery source family.',
       'Verify the specific current Act, gazette, court decision or other operative authority and its effective date.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Nigeria'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://justice.gov.ng');

INSERT INTO public.legal_sources
(jurisdiction_id, name, source_type, issuing_body, base_url, is_official, is_authentic,
 source_role, authority_weight, coverage_description, currentness_strategy, integration_status)
SELECT j.id, 'Royal Thai Government Gazette', 'gazette',
       'Royal Thai Government Gazette',
       'https://ratchakitcha.soc.go.th', true, true, 'primary',
       'Official Thai government gazette source family.',
       'Official gazette publication source family; Thai-language text may be controlling.',
       'Check promulgation, effective date, amendment/repeal and any authoritative later text or translation limitations.',
       'linked_source_family'
FROM public.jurisdictions j
WHERE j.name = 'Thailand'
  AND NOT EXISTS (SELECT 1 FROM public.legal_sources WHERE base_url = 'https://ratchakitcha.soc.go.th');

-- Published legal authorities. Metadata only; no copyrighted full text is stored.
INSERT INTO public.legal_books
(title, author, edition, year, publisher, topic, book_type, catalog_url, licensing_note, secondary_role_note)
SELECT 'Commentaries on the Laws of England', 'William Blackstone', 'First edition', 1765,
       'Clarendon Press', 'English common law; historical doctrine', 'treatise', NULL,
       'Public-domain historical work. Use a verified edition or library scan for page-level citation.',
       'SECONDARY / HISTORICAL. Useful for doctrine and history; not current governing law.'
WHERE NOT EXISTS (SELECT 1 FROM public.legal_books WHERE title = 'Commentaries on the Laws of England' AND author = 'William Blackstone');

INSERT INTO public.legal_books
(title, author, edition, year, publisher, topic, book_type, catalog_url, licensing_note, secondary_role_note)
SELECT 'Commentaries on the Constitution of the United States', 'Joseph Story', 'First edition', 1833,
       'Hilliard, Gray, and Company', 'United States constitutional law; historical doctrine', 'treatise', NULL,
       'Public-domain historical work. Use a verified edition or library scan for page-level citation.',
       'SECONDARY / HISTORICAL. Useful for doctrine and history; not current governing law.'
WHERE NOT EXISTS (SELECT 1 FROM public.legal_books WHERE title = 'Commentaries on the Constitution of the United States' AND author = 'Joseph Story');

INSERT INTO public.legal_books
(title, author, edition, year, publisher, topic, book_type, catalog_url, licensing_note, secondary_role_note)
SELECT 'Restatement (Second) of Contracts', 'American Law Institute', 'Second', 1981,
       'American Law Institute Publishers', 'Contracts', 'restatement',
       'https://www.ali.org/publications/show/contracts/',
       'Copyrighted/licensed publication. Store metadata and lawful excerpts only unless licensed for full-text use.',
       'SECONDARY / PERSUASIVE. It can be influential but does not itself establish governing law.'
WHERE NOT EXISTS (SELECT 1 FROM public.legal_books WHERE title = 'Restatement (Second) of Contracts' AND author = 'American Law Institute');
