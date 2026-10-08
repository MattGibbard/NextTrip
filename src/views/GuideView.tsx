import { publicPage } from "../../shared/seo";
import { findDestination } from "../destinations";
import { DestinationPage, DestinationsIndex } from "./DestinationPage";
import type { Family } from "./DestinationPage";
import { NotFound } from "./Welcome";

/** A Guides page: the list of guides, one guide, or not found. */
export function GuideView({ path, family }: { path: string; family?: Family }) {
  const page = publicPage(path);
  if (page === "destinations") return <DestinationsIndex family={family} />;
  const destination = page?.startsWith("destination:") ? findDestination(page.slice("destination:".length)) : undefined;
  return destination ? <DestinationPage destination={destination} family={family} /> : <NotFound />;
}

