import type { Client } from '../lib/client';
import { derivePersonalLearningModel, learningColumns, type LearningInput, type LearningTable } from './learner';
import { safeError, ServiceError } from './errors';

/** Read every page; never interpret a failed or truncated query as an empty table. */
export async function loadLearningContext(client: Client, asOf = new Date().toISOString()) {
  const entries = await Promise.all((Object.keys(learningColumns) as LearningTable[]).map(async table => {
    const rows: unknown[] = [];
    for (let page = 0; page < 100; page++) {
      const select = table === 'evidence' ? `${learningColumns[table]},url,notes` : learningColumns[table];
      const result = await client.from(table).select(select).order('id').range(page * 500, page * 500 + 499);
      if (result.error) throw safeError(result.error);
      if (!result.data) throw new ServiceError('database', 'Learning context was not returned.');
      rows.push(...table === 'evidence' ? result.data.map(row => {
        const raw = row as unknown as Record<string, unknown>;
        const evidence = raw as { url?: string | null; notes?: string | null };
        const url = evidence.url?.trim() || '';
        const notes = evidence.notes?.trim() || '';
        let referenceValid = !!notes;
        if (!referenceValid && url) { try { const parsed = new URL(url); referenceValid = parsed.protocol === 'http:' || parsed.protocol === 'https:'; } catch { referenceValid = false; } }
        return { ...raw, reference_present: !!(url || notes), reference_valid: referenceValid };
      }) : result.data);
      if (result.data.length < 500) return [table, rows] as const;
    }
    throw new ServiceError('database', 'Learning context exceeds the supported snapshot size. No partial recommendation was produced.');
  }));
  return derivePersonalLearningModel(Object.fromEntries(entries) as LearningInput, asOf);
}
