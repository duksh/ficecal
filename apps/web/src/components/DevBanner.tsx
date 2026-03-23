// ─── DevBanner ────────────────────────────────────────────────────────────────
//
// Sticky top-of-page banner indicating this is an active-development preview.
// Dismissible per-session via localStorage so it doesn't nag returning users.

import { useState } from "react";

const STORAGE_KEY = "ficecal:dev-banner-dismissed";

export function DevBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true"
  );

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className="dev-banner" role="banner" aria-label="Development preview notice">
      <span className="dev-banner__icon" aria-hidden="true">🚧</span>
      <span className="dev-banner__text">
        <strong>Active development preview</strong>
        {" — "}FiceCal v2 is under active development on the{" "}
        <code>develop</code> branch. Expect frequent updates and breaking changes.
      </span>
      <a
        className="dev-banner__link"
        href="https://github.com/duksh/ficecal/tree/develop"
        target="_blank"
        rel="noopener noreferrer"
      >
        View on GitHub ↗
      </a>
      <button
        className="dev-banner__dismiss"
        onClick={dismiss}
        aria-label="Dismiss development banner"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
