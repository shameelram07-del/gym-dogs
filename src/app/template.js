'use client';

// Re-mounts on every route change, so each page glides in Apple-style.
export default function Template({ children }) {
  return <div className="gd-page">{children}</div>;
}
