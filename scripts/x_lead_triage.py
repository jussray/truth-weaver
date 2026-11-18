#!/usr/bin/env python3
"""
Truth Weaver — X Lead Triage Pipeline

Ingests recent public posts from the official X API v2 using XDKClient,
evaluates legal distress patterns (housing, debt defense, legal demands),
classifies triage categories, and enforces the epistemological boundary (ALLEGED_FACT).

Features:
- Bearer token authentication via environment (X_BEARER_TOKEN or TWITTER_BEARER_TOKEN)
- Automated search query construction for high-intent legal notice inquiries
- Multi-category legal classifier (housing_urgent, debt_defense, legal_demand)
- Fail-closed error handling for rate limits and authentication
- Offline test mode and dry-run support
"""

import os
import sys
import json
import argparse
import datetime
import re

import os, sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from x_api_client import (
    XDKClient,
    RateLimitError,
    AuthenticationError,
    XAPIError,
)

DEFAULT_SEARCH_QUERY = (
    '("eviction notice" OR "unlawful detainer" OR "notice to vacate" OR '
    '"debt collection lawsuit" OR "summons and complaint" OR "received a legal notice") '
    'lang:en -is:retweet'
)

CATEGORY_RULES = {
    "housing_urgent": [
        re.compile(r"\b(eviction\s+notice|unlawful\s+detainer|notice\s+to\s+vacate|pay\s+or\s+quit|landlord\s+notice)\b", re.IGNORECASE),
    ],
    "debt_defense": [
        re.compile(r"\b(debt\s+collection\s+lawsuit|summons\s+and\s+complaint|credit\s+card\s+lawsuit|collector\s+court|wage\s+garnishment)\b", re.IGNORECASE),
    ],
    "legal_demand": [
        re.compile(r"\b(demand\s+letter|cease\s+and\s+desist|legal\s+notice\s+received|attorney\s+letter)\b", re.IGNORECASE),
    ],
}


def classify_text(text):
    """
    Classifies legal notice text into triage categories.
    Returns list of matched categories (e.g. ['housing_urgent']).
    """
    categories = []
    for cat, regexes in CATEGORY_RULES.items():
        if any(r.search(text) for r in regexes):
            categories.append(cat)
    if not categories:
        categories.append("general_legal_inquiry")
    return categories


def build_triage_item(tweet):
    """
    Converts raw X API tweet JSON into a Truth Weaver triage record.
    Epistemic status is pinned to ALLEGED_FACT.
    """
    tweet_id = tweet.get("id", "unknown")
    text = tweet.get("text", "").strip()
    created_at = tweet.get("created_at")
    author_id = tweet.get("author_id", "anonymous")
    categories = classify_text(text)

    return {
        "lead_id": f"x_{tweet_id}",
        "platform": "x",
        "source_url": f"https://x.com/i/web/status/{tweet_id}",
        "author_id": author_id,
        "created_at": created_at,
        "triaged_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "text": text,
        "categories": categories,
        "epistemic_status": "ALLEGED_FACT",
        "recommended_action": "intake_and_analyze",
        "verified": False,
    }


def run_triage(client=None, query=DEFAULT_SEARCH_QUERY, max_results=10, dry_run=False):
    """
    Executes search and returns a list of triaged lead items.
    """
    if dry_run:
        fixture_tweets = [
            {
                "id": "1990000000000000001",
                "text": "I just received a 3-day eviction notice from my landlord what should I do?",
                "author_id": "usr_101",
                "created_at": "2026-11-17T18:00:00Z",
            },
            {
                "id": "1990000000000000002",
                "text": "Served with a summons and complaint for old credit card debt collection lawsuit.",
                "author_id": "usr_102",
                "created_at": "2026-11-17T18:15:00Z",
            },
        ]
        return [build_triage_item(t) for t in fixture_tweets]

    if client is None:
        client = XDKClient()

    if not client.bearer_token:
        raise AuthenticationError("X_BEARER_TOKEN is not configured.")

    response = client.search_recent_tweets(query=query, max_results=max_results)
    tweets = response.get("data", [])
    return [build_triage_item(t) for t in tweets]


def main():
    parser = argparse.ArgumentParser(description="Truth Weaver — X Lead Triage Pipeline")
    parser.add_argument("--query", default=DEFAULT_SEARCH_QUERY, help="Search query for X API v2")
    parser.add_argument("--max-results", type=int, default=10, help="Maximum tweets to fetch (10-100)")
    parser.add_argument("--dry-run", action="store_true", help="Run in offline dry-run mode")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    parser.add_argument("--output", help="Optional file path to write results")
    args = parser.parse_args()

    try:
        leads = run_triage(
            query=args.query,
            max_results=args.max_results,
            dry_run=args.dry_run,
        )
    except AuthenticationError as e:
        sys.stderr.write(f"[AUTH_NOTICE] {e}\n")
        if not args.dry_run:
            sys.stderr.write("Set X_BEARER_TOKEN in GitHub Secrets to enable live ingestion.\n")
            sys.exit(0)
    except RateLimitError as e:
        sys.stderr.write(f"[RATE_LIMIT] X API rate limit reached. Resets at {e.reset_time}\n")
        sys.exit(0)
    except Exception as e:
        sys.stderr.write(f"[ERROR] Triage failed: {e}\n")
        sys.exit(1)

    if args.json:
        output_data = json.dumps({"count": len(leads), "leads": leads}, indent=2)
    else:
        lines = [f"=== Truth Weaver X Lead Triage ({len(leads)} leads) ==="]
        for lead in leads:
            lines.append(f"- [{','.join(lead['categories'])}] ({lead['epistemic_status']}) {lead['lead_id']}")
            lines.append(f"  Source: {lead['source_url']}")
            lines.append(f"  Text: {lead['text'][:120]}...")
        output_data = "\n".join(lines)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output_data + "\n")
        print(f"Results written to {args.output}")
    else:
        print(output_data)


if __name__ == "__main__":
    main()
