import { useCallback, useEffect, useRef, useState } from 'react';

/** Загрузка данных с повтором; устаревшие ответы отбрасываются. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true });
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(() => {
    const my = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    load().then(
      (data) => my === seq.current && setState({ data, loading: false }),
      (error) => my === seq.current && setState({ error, loading: false }),
    );
  }, [load]);
  useEffect(reload, [reload]);
  return { ...state, reload };
}
