import { useEffect, useState } from "react";
import { BANNER, bannerEnded, bannerKey } from "../site";
import type { Banner } from "../site";
import { load, save } from "../storage";

/**
 * The announcement across the top of every page, switched on and written at /admin. People can close
 * it, and it stays closed until the announcement changes. It hides itself after its last day.
 */
export function SiteBanner({ banner = BANNER }: { banner?: Banner | null }) {
  const [open, setOpen] = useState(true);
  // Checked after the first paint so the page matches the HTML it arrived as.
  useEffect(() => {
    if (banner && (bannerEnded(banner, new Date()) || load<string | null>("bannerClosed", null) === bannerKey(banner))) setOpen(false);
  }, [banner]);
  if (!banner || !open) return null;
  const close = () => {
    save("bannerClosed", bannerKey(banner));
    setOpen(false);
  };
  return (
    <div className={`site-banner ${banner.style}`} role="region" aria-label="Announcement">
      <p>
        {banner.text}
        {banner.link_url && (
          <>
            {" "}
            <a href={banner.link_url}>{banner.link_text || "Find out more"}</a>
          </>
        )}
      </p>
      <button type="button" className="site-banner-close" aria-label="Close announcement" onClick={close}>
        ✕
      </button>
    </div>
  );
}
