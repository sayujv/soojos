"""Independent synthetic probes by Astra, not Claude's unrun 31-test suite."""
import unittest
from news_normalize_rev2 import normalize, visible_as_of

T = '2026-09-17T10:00:00Z'
def rec(**kw):
    d = dict(source='Reuters', title='Headline', published_at=T, ingested_at=T)
    d.update(kw)
    return d

class Review(unittest.TestCase):
    def test_happy_and_duplicate(self):
        r = normalize([rec(), rec()])
        self.assertEqual((len(r.items), len(r.duplicates), len(r.rejects)), (1, 1, 0))
    def test_legitimate_suffix_preserved(self):
        r = normalize([rec(title='Cloud - pricing', body='Body - pricing')])
        self.assertEqual((r.items[0].title_norm, r.items[0].body_norm), ('cloud - pricing', 'body - pricing'))
    def test_own_publisher_only(self):
        self.assertEqual(normalize([rec(title='Headline | Reuters')]).items[0].title_norm, 'headline')
        self.assertEqual(normalize([rec(title='Headline - Bloomberg')]).items[0].title_norm, 'headline - bloomberg')
    def test_no_early_visibility(self):
        r = normalize([rec(ingested_at='2026-09-17T10:00:00.999999Z')])
        self.assertEqual(visible_as_of(r.items, T), ())
        self.assertEqual(len(visible_as_of(r.items, '2026-09-17T10:00:00.999999Z')), 1)
    def test_malformed_class_isolated(self):
        for value in ([], {}):
            r = normalize([rec(source_class=value), rec()])
            self.assertEqual((len(r.rejects), len(r.items)), (1, 1))
    def test_body_tie_deterministic(self):
        a, b = rec(body='first'), rec(body='second')
        self.assertEqual(normalize([a,b]), normalize([b,a]))
    def test_ticker_encoding_collision(self):
        a, b = rec(tickers=['A,B']), rec(tickers=['A','B'])
        self.assertEqual(normalize([a,b]), normalize([b,a]))
    def test_malformed_unicode_isolated(self):
        r = normalize([rec(title='bad\ud800'), rec()])
        self.assertEqual((len(r.rejects), len(r.items)), (1,1))
    def test_extreme_timestamp_isolated(self):
        r = normalize([rec(published_at='9999-12-31T23:59:59Z', ingested_at='9999-12-31T23:59:59Z'), rec()])
        self.assertEqual((len(r.rejects), len(r.items)), (1,1))

if __name__ == '__main__':
    unittest.main()
