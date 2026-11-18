# Python XDK & X API v2 Workflow

Official X API v2 client integration and filtered-stream workflow for Truth Weaver.
- Documentation Index: [https://docs.x.com/llms.txt](https://docs.x.com/llms.txt)
- OpenAPI Specification: [https://api.x.com/2/openapi.json](https://api.x.com/2/openapi.json)
- Upstream Python Samples: [https://github.com/xdevplatform/samples/tree/main/python](https://github.com/xdevplatform/samples/tree/main/python)

---

## 1. Authentication & Setup Notes

### Secrets & Credentials
- **GitHub Actions & CI:** The token is securely stored in **GitHub Secrets** under `X_BEARER_TOKEN` (or `TWITTER_BEARER_TOKEN`). Automated CI workflows consume this secret via `env: X_BEARER_TOKEN: ${{ secrets.X_BEARER_TOKEN }}`. Secret values are never printed, captured in artifacts, or committed into repository code.
- **Local Development:** Export the bearer token in your development shell:
  ```bash
  export X_BEARER_TOKEN="your_x_bearer_token_here"
  ```
- **Read-Only / Discovery Mode:** When `X_BEARER_TOKEN` is unset, `scripts/x_api_client.py` operates in read-only discovery mode, allowing documentation retrieval (`--docs`) from `https://docs.x.com/llms.txt` without credentials. API endpoints fail closed with an explicit `AuthenticationError`.

---

## 2. Filtered Stream Architecture

Filtered streaming provides real-time public tweet ingestion matching predefined rule criteria. The client maintains a persistent HTTP connection to `/2/tweets/search/stream`.

```text
[X Stream Rules Endpoint] ──> Configure rules (/2/tweets/search/stream/rules)
                                   │
                                   ▼
[X Filtered Stream]       ──> GET /2/tweets/search/stream
                                   │ (Keep-alive heartbeats every 20s)
                                   ▼
[XDKClient Line Reader]   ──> Parses line-delimited JSON chunks
                                   │
                                   ▼
[Legal Triage Pipeline]   ──> Categorized as ALLEGED FACT / INFERRED
                                   │
                                   ▼
[Clean Shutdown Guard]    ──> SIGINT/SIGTERM or stop_check -> Closes connection
```

### Rate Limits & Tier Constraints
- **Basic / Pay-as-you-go Tier:** 1 concurrent streaming connection; up to 50 active rules.
- **Rate Limit Response (429):** Captured with `x-rate-limit-reset` epoch timestamp via `RateLimitError`.
- **Heartbeats:** The X streaming server sends periodic empty newlines (`\r\n`) to keep connections alive; these are silently skipped by the stream parser.

---

## 3. Filtered-Stream Example with Configurable Rules & Clean Shutdown

Below is the complete implementation for managing stream rules and consuming events with graceful shutdown:

```python
#!/usr/bin/env python3
"""
Example: Filtered stream with configurable rules and clean shutdown.
"""

import signal
import sys
from scripts.x_api_client import XDKClient, RateLimitError, AuthenticationError

# 1. Initialize client (reads X_BEARER_TOKEN from GitHub Secrets or environment)
client = XDKClient()

# 2. Configure filtered stream rules
rules_to_apply = [
    {
        "value": '("eviction notice" OR "unlawful detainer") lang:en -is:retweet',
        "tag": "housing_urgent",
    },
    {
        "value": '("debt collection lawsuit" OR "summons and complaint") lang:en -is:retweet',
        "tag": "debt_defense",
    },
]

# Fetch current rules and remove stale ones if necessary
current_rules = client.get_stream_rules()
existing_data = current_rules.get("data", [])
if existing_data:
    stale_ids = [r["id"] for r in existing_data]
    print(f"Deleting {len(stale_ids)} existing stream rules...")
    client.delete_stream_rules(stale_ids)

# Add new rules
print("Adding updated filter rules...")
created_rules = client.add_stream_rules(rules_to_apply)
print(f"Active rules: {created_rules.get('meta', {}).get('summary', {})}")

# 3. Setup clean shutdown handler for SIGINT (Ctrl+C) and SIGTERM
stop_requested = False


def handle_shutdown(signum, frame):
    global stop_requested
    print("\nShutdown signal received. Disconnecting stream cleanly...")
    stop_requested = True


signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

# 4. Connect to filtered stream
print("Connecting to live filtered stream. Press Ctrl+C to stop.")
try:
    for event in client.stream_filtered_tweets(
        tweet_fields="created_at,author_id,entities",
        stop_check=lambda: stop_requested,
    ):
        data = event.get("data", {})
        tweet_id = data.get("id")
        text = data.get("text", "").replace("\n", " ")
        matching_rules = event.get("matching_rules", [])
        tags = [r.get("tag") for r in matching_rules]

        print(f"[{','.join(tags)}] Tweet {tweet_id}: {text[:80]}...")

        # Ingestion guard: Treat public social data as ALLEGED FACT only
        # Hand off to triage pipeline (e.g. /notice-analyzer intake)
except RateLimitError as e:
    print(f"Rate limit exceeded. Resets at {e.reset_time}.")
except AuthenticationError as e:
    print(f"Authentication failure: {e}")
finally:
    print("Stream connection terminated cleanly.")
```

---

## 4. Testing & Verification

Unit tests in `test/test_x_api_client.py` validate all client behaviors **completely offline** without making live network requests:
- **Authentication Failures:** Missing tokens, HTTP 401 Unauthorized, HTTP 403 Forbidden.
- **Rate Limits:** HTTP 429 response handling and `x-rate-limit-reset` header extraction.
- **Pagination:** Multi-page result stitching via `next_token` and termination bounds.
- **Stream Rules:** Rule query, addition payload structure, and ID-based deletion.
- **Stream Chunk Parsing & Clean Shutdown:** Heartbeat filtering, chunk parsing, and termination via `stop_check`.

Run the test suite:
```bash
python3 -m unittest discover -s test -p "test_*.py" -v
```


## Scheduled Lead Triage Pipeline

The automated lead triage pipeline is implemented in `scripts/x_lead_triage.py`:
- **Epistemic Classification**: Ingested social mentions are tagged with status `ALLEGED_FACT` under the Truth Weaver truth-continuity model.
- **Categorization**: Analyzes text for urgency patterns including `housing_urgent` (eviction, notice to quit), `debt_defense` (summons, collections lawsuits), and `legal_demand` (formal attorney notices).
- **Execution**: Run locally or in CI via:
  ```bash
  python3 scripts/x_lead_triage.py --dry-run
  python3 scripts/x_lead_triage.py --json --output triage-summary.json
  ```
- **Automated Workflow Specification**: Runs on schedule with `X_BEARER_TOKEN` or `TWITTER_BEARER_TOKEN`.
