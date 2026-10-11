// Master playbook writes (admins) and custom plays (subscribers). Online only.
import { supabase } from '@/lib/supabase';
import type { Play } from '@/lib/types';
import { playToRow, rowToPlay } from './mappers';
import { PLAY_SELECT } from './api';

export interface FormationRow { id: string; playbook_id: string; family: string; name: string }
export interface PlaybookRow { id: string; name: string }

export async function listPlaybooks(): Promise<PlaybookRow[]> {
  const { data, error } = await supabase.from('playbooks').select('id,name').order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}
export async function listFormations(): Promise<FormationRow[]> {
  const { data, error } = await supabase.from('formations').select('id,playbook_id,family,name').order('family').order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function ensurePlaybook(name: string, cache?: PlaybookRow[]): Promise<PlaybookRow> {
  const hit = cache?.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit;
  const { data, error } = await supabase.from('playbooks').upsert({ name }, { onConflict: 'name' }).select('id,name').single();
  if (error) throw new Error(`Playbook "${name}": ${error.message}`);
  cache?.push(data);
  return data;
}

export async function ensureFormation(playbookId: string, family: string, name: string, cache?: FormationRow[]): Promise<FormationRow> {
  const hit = cache?.find((f) => f.playbook_id === playbookId && f.family.toLowerCase() === family.toLowerCase() && f.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit;
  const { data, error } = await supabase.from('formations')
    .upsert({ playbook_id: playbookId, family, name }, { onConflict: 'playbook_id,family,name' })
    .select('id,playbook_id,family,name').single();
  if (error) throw new Error(`Formation "${family} ${name}": ${error.message}`);
  cache?.push(data);
  return data;
}

const tagCache = new Map<string, string>();
export async function ensureTagIds(names: string[]): Promise<string[]> {
  const want = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!want.length) return [];
  if (!tagCache.size) {
    const { data } = await supabase.from('tags').select('id,name');
    for (const t of data ?? []) tagCache.set(t.name.toLowerCase(), t.id);
  }
  const missing = want.filter((n) => !tagCache.has(n.toLowerCase()));
  if (missing.length) {
    const { data, error } = await supabase.from('tags').insert(missing.map((name) => ({ name }))).select('id,name');
    if (error) {
      // a concurrent insert may have created some — reload
      const { data: all } = await supabase.from('tags').select('id,name');
      for (const t of all ?? []) tagCache.set(t.name.toLowerCase(), t.id);
    } else {
      for (const t of data ?? []) tagCache.set(t.name.toLowerCase(), t.id);
    }
  }
  return want.map((n) => tagCache.get(n.toLowerCase())).filter((x): x is string => Boolean(x));
}

export async function setPlayTags(playId: string, tags: string[]): Promise<void> {
  const ids = await ensureTagIds(tags);
  const del = await supabase.from('play_tags').delete().eq('play_id', playId);
  if (del.error) throw new Error(del.error.message);
  if (ids.length) {
    const ins = await supabase.from('play_tags').insert(ids.map((tag_id) => ({ play_id: playId, tag_id })));
    if (ins.error) throw new Error(ins.error.message);
  }
}

export async function fetchPlay(id: string): Promise<Play> {
  const { data, error } = await supabase.from('plays').select(PLAY_SELECT).eq('id', id).single();
  if (error) throw new Error(error.message);
  return rowToPlay(data);
}

/** Insert or update a play (+ its tags). Returns the saved play as stored. */
export async function savePlay(p: Play, isNew: boolean): Promise<Play> {
  const row = playToRow(p);
  if (isNew) {
    const { id: _omit, ...insertRow } = row;
    void _omit;
    const { data, error } = await supabase.from('plays').insert(insertRow).select('id').single();
    if (error) throw new Error(error.message.includes('duplicate') ? 'A play with this playbook + formation + set + name already exists.' : error.message);
    await setPlayTags(data.id, p.tags);
    return fetchPlay(data.id);
  }
  const { error } = await supabase.from('plays').update(row).eq('id', p.id);
  if (error) throw new Error(error.message);
  await setPlayTags(p.id, p.tags);
  return fetchPlay(p.id);
}

export async function deletePlay(id: string): Promise<void> {
  const { error } = await supabase.from('plays').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
