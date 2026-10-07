// The sign-in email, styled as a boarding pass to match the site.
// Email apps ignore most modern CSS, so the layout is tables with inline styles. The <style> block only adds
// phone stacking and dark colours for the apps that read it (Apple Mail, iOS Mail); everyone else gets the light version.

const C = {
  bg: "#f6f7f5",
  surface: "#ffffff",
  surface2: "#eef2ef",
  text: "#1c2421",
  muted: "#66716c",
  border: "#dde3df",
  accent: "#0f766e",
};
const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'DM Mono', ui-monospace, Menlo, Consolas, monospace";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

const label = (text: string, extra = "") =>
  `<div class="muted" style="font-family:${MONO};font-size:11px;font-weight:500;letter-spacing:0.14em;color:${C.muted};${extra}">${text}</div>`;

// One half of a ticket notch: a half circle in the page colour, cut into the card's edge.
const notch = (side: "left" | "right") => {
  const radius = side === "left" ? "0 11px 11px 0" : "11px 0 0 11px";
  const edge = side === "left" ? "border-left:0" : "border-right:0";
  return `<td width="11" style="width:11px;padding:0;line-height:0;font-size:0" valign="top"><div class="notch" style="width:10px;height:20px;background:${C.bg};border:1px solid ${C.border};${edge};border-radius:${radius}"></div></td>`;
};

export function signInEmail({ link, email, minutes }: { link: string; email: string; minutes: number }) {
  const subject = "Your somewhere🎉 sign-in link";
  const href = esc(link);
  const preheader = `Tap to sign in. The link works once and runs out in ${minutes} minutes.`;

  const text = [
    "Your sign-in link is ready",
    "",
    "Open this link to sign in to your family's holidays on somewhere🎉. No password needed.",
    "",
    link,
    "",
    `It works once and runs out in ${minutes} minutes.`,
    "",
    "Bringing everyone? Once you're in, share your family link from Settings. You each join from there.",
    "",
    "Didn't ask for this? You can ignore this email. Nobody gets in without the link.",
    "",
    "--",
    "somewhere🎉 · Where we've been, and where we're going next.",
    `This went to ${email} because someone asked to sign in to somewhere.party with it.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&amp;family=DM+Mono:wght@500&amp;display=swap" rel="stylesheet">
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
a{color:${C.accent}}
@media (max-width:600px){
  .outer{padding:24px 12px !important}
  .pad{padding-left:20px !important;padding-right:20px !important}
  .col{display:block !important;width:100% !important;padding:0 0 16px !important}
  .h1{font-size:26px !important}
}
@media (prefers-color-scheme:dark){
  body,.page,.notch{background:#0f1412 !important}
  .card{background:#18201d !important;border-color:#2c3833 !important}
  .notch{border-color:#2c3833 !important}
  .rule{border-top-color:#2c3833 !important}
  .ink{color:#e7ece9 !important}
  .muted{color:#96a29c !important}
  .code{background:#212b27 !important;color:#e7ece9 !important}
  .link{color:#2dd4bf !important}
}
</style>
</head>
<body class="page" style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background:${C.bg}">
<tr><td align="center" class="outer" style="padding:48px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${SANS};color:${C.text}">

<tr><td style="padding:0 4px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="ink" style="font-family:${SANS};font-size:22px;font-weight:800;line-height:1.2;color:${C.text}">somewhere🎉</td>
<td align="right" class="muted" style="font-family:${MONO};font-size:12px;font-weight:500;letter-spacing:0.12em;color:${C.muted}">SIGN-IN LINK</td>
</tr></table>
</td></tr>

<tr><td class="card" style="background:${C.surface};border:1px solid ${C.border};border-radius:16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

<tr><td class="pad" style="background:${C.accent};border-radius:15px 15px 0 0;padding:14px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${MONO};font-size:12px;font-weight:500;letter-spacing:0.14em;color:#ffffff">BOARDING PASS</td>
<td align="right" style="font-family:${MONO};font-size:12px;font-weight:500;letter-spacing:0.14em;color:#ffffff">GATE: YOUR INBOX</td>
</tr></table>
</td></tr>

<tr><td class="pad" style="padding:32px 32px 28px">
<h1 class="ink h1" style="margin:0 0 16px;font-family:${SANS};font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${C.text}">Your sign-in link is ready</h1>
<p class="ink" style="margin:0 0 24px;font-size:16px;line-height:1.45;color:${C.text}">Tap the button to sign in to your family's holidays. No password needed.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background:${C.accent};border-radius:10px">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px">Sign in</a>
</td></tr></table>
<p class="muted" style="margin:24px 0 12px;font-size:14px;line-height:1.45;color:${C.muted}">This link works once and runs out in ${minutes} minutes. If the button doesn't work, copy this into your browser:</p>
<div class="code" style="background:${C.surface2};border-radius:12px;padding:12px 14px;font-family:${MONO};font-size:13px;line-height:1.4;color:${C.text};word-break:break-all"><a href="${href}" class="ink" style="color:${C.text};text-decoration:none">${href}</a></div>
</td></tr>

<tr><td style="padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${notch("left")}
<td style="padding:0 11px"><div class="rule" style="border-top:2px dashed ${C.border};height:0;margin-top:9px;line-height:0;font-size:0">&nbsp;</div></td>
${notch("right")}
</tr></table>
</td></tr>

<tr><td class="pad" style="padding:20px 32px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="col" width="50%" valign="top" style="width:50%;padding-right:12px">
${label("BRINGING EVERYONE?", "margin-bottom:6px")}
<p class="ink" style="margin:0;font-size:14px;line-height:1.45;color:${C.text}">Once you're in, share your family link from ⚙️ Settings. You each join from there.</p>
</td>
<td class="col" width="50%" valign="top" style="width:50%;padding-left:12px">
${label("DIDN'T ASK FOR THIS?", "margin-bottom:6px")}
<p class="ink" style="margin:0;font-size:14px;line-height:1.45;color:${C.text}">You can ignore this email. Nobody gets in without the link.</p>
</td>
</tr></table>
</td></tr>

</table>
</td></tr>

<tr><td style="padding:32px 4px 0">
<div class="ink" style="font-family:${SANS};font-size:16px;font-weight:800;line-height:1.2;color:${C.text};margin-bottom:6px">somewhere🎉</div>
<p class="muted" style="margin:0 0 6px;font-size:14px;line-height:1.45;color:${C.muted}">Where we've been, and where we're going next.</p>
<p class="muted" style="margin:0;font-size:13px;line-height:1.45;color:${C.muted}">This went to ${esc(email)} because someone asked to sign in to <a href="https://somewhere.party/" class="link" style="color:${C.accent}">somewhere.party</a> with it.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
