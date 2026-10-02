CREATE TABLE IF NOT EXISTS public.custody_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_no BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  correlation_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'evidence_recorded',
    'authority_decided',
    'command_issued',
    'provider_write_attempted',
    'provider_read_back',
    'receipt_minted',
    'reconciled',
    'reconciliation_required',
    'provider_write_rejected'
  )),
  command_id TEXT,
  authority_decision_id TEXT,
  provider TEXT CHECK (provider IS NULL OR provider IN ('exa', 'notion', 'linear', 'slack')),
  external_object_id TEXT,
  previous_event_hash TEXT,
  event_hash TEXT NOT NULL UNIQUE CHECK (event_hash ~ '^sha256:[0-9a-f]{64}$'),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT custody_events_evidence_id CHECK (evidence_id LIKE 'evd_%'),
  CONSTRAINT custody_events_correlation_id CHECK (correlation_id LIKE 'cor_%'),
  CONSTRAINT custody_events_previous_hash CHECK (
    previous_event_hash IS NULL OR previous_event_hash ~ '^sha256:[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS custody_events_correlation_sequence_idx
  ON public.custody_events (correlation_id, sequence_no);
CREATE INDEX IF NOT EXISTS custody_events_evidence_idx
  ON public.custody_events (evidence_id, sequence_no);
CREATE INDEX IF NOT EXISTS custody_events_command_idx
  ON public.custody_events (command_id)
  WHERE command_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS custody_events_chain_link_uq
  ON public.custody_events (correlation_id, COALESCE(previous_event_hash, 'GENESIS'));

REVOKE ALL ON public.custody_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.custody_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.custody_events_sequence_no_seq TO service_role;
ALTER TABLE public.custody_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.block_custody_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'custody_events is append-only';
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS custody_events_append_only ON public.custody_events;
CREATE TRIGGER custody_events_append_only
BEFORE UPDATE OR DELETE ON public.custody_events
FOR EACH ROW EXECUTE FUNCTION public.block_custody_event_mutation();
