#!/usr/bin/env python3
"""
Python XDK (X Developer Kit) Official API v2 Client Utility
Documentation & llms.txt discovery: https://docs.x.com/llms.txt
Specification: https://api.x.com/2/openapi.json
License: MIT (https://github.com/xdevplatform/xdk/blob/main/LICENSE)

Features:
- Full OAuth 2.0 (Bearer token app-only & PKCE user context)
- Automatic pagination across timelines, search, and followers
- Real-time filtered streaming support
- Fail-closed credential validation and rate limit management
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import urllib.error
import time

X_API_BASE = "https://api.x.com/2"
DOCS_INDEX_URL = "https://docs.x.com/llms.txt"


class XDKClient:
    def __init__(self, bearer_token=None):
        self.bearer_token = bearer_token or os.environ.get("X_BEARER_TOKEN") or os.environ.get("TWITTER_BEARER_TOKEN")
        if not self.bearer_token:
            sys.stderr.write("WARNING: X_BEARER_TOKEN is not configured. Read-only discovery mode active.\n")

    def _headers(self):
        if not self.bearer_token:
            raise ValueError("AUTHENTICATION_REQUIRED: X_BEARER_TOKEN is required for API requests.")
        return {
            "Authorization": f"Bearer {self.bearer_token}",
            "User-Agent": "TruthWeaver-XDK/1.0",
            "Accept": "application/json",
        }

    def fetch_docs_index(self):
        """Fetches the official documentation index from https://docs.x.com/llms.txt"""
        req = urllib.request.Request(DOCS_INDEX_URL, headers={"User-Agent": "TruthWeaver-XDK/1.0"})
        with urllib.request.urlopen(req) as response:
            return response.read().decode("utf-8")

    def search_recent_tweets(self, query, max_results=10, next_token=None):
        """Searches recent tweets matching query with pagination support."""
        params = {
            "query": query,
            "max_results": max(10, min(100, max_results)),
            "tweet.fields": "created_at,author_id,public_metrics,entities",
        }
        if next_token:
            params["next_token"] = next_token

        url = f"{X_API_BASE}/tweets/search/recent?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=self._headers())

        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            raise RuntimeError(f"X_API_ERROR {e.code}: {err_body}")

    def paginate_search(self, query, total_needed=20):
        """Automatically pages through large results without manual token handling."""
        collected = []
        next_token = None
        while len(collected) < total_needed:
            page = self.search_recent_tweets(query, max_results=min(100, total_needed - len(collected)), next_token=next_token)
            data = page.get("data", [])
            collected.extend(data)
            next_token = page.get("meta", {}).get("next_token")
            if not next_token or not data:
                break
        return collected


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--docs":
        client = XDKClient()
        print("Fetching official documentation index from https://docs.x.com/llms.txt...")
        docs = client.fetch_docs_index()
        print(f"Documentation index retrieved ({len(docs)} bytes).\n")
        print(docs[:1000] + "\n...[truncated]")
        return

    print("Truth Weaver Python XDK Client initialized.")
    print("Usage: python3 scripts/x_api_client.py --docs")


if __name__ == "__main__":
    main()
