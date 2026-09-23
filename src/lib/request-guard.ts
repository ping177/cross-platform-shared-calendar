export function createRequestGuard() {
  let latest = 0;
  return {
    begin: () => ++latest,
    isCurrent: (request: number) => request === latest,
    invalidate: () => { latest += 1; },
  };
}
