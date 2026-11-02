import { Suspense } from 'react';
import { Dashboard } from '@/components/forms';

export default function Page() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
