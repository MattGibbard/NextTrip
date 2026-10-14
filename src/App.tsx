import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { FamilyData, Session } from "../shared/types";
import { api, forgetLegacyPerson, setSignedOutHandler } from "./api";
import { JoinPage, PersonLinkPage, SignInPage } from "./views/LinkPages";
import { infoTitle } from "./infoPages";
import { NotFound } from "./views/NotFound";
import { PAGES, infoPage, isPrivatePath, publicPage } from "../shared/seo";
import { CREATORS, HOW } from "./site";
import { findPost, listing, listingTitle, loadedPost, postTitle } from "./blog";
import { followInPlace, isGuidePath } from "./navigate";
import { load, save } from "./storage";
import { AppSkeleton } from "./components/AppSkeleton";
import { SIGNED_IN, forgetFamily, forgetFamilyData, lastFamily } from "./lastFamily";
import { lazyView } from "./lazyView";

// Each public page's code downloads only when it's visited (see lazyView). The Guides pages carry
// every guide's card, so pages that aren't about guides don't download those either.
const loadGuides = () => import("./views/GuideView");
const GuideView = lazyView(() => loadGuides().then((m) => m.GuideView));
const HomePage = lazyView(() => import("./views/HomePage").then((m) => m.HomePage));
const LegalView = lazyView(() => import("./views/Legal").then((m) => m.LegalView));
const CreatorsPage = lazyView(() => import("./views/Creators").then((m) => m.CreatorsPage));
const HowItWorksPage = lazyView(() => import("./views/HowItWorks").then((m) => m.HowItWorksPage));
const InfoPage = lazyView(() => import("./views/InfoPage").then((m) => m.InfoPage));
const BlogList = lazyView(() => import("./views/Blog").then((m) => m.BlogList));
const BlogPost = lazyView(() => import("./views/Blog").then((m) => m.BlogPost));


/** Fetches the code for the page at this address, if it's one that loads on its own. */
export function preloadPage(pathname: string): Promise<unknown> {
  const page = publicPage(pathname);
  if (page === "home") return HomePage.preload();
  if (page === "privacy" || page === "terms") return LegalView.preload();
  if (page === "creators") return CreatorsPage.preload();
  if (page === "how") return HowItWorksPage.preload();
  if (listing(page)) return BlogList.preload();
  if (page?.startsWith("post:")) return BlogPost.preload();
  if (infoPage(pathname)) return InfoPage.preload();
  // A guide or hub's own words are their own file too.
  if (page === "destinations") return GuideView.preload();
  if (page?.startsWith("destination:")) return Promise.all([GuideView.preload(), loadGuides().then((m) => m.preloadGuide(page.slice("destination:".length)))]);
  return Promise.resolve();
}

// The signed-in app (its views, the map and the draw) loads only once someone is signed in, so the
// public pages that visitors and search engines see stay small and quick.
const loadSignedIn = () => import("./SignedIn");
const SignedIn = lazy(loadSignedIn);
// Someone who was signed in last time is almost certainly still signed in, so start fetching the app
// now, alongside the check with the server, rather than waiting for its answer.
if (load(SIGNED_IN, false)) void loadSignedIn();

/**
 * A family link (/f/…), a person's own link from the organiser (/p/…) or an
 * emailed sign-in link (/signin?token=…), if that's how we got here.
 */
function entryLink(): { kind: "join" | "person" | "signin"; token: string } | null {
  const join = location.pathname.match(/^\/f\/([\w-]+)\/?$/);
  if (join) return { kind: "join", token: join[1] };
  const person = location.pathname.match(/^\/p\/([\w-]+)\/?$/);
  if (person) return { kind: "person", token: person[1] };
  const token = new URLSearchParams(location.search).get("token");
  if (location.pathname === "/signin" && token) return { kind: "signin", token };
  return null;
}

export function App() {
  const [path, setPath] = useState(() => location.pathname);

  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    // Signed in, links between the app and the Guides pages switch in place. Visitors' pages load as
    // normal, the same as search engines see them.
    const onClick = (e: MouseEvent) => {
      if (load(SIGNED_IN, false)) followInPlace(e);
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    // A guide or hub names itself (GuideView), as only the Guides pages know every guide.
    if (!publicPage(path)?.startsWith("destination:")) document.title = pageTitle(path);
  }, [path]);

  const page = publicPage(path);
  if (page === "privacy" || page === "terms") return <LegalView page={page} />;
  if (page === "creators") return <CreatorsPage />;
  if (page === "how") return <HowItWorksPage />;
  const info = infoPage(path);
  if (info) return <InfoPage page={info} />;
  if (page === "blog" || page?.startsWith("blog:") || page?.startsWith("tag:")) {
    const list = listing(page);
    return list ? <BlogList listing={list} /> : <NotFound />;
  }
  if (page?.startsWith("post:")) {
    const post = loadedPost(page.slice("post:".length));
    return post ? <BlogPost post={post} /> : <NotFound />;
  }
  // Signed-in families see the Guides inside the app, so moving between them is instant.
  // index.html clears the visitors' version before the first paint so it doesn't flash.
  if (isGuidePath(path) && !load(SIGNED_IN, false)) return <GuideView path={path} />;
  if (path !== "/" && !isGuidePath(path) && !isPrivatePath(path)) return <NotFound />;
  return <Main path={path} />;
}

/** The tab title for an address, kept up to date as the app moves between pages in place. */
function pageTitle(path: string): string {
  const page = publicPage(path);
  if (page === "destinations") return PAGES.destinations.title;
  if (page === "creators") return CREATORS.seo_title || PAGES.creators.title;
  if (page === "how") return HOW.seo_title || PAGES.how.title;
  const post = page?.startsWith("post:") ? findPost(page.slice("post:".length)) : undefined;
  if (post) return postTitle(post);
  const list = listing(page);
  if (list) return listingTitle(list);
  const info = infoPage(path);
  return info ? infoTitle(info) : "somewhere🎉";
}


function Main({ path }: { path: string }) {
  const [entry, setEntry] = useState(entryLink);
  // Signed in last time: open straight away with the family's things as they were, and let the app
  // fetch the latest itself. A sign-in link may be for someone else, so it never uses them.
  const [last] = useState(() => (entry || !load(SIGNED_IN, false) ? null : lastFamily()));
  const [session, setSession] = useState<Session | null>(last?.session ?? null);
  // The family's things, when they came from the server along with the session.
  const [fresh, setFresh] = useState<FamilyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await api.bootstrap();
      save(SIGNED_IN, b.session.signed_in);
      if (!b.session.signed_in) forgetFamily();
      setFresh(b.session.signed_in ? (b.data as FamilyData) : null);
      setSession(b.session);
      // The server has carried over any person this browser picked before, so the old choice can go.
      forgetLegacyPerson();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Once a link has done its job, tidy the address bar so it isn't bookmarked or shared by mistake.
  const entered = useCallback(() => {
    history.replaceState(null, "", "/");
    setEntry(null);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSignedOutHandler(() => {
      forgetFamily();
      setSession({ signed_in: false });
    });
    if (entry) forgetFamilyData();
    else if (!last) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (entry?.kind === "join") return <JoinPage token={entry.token} onJoined={entered} />;
  if (entry?.kind === "person") return <PersonLinkPage token={entry.token} onJoined={entered} />;
  if (entry?.kind === "signin") return <SignInPage token={entry.token} onSignedIn={entered} />;
  if (!session) {
    return error ? (
      <div className="banner error">
        {error} <button onClick={() => void refresh()}>Retry</button>
      </div>
    ) : location.pathname === "/" && !load(SIGNED_IN, false) ? (
      // The same page the server sent, so nothing jumps while we check.
      <HomePage />
    ) : (
      <AppSkeleton guide={isGuidePath(path)} />
    );
  }
  if (!session.signed_in) return isGuidePath(path) ? <GuideView path={path} /> : <HomePage />;
  return (
    <Suspense fallback={<AppSkeleton guide={isGuidePath(path)} />}>
      <SignedIn session={session} path={path} initial={fresh ?? last?.data ?? null} stale={!fresh} />
    </Suspense>
  );
}
