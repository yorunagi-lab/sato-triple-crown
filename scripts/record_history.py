"""Keep the latest successful observation per JST day; never invent past rivals."""
import json
import math
from datetime import datetime
from pathlib import Path

try:
    from .update_data import atomic_json, JST, SEASON, PLAYER_ID, DataError
except ImportError:
    from update_data import atomic_json, JST, SEASON, PLAYER_ID, DataError

ROOT = Path(__file__).resolve().parents[1]
METRICS = ('avg', 'hr', 'rbi')


def timestamp(value):
    result = datetime.fromisoformat(value)
    if result.tzinfo is None:
        raise DataError('History timestamps require a timezone')
    return result


def validate_history(history, season):
    if history.get('schema_version') != 1 or history.get('season') != season or not isinstance(history.get('days'), list):
        raise DataError('Invalid history format; existing history preserved')
    timestamp(history['started_at'])
    previous = ''
    for day in history['days']:
        date = datetime.strptime(day['date'], '%Y-%m-%d')
        if date.year != season or day['date'] <= previous:
            raise DataError('Invalid history order')
        timestamp(day['recorded_at'])
        timestamp(day['source_updated_at'])
        for key in METRICS:
            if not all(math.isfinite(v) for v in (day['values'][key], day['races'][key]['margin'], day['races'][key]['rival_value'])):
                raise DataError('Invalid history value')
        previous = day['date']


def record(output=ROOT / 'dist'):
    data = json.loads((output / 'data.json').read_text())
    status = json.loads((output / 'fetch-status.json').read_text())
    if status.get('status') != 'ok' or status.get('last_success_at') != data['fetched_at']:
        return False  # Failed or disabled fetches cannot masquerade as new observations.
    observed = timestamp(data['fetched_at'])
    source = timestamp(data['source_updated_at'])
    if data['season'] != SEASON or data['player']['id'] != PLAYER_ID or observed.astimezone(JST).year != SEASON:
        raise DataError('Unexpected history season or player')
    if source > observed:
        raise DataError('History source timestamp exceeds observation')
    file = output / 'history.json'
    history = json.loads(file.read_text()) if file.exists() else {
        'schema_version': 1, 'season': SEASON, 'started_at': data['fetched_at'], 'days': []}
    validate_history(history, SEASON)
    if history['days']:
        latest = history['days'][-1]
        if observed < timestamp(latest['recorded_at']) or source < timestamp(latest['source_updated_at']):
            raise DataError('History regression refused')
    entry = {'date': observed.astimezone(JST).date().isoformat(), 'recorded_at': data['fetched_at'],
             'source_updated_at': data['source_updated_at'], 'data_through': data['data_through'],
             'values': {}, 'races': {}}
    for key in METRICS:
        race = data['races'][key]
        rival = next(p for p in data['contenders'][key] if p['id'] == race['best_other_id'])
        entry['values'][key] = data['player'][key]
        entry['races'][key] = {'margin': race['margin'], 'rank': race['rank'], 'rival_id': rival['id'],
                              'rival_name': rival['name'], 'rival_value': rival['value']}
    history['days'] = [day for day in history['days'] if day['date'] != entry['date']] + [entry]
    validate_history(history, SEASON)
    atomic_json(file, history)
    print(f"Saved {len(history['days'])} daily race observations through {entry['date']}")
    return True


if __name__ == '__main__':
    record()
