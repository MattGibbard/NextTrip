import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Home, HomeEnds, Idea, Person, Round, Trip } from "../shared/types";
import { api, setApiPerson } from "./api";
import { load, save } from "./storage";

interface Data {
  people: Person[];
  trips: Trip[];
  ideas: Idea[];
  rounds: Round[];
  /** Where travel times are measured from, if it's been set. */
  home: Home;
  /** The airport and station new trips and ideas set off from. */
  homeEnds: HomeEnds;
  me: Person | null;
  setMe: (id: number | null) => void;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  personName: (id: number | null) => string;
}

const DataContext = createContext<Data | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [meId, setMeId] = useState<number | null>(() => {
    const id = load<number | null>("person", null);
    setApiPerson(id);
    return id;
  });
  const [people, setPeople] = useState<Person[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [home, setHome] = useState<Home>(null);
  const [homeEnds, setHomeEnds] = useState<HomeEnds>({ airport: null, station: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [p, t, i, r, h, e] = await Promise.all([api.people(), api.trips(), api.ideas(), api.rounds(), api.home(), api.homeEnds()]);
      setPeople(p);
      setTrips(t);
      setIdeas(i);
      setRounds(r);
      setHome(h);
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

  const setMe = useCallback((id: number | null) => {
    setApiPerson(id);
    save("person", id);
    setMeId(id);
  }, []);

  const value = useMemo<Data>(
    () => ({
      people,
      trips,
      ideas,
      rounds,
      home,
      homeEnds,
      me: people.find((p) => p.id === meId) ?? null,
      setMe,
      loading,
      error,
      reload,
      personName: (id) => people.find((p) => p.id === id)?.name ?? "Someone",
    }),
    [people, trips, ideas, rounds, home, homeEnds, meId, setMe, loading, error, reload],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): Data {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData outside DataProvider");
  return ctx;
}
