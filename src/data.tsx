import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Terminal } from "../shared/terminals";
import type { HomeEnds, Idea, Person, Round, Trip } from "../shared/types";
import { api } from "./api";

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
  reload: () => Promise<void>;
  personName: (id: number | null) => string;
}

const DataContext = createContext<Data | null>(null);

export function DataProvider({
  children,
  isOwner,
  shareToken,
  personId,
}: {
  children: ReactNode;
  isOwner: boolean;
  shareToken: string | null;
  personId: number | null;
}) {
  const [token, setShareToken] = useState(shareToken);
  const [meId, setMeId] = useState<number | null>(personId);
  const [people, setPeople] = useState<Person[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [homeEnds, setHomeEnds] = useState<HomeEnds>({ airport: null, station: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [p, t, i, r, e] = await Promise.all([api.people(), api.trips(), api.ideas(), api.rounds(), api.homeEnds()]);
      setPeople(p);
      setTrips(t);
      setIdeas(i);
      setRounds(r);
      setHomeEnds(e);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, meId]);

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
