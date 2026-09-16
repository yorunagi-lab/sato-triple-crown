import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from scripts.update_data import DataError, PLAYER_ID, Tables, atomic_json, ranked, source_updated, update, parse_standings, parse_ranking


class DataTests(unittest.TestCase):
    def test_exact_average_ranking_and_shared_rank(self):
        players = [{'id': 'a', 'hits': 100, 'ab': 300}, {'id': 'b', 'hits': 101, 'ab': 303}, {'id': 'c', 'hits': 100, 'ab': 301}]
        result = ranked(players, 'avg')
        self.assertEqual([p['rank'] for p in result], [1, 1, 3])
        self.assertEqual(result[-1]['id'], 'c')

    def test_count_rank_ties(self):
        result = ranked([{'id': 'a', 'hr': 35}, {'id': 'b', 'hr': 35}, {'id': 'c', 'hr': 33}], 'hr')
        self.assertEqual([p['rank'] for p in result], [1, 1, 3])

    def test_header_parser_preserves_link_ids(self):
        table = Tables('<table><tr><th>選手</th></tr><tr><td><a href="playerB/2000051.html">佐藤 <b>輝明</b></a></td></tr></table>').tables[0]
        self.assertEqual(table[1][0]['text'], '佐藤 輝明')
        self.assertEqual(table[1][0]['links'], ['playerB/2000051.html'])

    def test_missing_headers_fail_closed(self):
        with self.assertRaises(DataError):
            parse_ranking('<html>Maintenance</html>')

    def test_partial_standings_rejected(self):
        with self.assertRaises(DataError):
            parse_standings('<table><tr><th>球団</th><th>試</th><th>勝</th><th>敗</th><th>分</th></tr><tr><td>阪神</td><td>127</td><td>69</td><td>57</td><td>1</td></tr></table>')

    def test_failure_preserves_last_good_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            original = {'sentinel': 'last good'}
            atomic_json(root / 'data.json', original)
            with patch('scripts.update_data.download', side_effect=DataError('test source error')):
                with self.assertRaises(DataError):
                    update(root, 'scheduled')
            self.assertEqual(json.loads((root / 'data.json').read_text()), original)
            self.assertEqual(json.loads((root / 'fetch-status.json').read_text())['status'], 'error')

    def test_disabled_scraping_never_requests_network(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict('os.environ', {'SCRAPING_ENABLED': 'false'}), patch('scripts.update_data.download') as fetch:
            update(Path(tmp), 'scheduled')
            fetch.assert_not_called()
            self.assertEqual(json.loads((Path(tmp) / 'fetch-status.json').read_text())['status'], 'disabled')

    def test_update_timestamp_formats(self):
        self.assertEqual(source_updated('最終更新:2026/09/16 03:49:19'), '2026-09-16T03:49:19+09:00')
        self.assertEqual(source_updated('Last Update:2026/09/16 6:13:59'), '2026-09-16T06:13:59+09:00')
        self.assertIsNone(source_updated('no timestamp', optional=True))
        with self.assertRaises(DataError):
            source_updated('no timestamp')


if __name__ == '__main__':
    unittest.main()
