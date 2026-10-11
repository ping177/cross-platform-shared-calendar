import { useEffect, useRef, useState } from 'react';
import { createRequestGuard } from '../lib/request-guard';
import { importantDateLocalToday } from '../lib/important-dates';
import { loadModuleOverview, overviewScopeKey, pendingOverview, type ModuleOverview, type OverviewScope } from '../lib/module-overview';

export const overviewFreshnessMs = 60_000;
export function useModuleOverview(scope: OverviewScope | null, pending = false) {
  const key = scope ? overviewScopeKey(scope) + ':' + pending : 'unknown';
  const live = useRef({ key, guard: createRequestGuard(), pending: null as Promise<void> | null });
  if (live.current.key !== key) {
    live.current.guard.invalidate();
    live.current = { key, guard: createRequestGuard(), pending: null };
  }
  const [result, setResult] = useState<{ key: string; data: ModuleOverview } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!scope || pending) return;
    const current = live.current;
    let lastRead = 0;
    let day = JSON.stringify(importantDateLocalToday());
    function refresh() {
      if (current.pending || live.current !== current) return;
      const request = current.guard.begin();
      setResult({ key, data: pendingOverview() });
      const operation = loadModuleOverview(scope!).then(data => {
        if (live.current === current && current.guard.isCurrent(request)) setResult({ key, data });
      }, () => {
        if (live.current === current && current.guard.isCurrent(request)) {
          const data = pendingOverview();
          for (const metric of Object.values(data)) metric.state = 'error';
          setResult({ key, data });
        }
      }).finally(() => { if (current.pending === operation) { lastRead = Date.now(); current.pending = null; } });
      current.pending = operation;
    }
    const interval = window.setInterval(() => {
      const nextDay = JSON.stringify(importantDateLocalToday());
      if (document.visibilityState === 'visible' && (Date.now() - lastRead >= overviewFreshnessMs || nextDay !== day)) {
        day = nextDay; refresh();
      }
    }, overviewFreshnessMs);
    // Foreground/online qualification refresh is owned by useModuleAvailability.
    // Its pending transition restarts this read, avoiding a second focus request.
    refresh();
    return () => {
      current.guard.invalidate();
      current.pending = null;
      window.clearInterval(interval);
    };
  }, [key, revision]);
  return { data: !pending && result?.key === key ? result.data : pendingOverview(), retry: () => setRevision(value => value + 1) };
}
