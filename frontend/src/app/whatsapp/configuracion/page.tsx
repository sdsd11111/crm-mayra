// frontend/src/app/whatsapp/configuracion/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WhatsAppConfigRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/configuracion');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF3FA] to-[#E2EAF6] flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-[#1E80C1] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
