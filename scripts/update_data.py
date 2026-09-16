"""Fetch public baseball tables; validate a whole snapshot before replacing it.

Python 3.12 standard library only. HTML is never published. No API key required.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from fractions import Fraction
from html.parser import HTMLParser
import json
import logging
import math
import os
from pathlib import Path
import re
import tempfile
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

ROOT = Path(__file__).resolve().parents[1]
JST = timezone(timedelta(hours=9))
SEASON = 2026
SEASON_GAMES = 143
PLAYER_ID = '2000051'
BASE = 'https://baseballdata.jp/'
URLS = {
    'average': BASE + 'ctop.html',
    'home_runs': BASE + 'chr.html',
    'rbi': BASE + 'cdaten.html',
    'nonqualified': BASE + 'cdrm.html',
    'standings': BASE + 'c/',
    'player': BASE + f'playerB/{PLAYER_ID}.html',
    'recent': BASE + f'playerB/{PLAYER_ID}S.html',
}
TEAM_ALIASES = {
    '阪神': ('阪神', '阪神タイガース', '神'),
    '巨人': ('巨人', '読売', '読売ジャイアンツ', '巨'),
    'DeNA': ('DENA', '横浜DENA', '横浜DENAベイスターズ', 'デ', 'D'),
    'ヤクルト': ('ヤクルト', '東京ヤクルト', '東京ヤクルトスワローズ', 'ヤ'),
    '中日': ('中日', '中日ドラゴンズ', '中'),
    '広島': ('広島', '広島東洋', '広島東洋カープ', '広'),
}
LOG = logging.getLogger('sato-triple-crown')


class DataError(ValueError):
    pass


def normal(s):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', str(s)))


def team_name(s):
    value = normal(s).upper()
    for name, aliases in TEAM_ALIASES.items():
        if value in aliases:
            return name
    raise DataError(f'Unknown Central League team: {s}')


def integer(s):
    text = normal(s).replace(',', '')
    if not re.fullmatch(r'\d+', text):
        raise DataError(f'Expected nonnegative integer: {s!r}')
    return int(text)


def number(s, nullable=False):
    if nullable and normal(s) in {'', '-', '--'}:
        return None
    try:
        value = float(normal(s))
    except ValueError as exc:
        raise DataError(f'Expected number: {s!r}') from exc
    if not math.isfinite(value) or value < 0:
        raise DataError(f'Invalid number: {s!r}')
    return value


class Tables(HTMLParser):
    """Small table parser retaining header cells and anchor hrefs."""
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.table = None
        self.row = None
        self.cell = None
        self.depth = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.depth += 1
            if self.depth == 1:
                self.table = []
        if self.depth != 1:
            return
        if tag == 'tr':
            self.row = []
        elif tag in {'td', 'th'} and self.row is not None:
            self.cell = {'text': '', 'links': [], 'header': tag == 'th'}
        elif tag == 'a' and self.cell is not None:
            href = dict(attrs).get('href')
            if href:
                self.cell['links'].append(href)

    def handle_data(self, data):
        if self.cell is not None and self.depth == 1:
            self.cell['text'] += data

    def handle_endtag(self, tag):
        if self.depth == 1:
            if tag in {'td', 'th'} and self.cell is not None:
                self.cell['text'] = re.sub(r'\s+', ' ', self.cell['text']).strip()
                self.row.append(self.cell)
                self.cell = None
            elif tag == 'tr' and self.row is not None:
                self.table.append(self.row)
                self.row = None
            elif tag == 'table':
                self.tables.append(self.table)
                self.table = self.row = self.cell = None
        if tag == 'table':
            self.depth -= 1


def find_table(html, required):
    required = {normal(x) for x in required}
    for table in Tables(html).tables:
        for idx, row in enumerate(table):
            headers = [normal(c['text']) for c in row]
            if required <= set(headers):
                return headers, table[idx + 1:]
    raise DataError(f'Missing table columns: {sorted(required)}')


def row_dict(headers, cells):
    if len(cells) != len(headers):
        return None
    result = {}
    for idx, (key, cell) in enumerate(zip(headers, cells)):
        key = key or f'_col{idx}'
        value = cell['text']
        if key in result and normal(result[key]) != normal(value):
            raise DataError(f'Conflicting repeated column: {key}')
        result[key] = value
    return result


def statistics(row):
    fields = {'games': '試合', 'pa': '打席', 'ab': '打数', 'hits': '安打',
              'hr': '本塁打', 'rbi': '打点', 'walks': '四球', 'hbp': '死球',
              'strikeouts': '三振', 'doubles': '二塁打', 'triples': '三塁打'}
    stats = {key: integer(row[column]) for key, column in fields.items()}
    stats.update({key: number(row[column]) for key, column in
                  {'obp': '出塁率', 'slg': '長打率', 'ops': 'OPS'}.items()})
    stats['avg'] = stats['hits'] / stats['ab'] if stats['ab'] else 0
    stats['recent5_avg'] = number(row.get('最近5試合', ''), nullable=True)
    if stats['hits'] > stats['ab'] or stats['ab'] > stats['pa'] or stats['hr'] > stats['hits']:
        raise DataError('Impossible batting totals')
    if abs(number(row['打率']) - stats['avg']) > 0.000501:
        raise DataError('Batting average does not match hits / at bats')
    return stats


def parse_ranking(html, special_cutoff=None, teams=None):
    headers, rows = find_table(html, ['球団', '打率', '打数', '打席', '安打', '本塁打', '打点'])
    players = []
    seen = set()
    for cells in rows:
        row = row_dict(headers, cells)
        if not row:
            continue
        links = [href for c in cells for href in c['links']]
        matches = [re.search(r'(?:^|/)playerB/(\d+)\.html$', href) for href in links]
        player_id = next((m.group(1) for m in matches if m), None)
        if not player_id:
            continue
        player = {'id': player_id, 'name': row.get('選手名', row.get('選手')),
                  'team': team_name(row['球団']), **statistics(row)}
        if special_cutoff is not None:
            deficit = max(0, teams[player['team']]['qualification_pa'] - player['pa'])
            adjusted_ab = player['ab'] + deficit
            if not deficit or not adjusted_ab or Fraction(player['hits'], adjusted_ab) < special_cutoff:
                continue
        if player_id in seen:
            raise DataError('Duplicate player in ranking')
        seen.add(player_id)
        players.append(player)
    if not players and special_cutoff is None:
        raise DataError('No players found')
    return players


def parse_player(html):
    if not re.search(r'佐藤\s*輝明', html):
        raise DataError('Unexpected player detail page')
    headers, rows = find_table(html, ['打率', '打席', '打数', '安打', '本塁打', '打点'])
    for cells in rows:
        if cells and normal(cells[0]['text']) == '通算':
            row = row_dict(headers, cells)
            if row:
                return {'id': PLAYER_ID, 'name': '佐藤 輝明', 'team': '阪神', **statistics(row)}
    raise DataError('Season total missing from player detail')


def parse_standings(html):
    headers, rows = find_table(html, ['球団', '試', '勝', '敗', '分'])
    teams = {}
    for cells in rows:
        row = row_dict(headers, cells)
        if not row or not row.get('球団'):
            continue
        try:
            team = team_name(row['球団'])
        except DataError:
            continue
        if team in teams:
            raise DataError('Duplicate team in standings')
        games = integer(row['試'])
        if games != sum(integer(row[x]) for x in ['勝', '敗', '分']) or not 0 <= games <= SEASON_GAMES:
            raise DataError('Invalid team games played')
        teams[team] = {'games': games, 'remaining': SEASON_GAMES - games,
                       'qualification_pa': (games * 31 + 5) // 10}
    if len(teams) != 6:
        raise DataError('Incomplete Central League standings')
    return teams


def parse_recent(html):
    headers, rows = find_table(html, ['月日', '打数', '安', '本', '打点', '四死'])
    games = []
    for cells in rows:
        if not cells or not re.fullmatch(r'\d{2}/\d{2}', normal(cells[0]['text'])):
            continue
        row = row_dict(headers, cells)
        if not row:
            raise DataError('Game row structure changed')
        date = datetime.strptime(f'{SEASON}/{normal(row["月日"])}', '%Y/%m/%d').date().isoformat()
        item = {'date': date, 'opponent': row.get('対', ''), 'ab': integer(row['打数']),
                'hits': integer(row['安']), 'hr': integer(row['本']), 'rbi': integer(row['打点']),
                'walks_hbp': integer(row['四死']), 'strikeouts': integer(row['三振'])}
        if item['hits'] > item['ab'] or item['hr'] > item['hits']:
            raise DataError('Impossible game totals')
        games.append(item)
    if not games:
        raise DataError('No game log found')
    games.sort(key=lambda x: x['date'], reverse=True)
    return games


def aggregate(games, count):
    part = games[:count]
    stats = {key: sum(x[key] for x in part) for key in ['ab', 'hits', 'hr', 'rbi']}
    stats['games'] = len(part)
    stats['avg'] = stats['hits'] / stats['ab'] if stats['ab'] else None
    return stats


def ranked(players, metric):
    def value(p):
        if metric == 'avg':
            return Fraction(p['hits'], p.get('ranking_ab', p['ab'])) if p.get('ranking_ab', p['ab']) else Fraction(0)
        return p[metric]
    ordered = sorted(players, key=lambda p: (-value(p), p['id']))
    last = None
    rank = 0
    result = []
    for index, player in enumerate(ordered):
        v = value(player)
        if v != last:
            rank = index + 1
        result.append({**player, 'rank': rank, 'value': float(v)})
        last = v
    return result


def source_updated(html, optional=False):
    match = re.search(r'(?:最終更新|Last\s+Update)\s*[:：]\s*(\d{4}/\d{2}/\d{2})\s+(\d{1,2}:\d{2}:\d{2})', html, re.I)
    if not match:
        if optional:
            return None
        raise DataError('Source update timestamp missing')
    return datetime.strptime(' '.join(match.groups()), '%Y/%m/%d %H:%M:%S').replace(tzinfo=JST).isoformat()


def build_payload(pages, mode='manual'):
    for key, html in pages.items():
        title = re.search(r'<title[^>]*>(.*?)</title>', html, re.S | re.I)
        if not title or str(SEASON) not in title.group(1):
            raise DataError(f'Unexpected season in {key}')
    teams = parse_standings(pages['standings'])
    sato = parse_player(pages['player'])
    logs = parse_recent(pages['recent'])
    parsed = {key: parse_ranking(pages[key]) for key in ['average', 'home_runs', 'rbi']}
    qualified_top = max(Fraction(p['hits'], p['ab']) for p in parsed['average'])
    parsed['nonqualified'] = parse_ranking(pages['nonqualified'], qualified_top, teams)
    registry = {}
    for players in parsed.values():
        for player in players:
            old = registry.get(player['id'])
            if old and any(old[key] != player[key] for key in ['ab', 'pa', 'hits', 'hr', 'rbi', 'games']):
                raise DataError('Source pages disagree; preserve previous consistent snapshot')
            registry[player['id']] = player
    if sato['id'] not in registry:
        raise DataError('Target player absent from all rankings')
    for key in ['ab', 'pa', 'hits', 'hr', 'rbi', 'games']:
        if registry[sato['id']][key] != sato[key]:
            raise DataError('Player detail and rankings disagree')
    sato['recent5_avg'] = aggregate(logs, 5)['avg']
    registry[sato['id']] = sato
    for player in registry.values():
        team = teams[player['team']]
        player['team_games'] = team['games']
        player['team_remaining'] = team['remaining']
        player['qualified'] = player['pa'] >= team['qualification_pa']
        if player['games'] > team['games']:
            raise DataError('Player games exceed team games')
    # Prevent a newly refreshed season line being combined with yesterday's log.
    if any(sum(g[k] for g in logs) != sato[k] for k in ['ab', 'hits', 'hr', 'rbi']):
        raise DataError('Season totals and complete game log disagree')
    average = []
    for player in registry.values():
        if player['qualified'] and player['ab'] > 0:
            average.append({**player, 'ranking_ab': player['ab'], 'special_rule': False})
    if not average:
        raise DataError('No qualified batters')
    top = max(Fraction(p['hits'], p['ab']) for p in average)
    # Also account for a non-qualified batter whose deficit-adjusted AVG leads.
    for player in registry.values():
        deficit = max(0, teams[player['team']]['qualification_pa'] - player['pa'])
        adjusted_ab = player['ab'] + deficit
        if deficit and adjusted_ab and Fraction(player['hits'], adjusted_ab) >= top:
            average.append({**player, 'ranking_ab': adjusted_ab, 'special_rule': True})
    boards = {'avg': ranked(average, 'avg'),
              'hr': ranked(list(registry.values()), 'hr'),
              'rbi': ranked(list(registry.values()), 'rbi')}
    races = {}
    for metric, rows in boards.items():
        target = next((p for p in rows if p['id'] == PLAYER_ID), None)
        rivals = [p for p in rows if p['id'] != PLAYER_ID]
        if not rivals:
            raise DataError('No competitors available')
        best_other = rivals[0]
        tied = bool(target and target['rank'] == 1 and best_other['rank'] == 1)
        margin = (target['value'] if target else sato[metric]) - best_other['value']
        races[metric] = {'rank': target['rank'] if target else None,
                         'is_leading': bool(target and target['rank'] == 1), 'tied': tied,
                         'margin': margin, 'best_other_id': best_other['id'],
                         'qualified': sato['qualified'],
                         'special_rule': bool(target and target.get('special_rule'))}
    timestamps = {key: source_updated(html, optional=key == 'player') for key, html in pages.items()}
    known_timestamps = [value for value in timestamps.values() if value]
    if any(not value.startswith(str(SEASON)) for value in known_timestamps):
        raise DataError('Source timestamps are from another season')
    # Yearless live URLs must never silently become next year's data.
    now = datetime.now(JST).isoformat(timespec='seconds')
    return {'schema_version': 1, 'season': SEASON, 'season_games': SEASON_GAMES,
            'fetched_at': now, 'source_updated_at': min(known_timestamps),
            'data_through': logs[0]['date'], 'mode': mode,
            'source': {'name': 'baseballdata.jp', 'urls': URLS, 'page_updated_at': timestamps},
            'player': registry[PLAYER_ID], 'teams': teams, 'races': races,
            'leading_categories': sum(r['is_leading'] for r in races.values()),
            'rankings': {k: rows[:12] + ([next(p for p in rows if p['id'] == PLAYER_ID)]
                if any(p['id'] == PLAYER_ID for p in rows[12:]) else []) for k, rows in boards.items()},
            'contenders': {'avg': boards['avg'], 'hr': boards['hr'], 'rbi': boards['rbi']},
            'recent': {'last5': aggregate(logs, 5), 'last10': aggregate(logs, 10), 'games': logs[:10]},
            'schedule_jst': ['06:10', '17:10', '21:10', '21:40', '22:40', '23:40', '翌01:10'],
            'season_complete': all(t['remaining'] == 0 for t in teams.values())}


def download(url, user_agent, retries=True):
    if urlparse(url).hostname != 'baseballdata.jp' or urlparse(url).scheme != 'https':
        raise DataError('Only the configured HTTPS source is allowed')
    for attempt in range(2 if retries else 1):
        try:
            request = Request(url, headers={'User-Agent': user_agent, 'Accept': 'text/html,text/plain'})
            with urlopen(request, timeout=30) as response:
                if urlparse(response.url).hostname != 'baseballdata.jp':
                    raise DataError('Unexpected redirect host')
                content = response.read(4_000_001)
                if len(content) > 4_000_000:
                    raise DataError('Source exceeds expected size')
                return content.decode('utf-8-sig')
        except HTTPError as exc:
            if exc.code in {401, 403, 404, 429} or attempt == (1 if retries else 0):
                raise
        except (URLError, TimeoutError):
            if attempt == (1 if retries else 0):
                raise
        time.sleep(3)
    raise DataError('Source download failed')


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.sato-', suffix='.json', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def update(output=ROOT / 'dist', mode='manual', fixture_dir=None):
    attempted = datetime.now(JST).isoformat(timespec='seconds')
    if os.getenv('SCRAPING_ENABLED', 'true').lower() in {'false', '0', 'off'}:
        atomic_json(output / 'fetch-status.json', {'status': 'disabled', 'attempted_at': attempted, 'mode': mode})
        return
    try:
        if fixture_dir:
            aliases = {'home_runs': 'home-runs'}
            pages = {key: (Path(fixture_dir) / (aliases.get(key, key) + '.html')).read_text(encoding='utf-8-sig') for key in URLS}
        else:
            repository = os.getenv('GITHUB_REPOSITORY')
            contact = f'https://github.com/{repository}' if repository else 'noncommercial-statistics-dashboard'
            agent = os.getenv('SATO_USER_AGENT', f'SatoTripleCrown/1.0 (+{contact})')
            robots = RobotFileParser()
            robots.parse(download(BASE + 'robots.txt', agent, retries=False).splitlines())
            for url in URLS.values():
                if not robots.can_fetch(agent, url):
                    raise DataError('Source robots policy disallows a required page')
            pages = {}
            for key, url in URLS.items():
                LOG.info('Fetching %s', url)
                pages[key] = download(url, agent)
                time.sleep(0.7)
        payload = build_payload(pages, mode)
        old_path = output / 'data.json'
        if old_path.exists():
            old = json.loads(old_path.read_text())
            if payload['source_updated_at'] < old.get('source_updated_at', ''):
                raise DataError('Source snapshot regressed in time')
        atomic_json(old_path, payload)
        atomic_json(output / 'fetch-status.json', {'status': 'ok', 'attempted_at': attempted,
                    'last_success_at': payload['fetched_at'], 'mode': mode})
        LOG.info('Snapshot saved: AVG %.6f / HR %s / RBI %s; leading %s categories',
                 payload['player']['avg'], payload['player']['hr'], payload['player']['rbi'], payload['leading_categories'])
    except Exception as exc:
        atomic_json(output / 'fetch-status.json', {'status': 'error', 'attempted_at': attempted,
                    'error_type': type(exc).__name__, 'mode': mode})
        LOG.exception('Update failed; previous data.json retained')
        raise


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    parser.add_argument('--mode', choices=['preview', 'manual', 'scheduled'], default='manual')
    parser.add_argument('--fixture-dir', type=Path)
    args = parser.parse_args()
    update(args.output, args.mode, args.fixture_dir)
