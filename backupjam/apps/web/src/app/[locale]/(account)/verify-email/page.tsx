import { Suspense } from 'react';
import { VerifyEmail } from '@/components/forms';

export default function Page() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
