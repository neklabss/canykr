import type { Metadata } from 'next';

/** Account & authenticated pages are never indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <div className="container page">{children}</div>;
}
