import { spaceExportClient } from './space-export-client.ts';
import { syntheticActor } from './data-export-synthetic.ts';

// Ten years of daily appointments and weekly two-person, four-field Reviews.
// Text lengths describe a scenario, not an estimate of real users or phone RAM.
export function longHistoryClient(reviewCharacters = 350, varied = false) {
  const body = (seed, length) => { let n = seed + 1; return Array.from({ length }, () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return String.fromCharCode(0x4e00 + (n >>> 12) % 4096); }).join(''); };
  const f = spaceExportClient(37), personalId = f.rows.spaces[0].id, event = f.rows.events[0];
  f.rows.events.push(...Array.from({ length: 3650 }, (_, i) => ({ ...event,
    id: `80000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, space_id: personalId,
    scope: 'personal', owner_user_id: syntheticActor,
    description: varied ? body(i, 300) : (`第${i}次日程🐈\r\n"家庭记录",`).padEnd(300, '记'),
  })));
  const round = f.rows.review_rounds[0], entries = f.rows.review_entries;
  f.rows.review_rounds = Array.from({ length: 520 }, (_, i) => ({ ...round,
    id: `90000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, round_no: i + 1,
    review_date: new Date(Date.UTC(2016, 0, i * 7 + 1)).toISOString().slice(0, 10),
  }));
  f.rows.review_entries = f.rows.review_rounds.flatMap(r => entries.map(e => ({ ...e, review_id: r.id,
    focus: varied ? body(Number(r.round_no) * 4 + (e.user_id === syntheticActor ? 5000 : 10000), reviewCharacters) : (`重点${r.round_no}🐈\n"正文",`).padEnd(reviewCharacters, '思'),
    progress: varied ? body(Number(r.round_no) + 20000, reviewCharacters) : '进'.repeat(reviewCharacters), problems: varied ? body(Number(r.round_no) + 30000, reviewCharacters) : '问'.repeat(reviewCharacters), next_plan: varied ? body(Number(r.round_no) + 40000, reviewCharacters) : '计'.repeat(reviewCharacters),
  })));
  return f;
}
