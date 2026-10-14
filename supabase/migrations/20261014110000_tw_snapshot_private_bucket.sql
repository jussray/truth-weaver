-- Truth Weaver Snapshot evidence stays private. Only service role may upload or sign URLs.
-- This migration does not create a downloadable report, entitlement or payment proof.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tw-snapshot-reports', 'tw-snapshot-reports', false, 524288, ARRAY['text/plain', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
-- Deliberately no storage.objects client policies. Runtime also refuses a public bucket.
