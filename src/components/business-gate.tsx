import type { ReactNode } from 'react';

import { Centered, ErrorState, Text } from '@/components/ui';
import type { Business } from '@/lib/data';
import { useApp } from '@/providers/app-provider';

/** Renders children only once the signed-in person's business is known. */
export function BusinessGate({ children }: { children: (business: Business) => ReactNode }) {
  const { business, businessError, reloadBusiness, t } = useApp();
  if (businessError) return <ErrorState message={businessError} onRetry={reloadBusiness} />;
  if (!business)
    return (
      <Centered>
        <Text tone="slate" style={{ textAlign: 'center' }}>
          {t.noBusiness}
        </Text>
      </Centered>
    );
  return <>{children(business)}</>;
}
