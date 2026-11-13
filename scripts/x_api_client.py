#!/usr/bin/env python3
"""
Python XDK (X Developer Kit) Official API v2 Client Utility
Documentation & llms.txt discovery: https://docs.x.com/llms.txt
Specification: https://api.x.com/2/openapi.json
License: MIT (https://github.com/xdevplatform/xdk/blob/main/LICENSE)

Features:
- Bearer token authentication via environment (X_BEARER_TOKEN or TWITTER_BEARER_TOKEN)
- Automated pagination across timelines and recent search
- Filtered stream connection with configurable rules and clean shutdown
- Explicit rate-limit inspection and fail-closed error handling
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


class XAPIError(Exception):
    """Base exception for X API errors."""
    def __init__(self, message, status_code=None, body=None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class AuthenticationError(XAPIError):
    """Raised when authentication fails or required token is missing."""
    pass


class RateLimitError(XAPIError):
    """Raised when X API returns 429 Too Many Requests."""
    def __init__(self, message, reset_time=None, remaining=None, body=None):
        super().__init__(message, status_code=429, body=body)
        self.reset_time = reset_time
        self.remaining = remaining


class XDKClient:
    def __init__(self, bearer_token=None):
        self.bearer_token = (
            bearer_token
            or os.environ.get("X_BEARER_TOKEN")
            or os.environ.get("TWITTER_BEARER_TOKEN")
        )
        if not self.bearer_token:
            sys.stderr.write(
                "NOTE: X_BEARER_TOKEN is not configured. Read-only docs discovery is active; "
                "API calls require credentials from GitHub Secrets or local environment.\n"
            )

    def _headers(self):
        if not self.bearer_token:
            raise AuthenticationError(
                "AUTHENTICATION_REQUIRED: X_BEARER_TOKEN is required for API requests. "
                "Set X_BEARER_TOKEN in your environment or GitHub Secrets."
            )
        return {
            "Authorization": f"Bearer {self.bearer_token}",
            "User-Agent": "TruthWeaver-XDK/1.0",
            "Accept": "application/json",
        }

    def _execute_request(self, req):
        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.status if hasattr(resp, "status") else 200
                content = resp.read().decode("utf-8")
                headers = dict(resp.headers) if hasattr(resp, "headers") else {}
                return {
                    "status": status,
                    "body": json.loads(content) if content.strip() else {},
                    "headers": headers,
                }
        except urllib.error.HTTPError as e:
            status = e.code
            err_body = e.read().decode("utf-8")
            headers = dict(e.headers) if hasattr(e, "headers") else {}

            if status in (401, 403):
                raise AuthenticationError(
                    f"Authentication failed ({status}): {err_body}",
                    status_code=status,
                    body=err_body,
                )
            if status == 429:
                reset_epoch = headers.get("x-rate-limit-reset")
                remaining = headers.get("x-rate-limit-remaining")
                reset_time = int(reset_epoch) if reset_epoch and reset_epoch.isdigit() else None
                raise RateLimitError(
                    f"Rate limit exceeded (429): resets at {reset_time}",
                    reset_time=reset_time,
                    remaining=remaining,
                    body=err_body,
                )
            raise XAPIError(
                f"X API error ({status}): {err_body}",
                status_code=status,
                body=err_body,
            )

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
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        res = self._execute_request(req)
        return res["body"]

    def paginate_search(self, query, total_needed=20, max_pages=10):
        """Automatically pages through search results without manual token handling."""
        collected = []
        next_token = None
        pages_fetched = 0

        while len(collected) < total_needed and pages_fetched < max_pages:
            needed = total_needed - len(collected)
            fetch_size = max(10, min(100, needed))
            page = self.search_recent_tweets(query, max_results=fetch_size, next_token=next_token)
            data = page.get("data", [])
            collected.extend(data)
            pages_fetched += 1

            next_token = page.get("meta", {}).get("next_token")
            if not next_token or not data:
                break

        return collected[:total_needed]

    # --- Filtered Stream Rule Management ---

    def get_stream_rules(self):
        """Retrieves currently configured filtered stream rules."""
        url = f"{X_API_BASE}/tweets/search/stream/rules"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        return self._execute_request(req)["body"]

    def add_stream_rules(self, rules):
        """Adds rules to the filtered stream. rules: list of dicts with value and optional tag."""
        url = f"{X_API_BASE}/tweets/search/stream/rules"
        payload = json.dumps({"add": rules}).encode("utf-8")
        headers = self._headers()
        headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        return self._execute_request(req)["body"]

    def delete_stream_rules(self, rule_ids):
        """Deletes stream rules by rule IDs."""
        url = f"{X_API_BASE}/tweets/search/stream/rules"
        payload = json.dumps({"delete": {"ids": rule_ids}}).encode("utf-8")
        headers = self._headers()
        headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        return self._execute_request(req)["body"]

    # --- Filtered Stream Connection & Consumption ---

    def stream_filtered_tweets(self, tweet_fields="created_at,author_id,entities", stop_check=None):
        """
        Connects to the filtered stream and yields tweet events as parsed JSON.
        - tweet_fields: comma-separated additional fields
        - stop_check: optional callable returning True to request clean shutdown
        Yields dict for each tweet object received.
        """
        params = {"tweet.fields": tweet_fields}
        url = f"{X_API_BASE}/tweets/search/stream?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")

        try:
            with urllib.request.urlopen(req) as stream_resp:
                for line in stream_resp:
                    if stop_check and stop_check():
                        break
                    line_str = line.decode("utf-8").strip()
                    if not line_str:
                        # Keep-alive heartbeat signal
                        continue
                    try:
                        tweet_event = json.loads(line_str)
                        yield tweet_event
                    except json.JSONDecodeError:
                        continue
        except (KeyboardInterrupt, SystemExit):
            sys.stderr.write("Stream disconnect requested. Shutting down cleanly.\n")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise RateLimitError("Filtered stream rate limit reached.", status_code=429)
            elif e.code in (401, 403):
                raise AuthenticationError(f"Stream auth error ({e.code})", status_code=e.code)
            raise XAPIError(f"Stream error ({e.code})", status_code=e.code)


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
