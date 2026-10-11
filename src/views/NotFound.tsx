import { Frame } from "../components/SiteFrame";

/** Any address that isn't a page. The server sends it with a 404 so search engines drop it. */
export function NotFound() {
  return (
    <Frame>
      <section className="intro narrow">
        <div className="panel signin">
          <h1 className="big">Page not found</h1>
          <p className="muted">There's nothing at this address. If someone sent you a family link, check it was copied in full.</p>
          <a className="btn large" href="/">
            Go to the home page
          </a>
        </div>
      </section>
    </Frame>
  );
}
