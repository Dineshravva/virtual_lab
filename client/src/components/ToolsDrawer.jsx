import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Collapsible side-drawer that hosts Predict-Then-Observe, Quiz,
 * Glossary, and AI Assistant panels.
 *
 * Hidden by default.  The toggle button is a hamburger / X that sits
 * at the right edge of the toolbar area and slides with the drawer.
 */
export default function ToolsDrawer({ children }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef(null);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Close drawer with Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Close drawer when clicking outside on narrow screens
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target) &&
        !e.target.closest('[data-drawer-toggle]')
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <>
      {/* Toggle button — fixed to the right side of the viewport */}
      <button
        type="button"
        data-drawer-toggle
        onClick={toggle}
        aria-label={open ? 'Close tools panel' : 'Open tools panel'}
        className="tools-drawer-toggle"
        style={{
          /* Shift with drawer when open */
          right: open ? '340px' : '0px',
        }}
      >
        {open ? (
          /* X icon */
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          /* Hamburger icon */
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        )}
        <span className="tools-drawer-toggle-label">
          {open ? '' : 'Tools'}
        </span>
      </button>

      {/* Backdrop overlay for mobile / small widths */}
      {open && (
        <div
          className="tools-drawer-backdrop"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <aside
        ref={drawerRef}
        className={`tools-drawer ${open ? 'tools-drawer--open' : ''}`}
      >
        <div className="tools-drawer-header">
          <h3 className="tools-drawer-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.7 }}
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Learning Tools
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="tools-drawer-close"
            aria-label="Close tools panel"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="tools-drawer-body">
          {children}
        </div>
      </aside>
    </>
  );
}
