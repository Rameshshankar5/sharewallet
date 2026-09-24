import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { savePendingInvite } from '../../lib/pendingInvite';
import { isInviteCode } from '../../lib/links';
import { Loading } from '../../components/Loading';

/**
 * Where an invite link lands: https://<project>.web.app/i/<code>.
 *
 * It sits outside the signed-in part of the app because the person tapping it
 * may not have an account yet. The code is put aside first, then they go
 * wherever their account state says; the signed-in layout picks the code up
 * again as soon as they are in.
 */
export default function InviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'booting') return;
    const value = String(code ?? '');
    if (status === 'ready') {
      // Already in: answer it now. Replacing keeps the link itself out of
      // the back stack.
      router.replace(isInviteCode(value) ? `/invite/${value}` : '/(app)/(tabs)');
      return;
    }
    void savePendingInvite(value).then(() => router.replace('/'));
  }, [code, status]);

  return <Loading label="Opening your invite…" />;
}
