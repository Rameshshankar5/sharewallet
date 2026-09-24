import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';

/**
 * The landing route picks a destination from the auth state.
 *
 * It must not redirect into the app unconditionally: on a cold start the saved
 * session has not been restored yet, so sending everyone to the tabs mounts
 * screens that expect a signed-in profile and crashes before the guard in the
 * root layout gets a chance to redirect.
 */
export default function Index() {
  const { status } = useAuth();

  switch (status) {
    case 'booting':
      return <Loading label="Signing you in…" />;
    case 'ready':
      return <Redirect href="/(app)/(tabs)" />;
    case 'mustChangePassword':
      return <Redirect href="/change-password" />;
    case 'signedOut':
      return <Redirect href="/login" />;
    case 'verifyEmail':
      return <Redirect href="/verify-email" />;
    case 'finishSignup':
      return <Redirect href="/finish-signup" />;
    default:
      return <Redirect href="/blocked" />;
  }
}
