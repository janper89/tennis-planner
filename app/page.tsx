'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_REDIRECTS } from '@/lib/config';
import { getDemoRole } from '@/lib/demo-utils';
import type { UserRole } from '@/lib/config';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check for demo mode first
    const demoRole = getDemoRole();
    if (demoRole) {
      router.replace(ROLE_REDIRECTS[demoRole]);
      return;
    }

    // Otherwise redirect to login
    router.replace('/login');
  }, [router]);

  return null;
}
