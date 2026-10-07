import { useEffect } from "react";
import type { ReactNode } from "react";

/** A sheet over the page. A `bare` sheet draws its own header, so it can keep it pinned while the rest scrolls. */
export function Modal({ title, onClose, children, bare = false }: { title: string; onClose: () => void; children: ReactNode; bare?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={bare ? "sheet bare" : "sheet"} role="dialog" aria-modal="true" aria-label={title}>
        {!bare && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
