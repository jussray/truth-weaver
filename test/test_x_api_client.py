#!/usr/bin/env python3
"""
Unit tests for Truth Weaver Python XDK Client (scripts/x_api_client.py)
Validates pagination, rate limits, authentication failures, rule configuration,
and filtered stream processing without making any live network calls.
"""

import io
import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch
import urllib.error

# Ensure scripts directory is on PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts")))
from x_api_client import (
    XDKClient,
    AuthenticationError,
    RateLimitError,
    XAPIError,
)


class TestXDKClientAuth(unittest.TestCase):
    def test_missing_token_raises_authentication_error(self):
        client = XDKClient(bearer_token=None)
        with patch.dict(os.environ, {}, clear=True):
            client.bearer_token = None
            with self.assertRaises(AuthenticationError) as ctx:
                client.search_recent_tweets("legal notice")
            self.assertIn("AUTHENTICATION_REQUIRED", str(ctx.exception))

    @patch("urllib.request.urlopen")
    def test_http_401_raises_authentication_error(self, mock_urlopen):
        err = urllib.error.HTTPError(
            url="https://api.x.com/2/tweets/search/recent",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=io.BytesIO(b'{"errors":[{"message":"Unauthorized"}]}'),
        )
        mock_urlopen.side_effect = err

        client = XDKClient(bearer_token="mock_invalid_token")
        with self.assertRaises(AuthenticationError) as ctx:
            client.search_recent_tweets("eviction")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Unauthorized", str(ctx.exception))

    @patch("urllib.request.urlopen")
    def test_http_403_raises_authentication_error(self, mock_urlopen):
        err = urllib.error.HTTPError(
            url="https://api.x.com/2/tweets/search/recent",
            code=403,
            msg="Forbidden",
            hdrs={},
            fp=io.BytesIO(b'{"title":"Forbidden","detail":"Client not allowed."}'),
        )
        mock_urlopen.side_effect = err

        client = XDKClient(bearer_token="mock_forbidden_token")
        with self.assertRaises(AuthenticationError) as ctx:
            client.search_recent_tweets("housing")
        self.assertEqual(ctx.exception.status_code, 403)


class TestXDKClientRateLimits(unittest.TestCase):
    @patch("urllib.request.urlopen")
    def test_http_429_raises_rate_limit_error_with_reset_header(self, mock_urlopen):
        headers = {
            "x-rate-limit-reset": "1731456000",
            "x-rate-limit-remaining": "0",
        }
        err = urllib.error.HTTPError(
            url="https://api.x.com/2/tweets/search/recent",
            code=429,
            msg="Too Many Requests",
            hdrs=headers,
            fp=io.BytesIO(b'{"title":"Too Many Requests","detail":"Rate limit exceeded"}'),
        )
        mock_urlopen.side_effect = err

        client = XDKClient(bearer_token="mock_valid_token")
        with self.assertRaises(RateLimitError) as ctx:
            client.search_recent_tweets("debt defense")

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(ctx.exception.reset_time, 1731456000)
        self.assertEqual(ctx.exception.remaining, "0")


class TestXDKClientPagination(unittest.TestCase):
    @patch("urllib.request.urlopen")
    def test_pagination_fetches_multiple_pages_and_stops_on_next_token(self, mock_urlopen):
        page_1 = {
            "data": [{"id": "1", "text": "Notice 1"}, {"id": "2", "text": "Notice 2"}],
            "meta": {"next_token": "token_page_2", "result_count": 2},
        }
        page_2 = {
            "data": [{"id": "3", "text": "Notice 3"}, {"id": "4", "text": "Notice 4"}],
            "meta": {"result_count": 2},
        }

        mock_resp_1 = MagicMock()
        mock_resp_1.status = 200
        mock_resp_1.read.return_value = json.dumps(page_1).encode("utf-8")
        mock_resp_1.headers = {}
        mock_resp_1.__enter__.return_value = mock_resp_1

        mock_resp_2 = MagicMock()
        mock_resp_2.status = 200
        mock_resp_2.read.return_value = json.dumps(page_2).encode("utf-8")
        mock_resp_2.headers = {}
        mock_resp_2.__enter__.return_value = mock_resp_2

        mock_urlopen.side_effect = [mock_resp_1, mock_resp_2]

        client = XDKClient(bearer_token="mock_valid_token")
        results = client.paginate_search("foreclosure", total_needed=4)

        self.assertEqual(len(results), 4)
        self.assertEqual([t["id"] for t in results], ["1", "2", "3", "4"])
        self.assertEqual(mock_urlopen.call_count, 2)

    @patch("urllib.request.urlopen")
    def test_pagination_truncates_at_total_needed(self, mock_urlopen):
        page_1 = {
            "data": [{"id": f"{i}", "text": f"Tweet {i}"} for i in range(10)],
            "meta": {"next_token": "token_2"},
        }
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(page_1).encode("utf-8")
        mock_resp.headers = {}
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        client = XDKClient(bearer_token="mock_valid_token")
        results = client.paginate_search("legal query", total_needed=5)

        self.assertEqual(len(results), 5)


class TestXDKClientStreamRules(unittest.TestCase):
    @patch("urllib.request.urlopen")
    def test_get_stream_rules(self, mock_urlopen):
        mock_payload = {
            "data": [
                {"id": "101", "value": "eviction notice", "tag": "housing"},
                {"id": "102", "value": "debt lawsuit", "tag": "debt"},
            ],
            "meta": {"sent": "2026-11-13T00:00:00Z"},
        }
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(mock_payload).encode("utf-8")
        mock_resp.headers = {}
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        client = XDKClient(bearer_token="mock_token")
        rules = client.get_stream_rules()

        self.assertEqual(len(rules["data"]), 2)
        self.assertEqual(rules["data"][0]["tag"], "housing")

    @patch("urllib.request.urlopen")
    def test_add_stream_rules(self, mock_urlopen):
        mock_payload = {
            "data": [{"id": "103", "value": "foreclosure", "tag": "real-estate"}],
            "meta": {"summary": {"created": 1, "not_created": 0, "valid": 1, "invalid": 0}},
        }
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_resp.read.return_value = json.dumps(mock_payload).encode("utf-8")
        mock_resp.headers = {}
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        client = XDKClient(bearer_token="mock_token")
        res = client.add_stream_rules([{"value": "foreclosure", "tag": "real-estate"}])

        self.assertEqual(res["meta"]["summary"]["created"], 1)

    @patch("urllib.request.urlopen")
    def test_delete_stream_rules(self, mock_urlopen):
        mock_payload = {
            "meta": {"summary": {"deleted": 1, "not_deleted": 0}},
        }
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(mock_payload).encode("utf-8")
        mock_resp.headers = {}
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        client = XDKClient(bearer_token="mock_token")
        res = client.delete_stream_rules(["103"])

        self.assertEqual(res["meta"]["summary"]["deleted"], 1)


class TestXDKClientFilteredStream(unittest.TestCase):
    @patch("urllib.request.urlopen")
    def test_stream_filtered_tweets_yields_events_and_skips_heartbeats(self, mock_urlopen):
        stream_lines = [
            b"\r\n",  # Heartbeat signal
            b'{"data":{"id":"201","text":"Received eviction notice today."}}\r\n',
            b"",  # Empty heartbeat
            b'{"data":{"id":"202","text":"Unlawful detainer hearing next week."}}\r\n',
        ]

        mock_stream = MagicMock()
        mock_stream.__iter__.return_value = iter(stream_lines)
        mock_stream.__enter__.return_value = mock_stream
        mock_urlopen.return_value = mock_stream

        client = XDKClient(bearer_token="mock_token")
        tweets = list(client.stream_filtered_tweets())

        self.assertEqual(len(tweets), 2)
        self.assertEqual(tweets[0]["data"]["id"], "201")
        self.assertEqual(tweets[1]["data"]["id"], "202")

    @patch("urllib.request.urlopen")
    def test_stream_filtered_tweets_clean_shutdown_on_stop_check(self, mock_urlopen):
        stream_lines = [
            b'{"data":{"id":"301","text":"First tweet"}}\r\n',
            b'{"data":{"id":"302","text":"Second tweet"}}\r\n',
            b'{"data":{"id":"303","text":"Third tweet"}}\r\n',
        ]

        mock_stream = MagicMock()
        mock_stream.__iter__.return_value = iter(stream_lines)
        mock_stream.__enter__.return_value = mock_stream
        mock_urlopen.return_value = mock_stream

        client = XDKClient(bearer_token="mock_token")

        count = 0
        def stop_after_one():
            return count >= 1

        collected = []
        for tweet in client.stream_filtered_tweets(stop_check=stop_after_one):
            collected.append(tweet)
            count += 1

        self.assertEqual(len(collected), 1)
        self.assertEqual(collected[0]["data"]["id"], "301")


if __name__ == "__main__":
    unittest.main()
