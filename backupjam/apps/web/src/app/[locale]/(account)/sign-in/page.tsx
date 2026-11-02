import { Suspense } from 'react';
import { SignInForm } from '@/components/forms';

export default function Page() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
