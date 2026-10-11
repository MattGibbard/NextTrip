import { useEffect, useState } from "react";
import { publicPage } from "../../shared/seo";
import { findDestination, loadDestination, loadedDestination } from "../destinations";
import { DestinationPage, DestinationsIndex } from "./DestinationPage";
import type { Family } from "./DestinationPage";
import { NotFound } from "./Welcome";
import { AppSkeleton } from "../components/AppSkeleton";
import { findHub, loadHub, loadedHub } from "../hubs";
import { HubPage } from "./HubPage";

/** A Guides page: the list of guides, one guide, a hub of guides, or not found. */
export function GuideView({ path, family }: { path: string; family?: Family }) {
  const page = publicPage(path);
  if (page === "destinations") return <DestinationsIndex family={family} />;
  const slug = page?.startsWith("destination:") ? page.slice("destination:".length) : "";
  if (findDestination(slug)) return <Guide key={slug} slug={slug} family={family} />;
  return findHub(slug) ? <HubView key={slug} slug={slug} family={family} /> : <NotFound />;
}

/** One guide, once its full text has arrived. main.tsx fetches it first when a guide is the page that opens. */
function Guide({ slug, family }: { slug: string; family?: Family }) {
  const [destination, setDestination] = useState(() => loadedDestination(slug));
  useEffect(() => {
    if (destination) return;
    let live = true;
    void loadDestination(slug)
      .then((d) => live && setDestination(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug, destination]);
  if (destination) return <DestinationPage destination={destination} family={family} />;
  return family ? <AppSkeleton guide /> : null;
}

/** A hub, once its words have arrived. main.tsx fetches them first when a hub is the page that opens. */
function HubView({ slug, family }: { slug: string; family?: Family }) {
  const [hub, setHub] = useState(() => loadedHub(slug));
  useEffect(() => {
    if (hub) return;
    let live = true;
    void loadHub(slug)
      .then((h) => live && setHub(h))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug, hub]);
  if (hub) return <HubPage hub={hub} family={family} />;
  return family ? <AppSkeleton guide /> : null;
}
