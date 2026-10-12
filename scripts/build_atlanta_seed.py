#!/usr/bin/env python3
"""
Builds the full Madden 27 Atlanta playbook seed from data/atlanta-plays.txt
(one play per line: Family|Formation|Play Name — 42 formations, 614 plays).

Play NAMES and FORMATIONS are real (from the published Atlanta playbook listing).
Everything else (play type, concept, schemes, best-vs, ratings) is AUTO-TAGGED from
the play name using football-concept rules below. Every play is marked is_seed = true
and noted "Auto-tagged" so you can verify and refine in Admin. Read progressions and
personnel are left blank on purpose — they are never guessed.

Outputs:
  supabase/migrations/002_seed.sql     (run in Supabase after 001_schema.sql)
  data/atlanta-playbook.csv            (same data in the Admin > Import template format)
"""
import csv, io, re, os
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'atlanta-plays.txt')

FAMILY_ORDER = ['Gun', 'Pistol', 'Singleback', 'I Form', 'Strong', 'Weak', 'Split Backs', 'Goal Line', 'Other']
UPPER = {'hb': 'HB', 'pa': 'PA', 'qb': 'QB', 'fb': 'FB', 'rpo': 'RPO', 'te': 'TE', 'wr': 'WR', 'rz': 'RZ'}

def norm_name(n: str) -> str:
    return ' '.join(UPPER.get(w.lower(), w) for w in n.split())

def has(n, *words):
    return any(re.search(r'(^|[\s-])' + re.escape(w) + r'($|[\s-])', n) for w in words)

def contains(n, *subs):
    return any(s in n for s in subs)

RUN_WORDS = ['dive', 'counter', 'power', 'toss', 'stretch', 'trap', 'duo', 'sneak', 'draw', 'base', 'iso', 'sweep',
             'scissors', 'sting', 'gut', 'blast', 'slam', 'punch', 'wrap', 'mike', 'will', 'zone', 'split o',
             'off tackle', 'power o', 'touch pass', 'jet pass', 'inside', 'hb option', 'speed option', 'read option']
OUTSIDE = ['toss', 'stretch', 'sweep', 'outside zone', 'wide zone', 'same side zone', 'touch pass', 'jet pass', 'off tackle', 'speed option', 'pitch']
DEEP = ['post', 'shot', 'verticals', 'vert', 'go', 'seam', 'n go', 'sluggo', 'wheel', 'deep', 'corner', 'soar', 'divide', 'up']

def classify(family, formation, raw):
    name = norm_name(raw)
    n = raw.lower()
    t = dict(play_type='Pass', concept=None, primary=None, secondary=[], tags=[], screen_type=None, run_concept=None,
             pass_concept=None, rpo_type=None, play_action=False, best=[], weak=[], blitz=False, man=False, zone=False,
             r=[3, 3, 3, 3, 3, 3, 3], risk=2, expl=2)

    def ratings(s, m, l, rz, gl, tm, fm):
        t['r'] = [s, m, l, rz, gl, tm, fm]

    is_rpo = has(n, 'rpo') or contains(n, 'alert')
    is_screen = 'screen' in n
    is_pa = has(n, 'pa') or has(n, 'boot') or 'waggle' in n
    is_option_run = contains(n, 'read option', 'speed option') or n == 'hb option'
    is_run_name = (re.match(r'^\d\d (mike|will)$', n) is not None) or contains(n, '01 trap') or (
        not is_rpo and not is_screen and not is_pa and (
            is_option_run or any(has(n, w) for w in ['dive', 'counter', 'power', 'toss', 'stretch', 'trap', 'duo', 'sneak',
                'draw', 'base', 'iso', 'sweep', 'scissors', 'sting', 'gut', 'blast', 'slam', 'punch', 'wrap', 'split o',
                'zone', 'off tackle', 'power o', 'touch pass', 'jet pass', 'spinner hb inside', 'zone fake jet'])
            or contains(n, 'zone wk', 'zone fake jet', 'touch pass', 'jet pass', 'spinner hb inside', 'off tackle', 'zone toss')
        ))

    if is_rpo:
        t.update(play_type='RPO', concept='RPO', primary='RPO', rpo_type=name.replace('RPO', '').strip() or name)
        t['secondary'] = ['Inside Zone'] if 'zone' in n else ['Run']
        t['tags'] += ['RPO']
        if 'bubble' in n or 'swing' in n:
            t['screen_type'] = 'Bubble' if 'bubble' in n else 'Swing'
            t['secondary'].append('Screens'); t['tags'] += ['Screen', 'Bubble' if 'bubble' in n else 'Swing']
        if 'slant' in n or 'glance' in n:
            t['man'] = True
        t['best'] = ['Cover 3', 'Cover 1'] if 'slant' in n else ['Cover 3']
        ratings(3, 4, 2, 3, 2, 2, 4); t['risk'], t['expl'] = 2, 2
        if 'post' in n or 'omaha' in n:
            t['expl'] = 3
    elif is_screen:
        st = 'Slip Screen' if 'slip' in n else 'WR Screen' if contains(n, 'jailbreak', 'wr screen', 'slot screen') and 'hb' not in n \
            else 'TE Screen' if 'te screen' in n or 'y screen' in n else 'Delayed Screen' if 'cross screen' in n else 'HB Screen'
        if 'hb jailbreak' in n:
            st = 'HB Screen'
        t.update(play_type='Screen', concept='Screen', primary='Screens', screen_type=st, play_action=is_pa, blitz=True)
        t['tags'] += ['Screen', 'Blitz Beater'] + (['Play Action'] if is_pa else [])
        t['best'] = ['Blitz', 'Cover 0', 'Man']
        ratings(2, 4, 4, 2, 1, 3, 3); t['risk'], t['expl'] = 2, 3
    elif is_pa:
        deep = any(has(n, w) for w in DEEP) or contains(n, 'deep', 'shot', 'sail', 'flood')
        t.update(play_type='Play Action', concept='Play Action', primary='Play Action', play_action=True)
        t['secondary'] = ['Shot Plays'] if deep else []
        t['tags'] += ['Play Action'] + (['Bootleg'] if contains(n, 'boot', 'waggle') else []) + (['Shot'] if deep else [])
        t['best'] = ['Cover 3', 'Cover 1']
        if contains(n, 'cross', 'drag', 'over'):
            t['man'] = True; t['pass_concept'] = 'PA Crossers'
        if contains(n, 'flood', 'sail', 'boot', 'waggle', 'flow'):
            t['zone'] = True; t['pass_concept'] = t['pass_concept'] or 'PA Flood/Boot'
        ratings(2, 3, 4, 3, 2, 1, 2) if deep else ratings(3, 4, 3, 3, 3, 2, 3)
        t['risk'], t['expl'] = (4, 5) if deep else (3, 3)
        if family == 'Goal Line':
            t['r'][4] = 4; t['r'][3] = 4
    elif is_run_name:
        outside = any(o in n for o in OUTSIDE)
        rc = ('Inside Zone' if 'inside zone' in n or n in ('inside zone',) else
              'Outside Zone' if contains(n, 'outside zone', 'wide zone', 'same side zone', 'stretch') else
              'Mid Zone' if 'mid zone' in n else 'Split Zone' if 'split zone' in n else
              'Power' if 'power' in n else 'Counter' if 'counter' in n else 'Duo' if 'duo' in n else
              'Trap' if 'trap' in n else 'Draw' if 'draw' in n else 'Toss' if 'toss' in n else
              'Sweep' if contains(n, 'sweep', 'touch pass', 'jet pass') else 'Option' if 'option' in n else
              'QB Sneak' if 'sneak' in n else 'Dive' if 'dive' in n else 'Iso' if 'iso' in n else
              'Zone' if 'zone' in n else name.replace('HB ', '').replace('QB ', ''))
        primary = 'Inside Zone' if rc in ('Inside Zone', 'Mid Zone', 'Split Zone', 'Zone', 'Duo') else \
                  'Outside Zone' if rc == 'Outside Zone' else 'Power Run' if rc in ('Power', 'Counter', 'Trap') else 'Run'
        t.update(play_type='Run', concept=rc, primary=primary, run_concept=rc)
        t['tags'] += ['Run', rc] + (['Option'] if 'option' in n else [])
        t['best'] = ['Cover 2', 'Cover 4']
        if outside:
            ratings(3, 3, 2, 3, 2, 1, 4); t['expl'] = 3
        elif 'draw' in n:
            ratings(2, 3, 3, 3, 2, 2, 3); t['best'] = ['Cover 2', 'Cover 4', 'Blitz']; t['expl'] = 3
        else:
            ratings(4, 3, 1, 3, 4, 1, 5)
        if 'sneak' in n:
            ratings(5, 1, 0, 3, 5, 1, 4); t['expl'] = 1
        if 'dive' in n or family == 'Goal Line':
            t['r'][4] = max(t['r'][4], 4); t['r'][0] = max(t['r'][0], 4)
        t['risk'] = 1
    else:
        # ---- pass concepts ----
        pc = None
        if 'spacing' in n:
            pc = 'Spacing'; t.update(primary='Spacing', zone=True); t['secondary'] = ['Quick Game']
            t['best'] = ['Cover 3', 'Cover 2', 'Zone']; ratings(4, 4, 2, 4, 2, 4, 3); t['risk'], t['expl'] = 2, 2
        elif contains(n, 'mesh', 'cross', 'drag', 'shallow', 'rail', 'poco', 'traffic', 'crosser'):
            pc = 'Mesh' if 'mesh' in n else 'Crossers'
            t.update(primary='Mesh', man=True); t['best'] = ['Man', 'Cover 1']
            if contains(n, 'spot', 'dig', 'rail', 'flood'):
                t['zone'] = True; t['best'].append('Cover 3')
            ratings(3, 4, 3, 3, 2, 3, 3); t['risk'], t['expl'] = 2, 3
            if 'mesh' in n or 'drag' in n:
                t['blitz'] = True; t['r'][0] = 4
        elif contains(n, 'flood', 'sail', 'fork'):
            pc = 'Flood'; t.update(primary='Flood', zone=True); t['best'] = ['Cover 3', 'Zone']
            ratings(2, 4, 3, 4, 2, 4, 2); t['risk'], t['expl'] = 2, 3
        elif 'levels' in n or 'hi lo' in n or 'dig' in n:
            pc = 'Levels'; t.update(primary='Levels', zone=True, man=True); t['best'] = ['Cover 3', 'Cover 1']
            ratings(2, 4, 3, 3, 1, 3, 2); t['risk'], t['expl'] = 2, 3
        elif 'drive' in n:
            pc = 'Drive'; t.update(primary='Drive', man=True, zone=True); t['best'] = ['Cover 3', 'Man']
            ratings(3, 4, 2, 3, 2, 3, 3); t['risk'], t['expl'] = 2, 2
        elif contains(n, 'smash'):
            pc = 'Smash'; t.update(primary='Quick Game', zone=True); t['best'] = ['Cover 2', 'Cover 4']
            ratings(2, 3, 3, 4, 2, 3, 2); t['risk'], t['expl'] = 3, 3
        elif contains(n, 'verticals', 'verts', 'vert ', 'four vert', 'seam', 'dagger', 'n go', 'sluggo', 'double post',
                      'dbl post', 'post corner', 'go dbl', 'soar', 'redzone up', 'corner strike', 'divide', 'omaha', 'up'):
            pc = 'Verticals' if contains(n, 'vert', 'seam') else 'Dagger' if 'dagger' in n else 'Shot'
            t.update(primary='Verticals' if pc == 'Verticals' else 'Shot Plays'); t['secondary'] = ['Shot Plays']
            t['best'] = ['Cover 3', 'Cover 1']
            if pc == 'Verticals':
                t['weak'] = ['Cover 4']
            ratings(1, 2, 4, 3, 1, 4, 1); t['risk'], t['expl'] = (4, 5) if pc != 'Dagger' else (3, 4)
            if 'redzone' in n or 'rz' in n:
                t['r'][3] = 4
        elif contains(n, 'slant'):
            pc = 'Slants'; t.update(primary='Quick Game', man=True, blitz=True); t['best'] = ['Man', 'Cover 1', 'Blitz']
            ratings(4, 3, 1, 4, 3, 3, 3); t['risk'], t['expl'] = 2, 2
        elif contains(n, 'stick', 'spot', 'snag', 'hitch', 'curl', 'out', 'choice', 'option', 'under', 'flat', 'pivot',
                      'return', 'whip', 'angle', 'bench', 'shake', 'trail', 'comeback', 'scat', 'shock', 'buc', 'ins',
                      'attack', 'wheel', 'corner', 'post', 'cross', 'dig', 'in'):
            pc = ('Stick' if 'stick' in n else 'Spot' if 'spot' in n else 'Snag' if 'snag' in n else
                  'Curl/Flat' if 'curl' in n else 'Hitch' if 'hitch' in n else 'Option Route' if contains(n, 'choice', 'option') else
                  'Pivot/Return' if contains(n, 'pivot', 'return') else 'Wheel' if 'wheel' in n else
                  'Corner' if 'corner' in n else 'Post' if 'post' in n else 'Quick')
            if pc in ('Wheel', 'Corner', 'Post'):
                t.update(primary='Shot Plays'); t['best'] = ['Cover 3', 'Cover 1']
                ratings(2, 3, 4, 3, 2, 4, 1); t['risk'], t['expl'] = 3, 4
            else:
                t.update(primary='Quick Game', zone=True); t['best'] = ['Cover 3', 'Zone']
                if pc in ('Option Route', 'Pivot/Return'):
                    t['man'] = True; t['best'] = ['Man', 'Cover 1', 'Cover 3']
                ratings(4, 3, 1, 4, 3, 3, 3); t['risk'], t['expl'] = 1, 1
        else:
            pc = 'Pass'; t['primary'] = 'Quick Game'
        t['concept'] = pc; t['pass_concept'] = pc
        t['tags'] += [pc] + (['Zone Beater'] if t['zone'] else []) + (['Man Beater'] if t['man'] else []) + (['Blitz Beater'] if t['blitz'] else [])
        if 'bunch' in formation.lower() or 'bunch' in n:
            t['tags'].append('Bunch')
        if contains(n, 'te ', 'y ', 'y-'):
            pass
        if family == 'Goal Line':
            t['r'][4] = max(t['r'][4], 3); t['r'][3] = max(t['r'][3], 4)
    if is_pa and is_screen:
        t['play_action'] = True
    t['tags'] = list(dict.fromkeys(t['tags'] + ['Auto-tagged']))
    return name, t

def sql_str(v):
    if v is None:
        return 'null'
    return "'" + str(v).replace("'", "''") + "'"

def sql_arr(a):
    if not a:
        return "array[]::text[]"
    return 'array[' + ','.join(sql_str(x) for x in a) + ']'

def main():
    rows = []
    seen = set()
    for line in open(SRC):
        line = line.strip()
        if not line:
            continue
        family, formation, raw = line.split('|')
        name, t = classify(family, formation, raw)
        key = (family, formation, name.lower())
        if key in seen:
            continue
        seen.add(key)
        rows.append((family, formation, name, t))

    forms = []
    for f, fm, _, _ in rows:
        if (f, fm) not in forms:
            forms.append((f, fm))
    forms.sort(key=lambda x: (FAMILY_ORDER.index(x[0]) if x[0] in FAMILY_ORDER else 99, x[1]))

    note = ('Auto-tagged: play name and formation are from the Madden 27 Atlanta playbook; type, concept, '
            'coverage tags and ratings were assigned from the play name. Verify in-game and add the read progression.')

    def build(sub, title):
        out = io.StringIO()
        w = out.write
        w('-- =====================================================================\n')
        w(f'-- ATL OC 27 — {title}\n')
        w('-- GENERATED by scripts/build_atlanta_seed.py — edit the script or use Admin, not this file.\n')
        w('-- Names/formations: real Atlanta playbook. Type/concept/tags/ratings: AUTO-TAGGED from the\n')
        w('-- play name (is_seed = true, tag "Auto-tagged"). Reads and personnel are left blank.\n')
        w('-- Safe to re-run: existing plays are left untouched.\n')
        w('-- =====================================================================\n\n')
        w("insert into public.playbooks (name, game_title, is_seed) values ('Atlanta', 'Madden 27', true)\n  on conflict (name) do nothing;\n\n")
        w('insert into public.formations (playbook_id, family, name, sort_order)\nselect p.id, v.family, v.name, v.ord\nfrom public.playbooks p, (values\n')
        w(',\n'.join(f'  ({sql_str(f)}, {sql_str(fm)}, {i})' for i, (f, fm) in enumerate(forms)))
        w('\n) as v(family, name, ord)\nwhere p.name = \'Atlanta\'\non conflict (playbook_id, family, name) do nothing;\n\n')
    
        cols = ('family, formation, play_name, play_type, concept, primary_scheme, secondary_schemes, screen_type, run_concept, '
                'pass_concept, rpo_type, play_action, best_vs, weak_vs, blitz_b, man_b, zone_b, sh, md, lg, rz, gl, tm, fm4, risk, expl')
        w(f'with v ({cols}) as (values\n')
        vals = []
        for f, fm, name, t in sub:
            r = t['r']
            vals.append('  (' + ', '.join([
                sql_str(f), sql_str(fm), sql_str(name), sql_str(t['play_type']), sql_str(t['concept']), sql_str(t['primary']),
                sql_arr(t['secondary']), sql_str(t['screen_type']), sql_str(t['run_concept']), sql_str(t['pass_concept']),
                sql_str(t['rpo_type']), 'true' if t['play_action'] else 'false', sql_arr(t['best']), sql_arr(t['weak']),
                'true' if t['blitz'] else 'false', 'true' if t['man'] else 'false', 'true' if t['zone'] else 'false',
                *[str(x) for x in r], str(t['risk']), str(t['expl'])]) + ')')
        w(',\n'.join(vals))
        w('\n)\ninsert into public.plays (playbook_id, formation_id, set_name, play_name, play_type, concept, primary_scheme,\n'
          '  secondary_schemes, screen_type, run_concept, pass_concept, rpo_type, play_action, best_vs, weak_vs, blitz_beater,\n'
          '  man_beater, zone_beater, short_yardage_rating, medium_yardage_rating, long_yardage_rating, red_zone_rating,\n'
          '  goal_line_rating, two_minute_rating, four_minute_rating, risk_level, explosive_potential, notes, is_seed, owner_id)\n'
          'select f.playbook_id, f.id, \'\', v.play_name, v.play_type, v.concept, v.primary_scheme, v.secondary_schemes, v.screen_type,\n'
          '  v.run_concept, v.pass_concept, v.rpo_type, v.play_action, v.best_vs, v.weak_vs, v.blitz_b, v.man_b, v.zone_b,\n'
          '  v.sh, v.md, v.lg, v.rz, v.gl, v.tm, v.fm4, v.risk, v.expl,\n'
          f'  {sql_str(note)}, true, null\n'
          'from v\njoin public.formations f on f.family = v.family and f.name = v.formation\n'
          'join public.playbooks b on b.id = f.playbook_id and b.name = \'Atlanta\'\n'
          'on conflict do nothing;\n\n')
    
        all_tags = sorted({tag for *_, t in sub for tag in t['tags']})
        w('insert into public.tags (name) select x from unnest(' + sql_arr(all_tags) + ') as x on conflict do nothing;\n\n')
        pairs = [(f, fm, name, tag) for f, fm, name, t in sub for tag in t['tags']]
        w('with pt (family, formation, play_name, tag) as (values\n')
        w(',\n'.join(f'  ({sql_str(a)}, {sql_str(b)}, {sql_str(c)}, {sql_str(d)})' for a, b, c, d in pairs))
        w('\n)\ninsert into public.play_tags (play_id, tag_id)\nselect p.id, tg.id\nfrom pt\n'
          'join public.formations f on f.family = pt.family and f.name = pt.formation\n'
          'join public.playbooks b on b.id = f.playbook_id and b.name = \'Atlanta\'\n'
          'join public.plays p on p.formation_id = f.id and lower(p.play_name) = lower(pt.play_name) and p.owner_id is null\n'
          'join public.tags tg on lower(tg.name) = lower(pt.tag)\non conflict do nothing;\n\n')
        w('-- Make yourself admin after signing up (change the email):\n'
          "--   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'you@example.com');\n")
        w('\n-- Result check: shows how many plays are now in the database.\n')
        w('select count(*) as plays_in_database from public.plays where owner_id is null;\n')
        return out.getvalue()

    open(os.path.join(ROOT, 'supabase', 'migrations', '002_seed.sql'), 'w').write(
        build(rows, f'FULL MADDEN 27 ATLANTA PLAYBOOK ({len(forms)} formations, {len(rows)} plays)'))
    parts_dir = os.path.join(ROOT, 'supabase', 'seed-in-parts')
    os.makedirs(parts_dir, exist_ok=True)
    n_parts = 4
    size = -(-len(rows) // n_parts)
    for i in range(n_parts):
        sub = rows[i * size:(i + 1) * size]
        open(os.path.join(parts_dir, f'part{i + 1}-of-{n_parts}.sql'), 'w').write(
            build(sub, f'ATLANTA PLAYBOOK PART {i + 1} OF {n_parts} ({len(sub)} plays) — run parts in order'))

    # CSV in import-template format
    fields = ['playbook', 'formationFamily', 'formation', 'set', 'playName', 'playType', 'personnel', 'concept', 'primaryScheme',
              'secondarySchemes', 'tags', 'screenType', 'runConcept', 'passConcept', 'rpoType', 'playAction', 'bestVs', 'weakVs',
              'blitzBeater', 'manBeater', 'zoneBeater', 'shortYardageRating', 'mediumYardageRating', 'longYardageRating',
              'redZoneRating', 'goalLineRating', 'twoMinuteRating', 'fourMinuteRating', 'primaryRead', 'secondRead', 'thirdRead',
              'checkdown', 'riskLevel', 'explosivePotential', 'notes']
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(os.path.join(ROOT, 'data', 'atlanta-playbook.csv'), 'w', newline='') as fh:
        cw = csv.writer(fh)
        cw.writerow(fields)
        for f, fm, name, t in rows:
            r = t['r']
            cw.writerow(['Atlanta', f, fm, '', name, t['play_type'], '', t['concept'] or '', t['primary'] or '',
                         '|'.join(t['secondary']), '|'.join(t['tags']), t['screen_type'] or '', t['run_concept'] or '',
                         t['pass_concept'] or '', t['rpo_type'] or '', str(t['play_action']).lower(), '|'.join(t['best']),
                         '|'.join(t['weak']), str(t['blitz']).lower(), str(t['man']).lower(), str(t['zone']).lower(),
                         *r, '', '', '', '', t['risk'], t['expl'], note])

    print(f'{len(forms)} formations, {len(rows)} plays')
    print('types:', dict(Counter(t['play_type'] for *_, t in rows)))
    print('concepts:', Counter(t['concept'] for *_, t in rows).most_common(30))

if __name__ == '__main__':
    main()
