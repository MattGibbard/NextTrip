import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Terminal } from "../shared/terminals";
import type { FamilyData, FamilyPart, HomeEnds, Idea, Person, Round, Trip } from "../shared/types";
import { api, forgetLegacyPerson, signedOut } from "./api";
import { rememberFamily } from "./lastFamily";
import type { SignedInSession } from "./lastFamily";

interface Data {
  /** Everyone in the family who takes part. */
  people: Person[];
  /** Including people the organiser removed, for naming them on old draws. */
  allPeople: Person[];
  /** The organiser signed in by email; everyone else came in with the family link. */
  isOwner: boolean;
  /** The family link to share, for the organiser only. */
  shareUrl: string | null;
  setShareToken: (token: string) => void;
  trips: Trip[];
  ideas: Idea[];
  rounds: Round[];
  /** The home airport, which travel times and flight tickets start from when an idea or trip has no departure. */
  home: Terminal | null;
  /** The airport and station new trips and ideas set off from. */
  homeEnds: HomeEnds;
  /** Who this browser is. Only the server changes it. */
  me: Person | null;
  /** Call after the server has tied this browser to someone. */
  setMe: (id: number) => void;
  loading: boolean;
  error: string | null;
  /** Fetches the family's things again: everything, or only the lists a change touched. */
  reload: (only?: FamilyPart[]) => Promise<void>;
  personName: (id: number | null) => string;
}

const DataContext = createContext<Data | null>(null);

export function DataProvider({
  children,
  session,
  initial,
  stale,
}: {
  children: ReactNode;
  session: SignedInSession;
  /** The family's things if they're already here: fresh from the server, or remembered from last time. */
  initial: FamilyData | null;
  /** The things given were remembered from last time, so fetch the latest straight away. */
  stale: boolean;
}) {
  const [isOwner, setIsOwner] = useState(session.role === "owner");
  const [token, setShareToken] = useState(session.share_token);
  const [meId, setMeId] = useState<number | null>(session.person_id);
  const [people, setPeople] = useState<Person[]>(initial?.people ?? []);
  const [trips, setTrips] = useState<Trip[]>(initial?.trips ?? []);
  const [ideas, setIdeas] = useState<Idea[]>(initial?.ideas ?? []);
  const [rounds, setRounds] = useState<Round[]>(initial?.rounds ?? []);
  const [homeEnds, setHomeEnds] = useState<HomeEnds>(initial?.home_ends ?? { airport: null, station: null });
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  // Whether what's shown has come from the server, rather than being remembered from last time.
  const [synced, setSynced] = useState(!!initial && !stale);

  const reload = useCallback(async (only?: FamilyPart[]) => {
    try {
      const { session: s, data } = await api.bootstrap(only);
      if (!s.signed_in || !data) {
        signedOut();
        return;
      }
      forgetLegacyPerson();
      setIsOwner(s.role === "owner");
      setShareToken(s.share_token);
      if (data.people) setPeople(data.people);
      if (data.trips) setTrips(data.trips);
      if (data.ideas) setIdeas(data.ideas);
      if (data.rounds) setRounds(data.rounds);
      if (data.home_ends) setHomeEnds(data.home_ends);
      setSynced(true);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on the way in unless the server's latest came with the session, and again when this browser
  // becomes someone, since what you can see of a round depends on who you are.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current || !initial || stale) void reload();
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, meId]);

  // Kept for next time, so the app opens with these straight away.
  useEffect(() => {
    if (!synced) return;
    rememberFamily({
      session: { signed_in: true, role: isOwner ? "owner" : "member", share_token: token, person_id: meId },
      data: { people, trips, ideas, rounds, home_ends: homeEnds },
    });
  }, [synced, isOwner, token, meId, people, trips, ideas, rounds, homeEnds]);

  const setMe = useCallback((id: number) => setMeId(id), []);

  const value = useMemo<Data>(
    () => ({
      people: people.filter((p) => !p.removed),
      allPeople: people,
      isOwner,
      shareUrl: token ? `${location.origin}/f/${token}` : null,
      setShareToken,
      trips,
      ideas,
      rounds,
      home: homeEnds.airport,
      homeEnds,
      me: people.find((p) => p.id === meId && !p.removed) ?? null,
      setMe,
      loading,
      error,
      reload,
      personName: (id) => people.find((p) => p.id === id)?.name ?? "Someone",
    }),
    [people, isOwner, token, trips, ideas, rounds, homeEnds, meId, setMe, loading, error, reload],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): Data {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData outside DataProvider");
  return ctx;
}
