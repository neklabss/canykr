import { Suspense } from 'react';
import { SignUpForm } from '@/components/forms';

export default function Page() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
