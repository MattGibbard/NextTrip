import { useEffect, useState } from "react";
import { publicPage } from "../../shared/seo";
import { findDestination, loadDestination, loadedDestination } from "../destinations";
import { DestinationPage, DestinationsIndex } from "./DestinationPage";
import type { Family } from "./DestinationPage";
import { NotFound } from "./Welcome";
import { AppSkeleton } from "../components/AppSkeleton";

/** A Guides page: the list of guides, one guide, or not found. */
export function GuideView({ path, family }: { path: string; family?: Family }) {
  const page = publicPage(path);
  if (page === "destinations") return <DestinationsIndex family={family} />;
  const slug = page?.startsWith("destination:") ? page.slice("destination:".length) : "";
  return findDestination(slug) ? <Guide key={slug} slug={slug} family={family} /> : <NotFound />;
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
