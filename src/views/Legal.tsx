import type { ReactNode } from "react";
import { Frame } from "./Welcome";

// Keep these in step with what the app really does: if a change stores something new
// or sends data to another service, update the privacy policy and this date.
const UPDATED = "8 October 2026";
const CONTACT = "https://github.com/MattGibbard/NextTrip/issues";

export type LegalPage = "privacy" | "terms";

export function legalPage(pathname: string): LegalPage | null {
  const m = pathname.match(/^\/(privacy|terms)\/?$/);
  return m ? (m[1] as LegalPage) : null;
}

export function LegalView({ page }: { page: LegalPage }) {
  return (
    <Frame>
      <article className="panel legal">{page === "privacy" ? <Privacy /> : <Terms />}</article>
    </Frame>
  );
}

function Contact({ children }: { children: ReactNode }) {
  return (
    <a href={CONTACT} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function Privacy() {
  return (
    <>
      <h1 className="display">Privacy policy</h1>
      <p className="muted small">Last updated {UPDATED}</p>
      <p>
        somewhere🎉 is a small, independent website run by one person in the UK. It's built to collect as little about you as possible. This page explains what it does keep,
        why, and what you can do about it.
      </p>

      <h2>What we keep</h2>
      <ul>
        <li>
          <strong>The organiser's email address, as a fingerprint only.</strong> When you sign in, your email address is used once to send the sign-in link and is then thrown
          away. We keep a one-way hash of it (SHA-256) so we recognise you next time. We can't turn that back into your address.
        </li>
        <li>
          <strong>Names and colours.</strong> Family members type a name and pick a colour. A first name or nickname is all that's needed.
        </li>
        <li>
          <strong>Your family's holiday plans.</strong> Trips, places, ideas, notes, ratings, photo links, points, vetoes, swipes and draw results that your family adds, plus
          the home airport and station you set.
        </li>
        <li>
          <strong>A sign-in cookie.</strong> One cookie keeps each device signed in (up to 180 days for the organiser and a year for family members). We only store a hash of
          it. It is needed for the site to work, so there's no cookie banner. Your browser also remembers a few preferences, such as light or dark mode and who you are on
          this device.
        </li>
      </ul>
      <p>
        We don't use passwords, ads, analytics or tracking, and we don't sell or share your data with anyone for marketing. Anyone with your family link can see your family's
        trips and ideas, so keep it private.
      </p>

      <h2>Services that help run somewhere🎉</h2>
      <ul>
        <li>
          <strong>Cloudflare</strong> hosts the site and its database. Like any web host it sees your IP address and keeps short-lived logs for running and securing the
          service.
        </li>
        <li>
          <strong>Resend</strong> sends the sign-in emails, so it receives the organiser's email address for that purpose.
        </li>
        <li>
          <strong>OpenStreetMap</strong> draws the maps and powers place search. Your browser loads map tiles from it directly, and the place names you search for are sent
          to it from our server.
        </li>
        <li>
          <strong>Google Fonts</strong> provides the lettering, so your browser fetches fonts from Google.
        </li>
        <li>
          <strong>Stay22</strong> runs the "Find hotels" buttons. They're affiliate links: if you book a stay after following one, we may earn a commission, at no extra
          cost to you. We only send the place you're looking at. Once you're on Stay22 or the booking site it takes you to, their own privacy policy and cookies apply.
        </li>
        <li>
          <strong>Travelpayouts</strong> runs the "Find flights" buttons, which open a flight search on Aviasales. They're affiliate links too, so we may earn a
          commission if you book. We only send the two airports. Once you're on Aviasales, its own privacy policy and cookies apply.
        </li>
        <li>
          <strong>Pixabay</strong> provides the cover photos to pick from. We search it for the places on your trip or idea from our server, and your browser loads the
          small previews from Pixabay directly. A photo you pick is copied to somewhere🎉, so it loads from us after that.
        </li>
        <li>If you add your own cover photo link, the picture loads from whichever site it's hosted on.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Sign-in links expire after 20 minutes and are deleted within a day. Your family's data stays until the organiser deletes it. Deleting your account in Settings removes everything straight away. Signing
        out ends that device's session straight away.
      </p>

      <h2>Your rights</h2>
      <p>
        Under UK data protection law you can ask to see, correct or delete the data we hold about you, or object to how it's used. The organiser can remove people, delete
        trips and ideas, or delete the whole account and everything in it from Settings. For anything else, <Contact>contact us</Contact>. You can also complain to the Information
        Commissioner's Office (ico.org.uk).
      </p>
      <p>somewhere🎉 is for families planning holidays together. The organiser should be an adult, and decides who in the family gets the link.</p>

      <h2>Changes</h2>
      <p>If we change what we collect, we'll update this page and the date at the top.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1 className="display">Terms of use</h1>
      <p className="muted small">Last updated {UPDATED}</p>
      <p>By using somewhere🎉 you agree to these terms. They're short, and in plain English.</p>

      <h2>The service</h2>
      <p>
        somewhere🎉 is a free tool for families to keep track of their holidays and pick the next one. It's run by one person as an independent project and is provided as it
        is. We try to keep it running and your data safe, but we can't promise it will always be available or error free, so keep a copy of anything you can't lose.
      </p>

      <h2>Your account and family link</h2>
      <ul>
        <li>The organiser signs in with their email address and must be 18 or over. They're responsible for who they share the family link with.</li>
        <li>Anyone with the family link can add and change ideas and trips and take part in draws. If it gets out, reset it in Settings.</li>
        <li>Only use an email address that's yours.</li>
      </ul>

      <h2>What you add</h2>
      <p>
        What your family puts in somewhere🎉 stays yours. You give us permission to store it and show it to people with access to your family, which we need to run the service.
        Don't add anything illegal, offensive or that you don't have the right to share, and don't try to break, overload or get into parts of the site that aren't yours.
      </p>

      <h2>The draw and travel details</h2>
      <p>
        The draw is a bit of fun to help you decide. Travel times, maps and place details are rough estimates. Check them, and anything else, before you book. We're not
        responsible for travel plans or bookings you make. The "Find flights" and "Find hotels" buttons are affiliate links, so we may earn a commission if you book, and the booking is
        between you and the site you book with.
      </p>

      <h2>Ending things</h2>
      <p>
        You can stop using somewhere🎉 at any time. The organiser can delete the account and all of the family's data from Settings. We may suspend families that break these terms, or close the service, and if we do we'll
        try to give you notice so you can save your data.
      </p>

      <h2>Liability</h2>
      <p>
        As far as the law allows, we're not liable for any loss from using somewhere🎉. Nothing here limits rights you have that can't be excluded by law. These terms are under
        the law of England and Wales.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will change the date at the top when we do. Questions? <Contact>Contact us</Contact>. See also our <a href="/privacy">privacy policy</a>.
      </p>
    </>
  );
}
