import unittest
from datetime import date

import pandas as pd

from logbook_core.pricing import lookup_latest_rate
from logbook_core.config import NAV_ITEMS


class PricingHistoryTests(unittest.TestCase):
    def setUp(self):
        self.rates = pd.DataFrame([
            {"id": 1, "registration": "OK-DAS", "aircraft_type": "B23", "valid_from": "2025-01-01", "price_per_hour": 2900.0, "source": "legacy"},
            {"id": 2, "registration": "OK-DAS", "aircraft_type": "B23", "valid_from": "2026-01-01", "price_per_hour": 3200.0, "source": "aircraft_history"},
            {"id": 3, "registration": "OK-DAS", "aircraft_type": "B23", "valid_from": "2027-01-01", "price_per_hour": 3500.0, "source": "aircraft_profile"},
        ])

    def test_rate_is_date_effective(self):
        self.assertEqual(lookup_latest_rate(self.rates, "ok-das", date(2025, 6, 1))["price_per_hour"], 2900.0)
        self.assertEqual(lookup_latest_rate(self.rates, "OK-DAS", date(2026, 8, 20))["price_per_hour"], 3200.0)
        self.assertEqual(lookup_latest_rate(self.rates, "OK-DAS", date(2027, 2, 1))["price_per_hour"], 3500.0)

    def test_future_rate_does_not_leak_into_current_date(self):
        rate = lookup_latest_rate(self.rates, "OK-DAS", date(2026, 12, 31))
        self.assertEqual(rate["price_per_hour"], 3200.0)

    def test_pricing_is_not_a_top_level_page(self):
        self.assertNotIn(("Ceník", "Ceník"), NAV_ITEMS)


if __name__ == "__main__":
    unittest.main()
