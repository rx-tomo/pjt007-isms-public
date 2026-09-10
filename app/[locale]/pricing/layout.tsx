import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Pricing remains a public practical-verification surface until commercial
// pricing, terms, and real billing readiness are approved.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
