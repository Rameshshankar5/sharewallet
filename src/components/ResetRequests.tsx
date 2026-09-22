import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { onSnapshot, query, where } from 'firebase/firestore';
import { KeyRound } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';
import { resetRequestsCol } from '../services/collections';
import { approveReset, dismissReset, ResetError } from '../services/resetRequests';
import { formatDate } from '../lib/time';
import { Card } from './Card';
import { Text } from './Text';
import { Button } from './Button';
import { Banner } from './Banner';
import { ListRow } from './ListRow';
import { SectionHeader } from './SectionHeader';
import type { ResetRequest, UserProfile } from '../types';

/**
 * Pending "I've forgotten my password" requests, for the superadmin.
 *
 * Subscribed here rather than in DataContext on purpose: the rules let only
 * the superadmin read this collection, so a member holding the same listener
 * would sit on a permanent permission error for a list they must never see.
 */
export function ResetRequests({ admin }: { admin: UserProfile }) {
  const { c } = useTheme();
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onSnapshot(
    query(resetRequestsCol(), where('status', '==', 'pending')),
    (snap) => setRequests(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ResetRequest))
        .sort((a, b) => b.requestedAt - a.requestedAt),
    ),
    // A listener that dies silently would hide requests forever. Say so.
    () => setError('Could not load password requests. Check your connection.'),
  ), []);

  if (requests.length === 0 && !error) return null;

  const approve = (request: ResetRequest) => {
    Alert.alert(
      'Send a reset link?',
      `Firebase will email ${request.email} a link to choose a new password. `
      + 'You will not see or set the password yourself.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send link',
          onPress: async () => {
            setBusyId(request.id);
            setError(null);
            try {
              await approveReset(request, admin);
            } catch (e) {
              setError(e instanceof ResetError ? e.message : 'Could not send the reset email.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const dismiss = async (request: ResetRequest) => {
    setBusyId(request.id);
    setError(null);
    try {
      await dismissReset(request, admin);
    } catch {
      setError('Could not dismiss that request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View>
      <SectionHeader
        title="Password requests"
        hint={requests.length > 0 ? `${requests.length} waiting on you` : undefined}
      />

      {error ? <Banner tone="error" title="Problem" message={error} /> : null}

      <View style={styles.list}>
        {requests.map((r) => (
          <Card key={r.id} flush style={styles.card}>
            <ListRow
              leading={
                <View style={[styles.icon, { backgroundColor: c.warningSoft }]}>
                  <KeyRound size={20} color={c.warning} strokeWidth={2.2} />
                </View>
              }
              title={r.email}
              subtitle={`Asked ${formatDate(r.requestedAt)}`}
            />
            <View style={styles.actions}>
              <Button
                label="Send reset link"
                onPress={() => approve(r)}
                loading={busyId === r.id}
                disabled={busyId !== null}
              />
              <Button
                label="Dismiss"
                variant="ghost"
                onPress={() => { void dismiss(r); }}
                disabled={busyId !== null}
              />
            </View>
          </Card>
        ))}
      </View>

      <Text variant="caption" tone="faint" style={styles.note}>
        Anyone can send one of these from the login screen, so treat an address
        you do not recognise as junk and dismiss it. Approving only emails that
        address — it never changes a password by itself.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  card: { borderRadius: radius.md, overflow: 'hidden' },
  icon: {
    width: 38, height: 38, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row', gap: space.sm, flexWrap: 'wrap',
    paddingHorizontal: space.lg, paddingBottom: space.md,
  },
  note: { marginTop: space.sm },
});
