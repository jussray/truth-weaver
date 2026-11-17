import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Ensure scripts directory is on PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts")))

from x_lead_triage import (
    classify_text,
    build_triage_item,
    run_triage,
    DEFAULT_SEARCH_QUERY,
)
from x_api_client import RateLimitError, AuthenticationError


class TestXLeadTriage(unittest.TestCase):
    def test_classify_housing_urgent(self):
        text = "Got an eviction notice pinned to my apartment door today."
        cats = classify_text(text)
        self.assertIn("housing_urgent", cats)

    def test_classify_debt_defense(self):
        text = "Midland credit filed a summons and complaint debt collection lawsuit against me."
        cats = classify_text(text)
        self.assertIn("debt_defense", cats)

    def test_classify_legal_demand(self):
        text = "Received a formal demand letter from an attorney claiming copyright infringement."
        cats = classify_text(text)
        self.assertIn("legal_demand", cats)

    def test_classify_general_fallback(self):
        text = "Has anyone ever had to go to small claims court?"
        cats = classify_text(text)
        self.assertEqual(cats, ["general_legal_inquiry"])

    def test_build_triage_item_pins_alleged_fact(self):
        raw_tweet = {
            "id": "1234567890",
            "text": "Notice to vacate received today.",
            "author_id": "author_1",
            "created_at": "2026-11-17T12:00:00Z",
        }
        item = build_triage_item(raw_tweet)
        self.assertEqual(item["lead_id"], "x_1234567890")
        self.assertEqual(item["epistemic_status"], "ALLEGED_FACT")
        self.assertFalse(item["verified"])
        self.assertEqual(item["source_url"], "https://x.com/i/web/status/1234567890")
        self.assertIn("housing_urgent", item["categories"])

    def test_run_triage_dry_run(self):
        leads = run_triage(dry_run=True)
        self.assertEqual(len(leads), 2)
        self.assertEqual(leads[0]["lead_id"], "x_1990000000000000001")
        self.assertEqual(leads[0]["epistemic_status"], "ALLEGED_FACT")

    def test_run_triage_with_mock_client(self):
        mock_client = MagicMock()
        mock_client.bearer_token = "mock_token"
        mock_client.search_recent_tweets.return_value = {
            "data": [
                {
                    "id": "999",
                    "text": "Eviction notice 3-day pay or quit.",
                    "author_id": "user_x",
                    "created_at": "2026-11-17T15:00:00Z",
                }
            ]
        }
        leads = run_triage(client=mock_client, query="custom query", max_results=5)
        self.assertEqual(len(leads), 1)
        self.assertEqual(leads[0]["lead_id"], "x_999")
        mock_client.search_recent_tweets.assert_called_once_with(
            query="custom query", max_results=5
        )

    def test_run_triage_missing_token_raises_auth_error(self):
        mock_client = MagicMock()
        mock_client.bearer_token = None
        with self.assertRaises(AuthenticationError):
            run_triage(client=mock_client)


if __name__ == "__main__":
    unittest.main()
