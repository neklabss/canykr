import { Suspense } from 'react';
import { SettingsForm } from '@/components/forms';

export default function Page() {
  return (
    <Suspense>
      <SettingsForm />
    </Suspense>
  );
}
