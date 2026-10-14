-- Truth Weaver Snapshot evidence stays private. Only service role may upload or sign URLs.
-- This migration does not create a downloadable report, entitlement or payment proof.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tw-snapshot-reports', 'tw-snapshot-reports', false, 524288, ARRAY['text/plain', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
-- Existing private bucket stays private, an accidentally public bucket is locked down.
-- Deliberately no storage.objects client policies. Runtime also refuses a public bucket.
