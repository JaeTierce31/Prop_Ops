import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  dispatch,
  seedState,
  SEED_EPOCH,
  type Action,
  type Actor,
  type DemoState,
  type DispatchResult,
} from "./model";

const KEY = "wg-maintenance-mvp-v1";

interface Notice {
  ok: boolean;
  text: string;
  id: number;
}
interface DemoCtx {
  state: DemoState;
  now: number;
  run: (action: Action, actor: Actor, successText?: string) => DispatchResult;
  reset: () => void;
  notice: Notice | null;
  clearNotice: () => void;
}

const Ctx = createContext<DemoCtx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => seedState(SEED_EPOCH));
  const [now, setNow] = useState(SEED_EPOCH);
  const [notice, setNotice] = useState<Notice | null>(null);
  const ref = useRef(state);
  const hydrated = useRef(false);

  useEffect(() => {
    let loaded: DemoState | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) loaded = JSON.parse(raw) as DemoState;
    } catch {
      loaded = null;
    }
    const s = loaded && loaded.version === 1 ? loaded : seedState(Date.now());
    ref.current = s;
    setState(s);
    setNow(Date.now());
    hydrated.current = true;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (hydrated.current) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const run = useCallback(
    (action: Action, actor: Actor, successText?: string) => {
      const t = Math.max(Date.now(), (ref.current.events.at(-1)?.at ?? 0) + 1);
      const r = dispatch(ref.current, action, actor, t);
      ref.current = r.state;
      setState(r.state);
      setNow(t);
      if (!r.ok) setNotice({ ok: false, text: `Denied: ${r.reason}`, id: t });
      else if (successText) setNotice({ ok: true, text: successText, id: t });
      return r;
    },
    [],
  );

  const reset = useCallback(() => {
    const s = seedState(Date.now());
    ref.current = s;
    setState(s);
    setNow(Date.now());
    setNotice({
      ok: true,
      text: "Demo reset to the seeded scenario.",
      id: Date.now(),
    });
  }, []);

  return (
    <Ctx.Provider
      value={{
        state,
        now,
        run,
        reset,
        notice,
        clearNotice: () => setNotice(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDemo() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo outside DemoProvider");
  return c;
}
