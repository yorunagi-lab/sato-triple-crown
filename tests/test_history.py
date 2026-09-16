import copy
import json
import tempfile
import unittest
from pathlib import Path
from scripts.record_history import record
from scripts.update_data import DataError, atomic_json

SNAPSHOT = json.loads((Path(__file__).resolve().parents[1] / 'dist/data.json').read_text())


class HistoryTests(unittest.TestCase):
    def write_snapshot(self, root, observed, source='2026-09-16T22:28:05+09:00', status='ok'):
        data = copy.deepcopy(SNAPSHOT)
        data['fetched_at'] = observed
        data['source_updated_at'] = source
        atomic_json(root / 'data.json', data)
        atomic_json(root / 'fetch-status.json', {'status': status, 'last_success_at': observed})

    def test_upsert_same_jst_day_then_append_next_day(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.write_snapshot(root, '2026-09-17T00:10:00+09:00')
            record(root)
            self.write_snapshot(root, '2026-09-17T22:40:00+09:00')
            record(root)
            data = json.loads((root / 'history.json').read_text())
            self.assertEqual(len(data['days']), 1)
            self.assertEqual(data['started_at'], '2026-09-17T00:10:00+09:00')
            self.assertEqual(data['days'][0]['recorded_at'], '2026-09-17T22:40:00+09:00')
            # UTC Sept 17 evening is the next calendar day in Japan.
            self.write_snapshot(root, '2026-09-17T16:10:00+00:00')
            record(root)
            data = json.loads((root / 'history.json').read_text())
            self.assertEqual([p['date'] for p in data['days']], ['2026-09-17', '2026-09-18'])
            self.assertEqual(data['days'][-1]['races']['hr']['margin'], SNAPSHOT['races']['hr']['margin'])

    def test_failed_or_disabled_fetch_never_adds_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.write_snapshot(root, '2026-09-17T00:10:00+09:00')
            record(root)
            original = (root / 'history.json').read_bytes()
            for status in ('error', 'disabled'):
                self.write_snapshot(root, '2026-09-18T00:10:00+09:00', status=status)
                self.assertFalse(record(root))
                self.assertEqual((root / 'history.json').read_bytes(), original)

    def test_timestamp_regression_keeps_previous_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.write_snapshot(root, '2026-09-17T00:10:00+09:00')
            record(root)
            original = (root / 'history.json').read_bytes()
            self.write_snapshot(root, '2026-09-18T00:10:00+09:00', source='2026-09-15T22:28:05+09:00')
            with self.assertRaises(DataError):
                record(root)
            self.assertEqual((root / 'history.json').read_bytes(), original)

    def test_corrupted_history_is_never_silently_reset(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.write_snapshot(root, '2026-09-17T00:10:00+09:00')
            (root / 'history.json').write_text('{broken')
            with self.assertRaises(json.JSONDecodeError):
                record(root)
            self.assertEqual((root / 'history.json').read_text(), '{broken')


if __name__ == '__main__':
    unittest.main()
