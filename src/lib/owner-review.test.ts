import { describe, expect, it } from 'vitest';
import { validateClaimInput, parseEvidenceReview, normalizeSitemaps, normalizeInspection, PUBLIC_URLS } from './owner-review';

describe('owner feature boundaries', () => {
  it('validates bounded evidence and rejects unsafe URLs', () => {
    expect(validateClaimInput({ claim: '  Test ', evidence: [{ description: ' Statement ', sourceUrl: 'https://example.org/' }] }).claim).toBe('Test');
    expect(() => validateClaimInput({ claim: 'Test', evidence: [{ description: 'x', sourceUrl: 'http://127.0.0.1/private' }] })).toThrow();
    expect(() => validateClaimInput({ claim: 'x'.repeat(2501), evidence: [] })).toThrow();
    expect(() => validateClaimInput({ claim: 'Test', evidence: Array(11).fill({ description: 'x' }) })).toThrow();
  });

  it('parses only bounded, non-authorizing AI gates', () => {
    const review = { evidenceGaps: ['Missing a primary source'], attackQuestions: ['What evidence contradicts this?'],
      nextGate: 'COLLECT_EVIDENCE', gateReason: 'Source missing', limitations: ['Not independently verified'] };
    expect(parseEvidenceReview(JSON.stringify(review)).nextGate).toBe('COLLECT_EVIDENCE');
    expect(() => parseEvidenceReview(JSON.stringify({ ...review, nextGate: 'PUBLISH' }))).toThrow();
    expect(() => parseEvidenceReview('<script>bad</script>')).toThrow();
  });

  it('never reports deprecated sitemap indexed totals', () => {
    const rows = normalizeSitemaps({ sitemap: [{
      path: 'https://truthweaver.jussco.company/sitemap.xml', isPending: true,
      errors: '1', contents: [{ type: 'web', submitted: '6', indexed: '6' }],
    }] });
    expect(rows[0]?.submittedUrls).toBe(6);
    expect(rows[0]?.pending).toBe(true);
    expect(rows[0]).not.toHaveProperty('indexed');
  });

  it('keeps unknown indexing distinct from indexed and rejects off-site inspection', () => {
    expect(normalizeInspection(PUBLIC_URLS[0]!, { inspectionResult: { indexStatusResult: { verdict: 'PASS' } } }).indexed).toBe(true);
    expect(normalizeInspection(PUBLIC_URLS[0]!, { inspectionResult: { indexStatusResult: { verdict: 'UNKNOWN' } } }).indexed).toBeNull();
    expect(() => normalizeInspection('https://other.example/', { inspectionResult: { indexStatusResult: { verdict: 'PASS' } } })).toThrow();
  });
});
