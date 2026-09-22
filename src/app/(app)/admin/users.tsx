import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { PauseCircle, PlayCircle, ShieldCheck, UserPlus } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { setUserActive } from '../../../services/users';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { Card } from '../../../components/Card';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { ListRow } from '../../../components/ListRow';
import { SectionHeader } from '../../../components/SectionHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ResetRequests } from '../../../components/ResetRequests';
import type { UserProfile } from '../../../types';

export default function AdminUsersScreen() {
  const { profile } = useAuth();
  const { users } = useData();
  const { c } = useTheme();
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const me = profile!;

  // Belt and braces: the route is only reachable from an admin-only tile, and
  // firestore.rules refuse the writes anyway, but a wrong-role user who deep
  // links here should still get a clear answer rather than a broken screen.
  if (me.role !== 'superadmin') {
    return (
      <Screen>
        <AppBar title="Manage members" />
        <EmptyState
          illo="locked"
          title="Admins only"
          message="Only your group's admin can create or change accounts."
        />
      </Screen>
    );
  }

  const sorted = [...users].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'superadmin' ? -1 : 1;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const toggleActive = (target: UserProfile) => {
    const disabling = target.active;
    Alert.alert(
      disabling ? `Pause ${target.displayName}?` : `Restore ${target.displayName}?`,
      disabling
        ? 'They will be signed out of the app and cannot see anything until you turn them back on. Their existing expenses and balances are untouched.'
        : 'They will get access back immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: disabling ? 'Pause' : 'Restore',
          style: disabling ? 'destructive' : 'default',
          onPress: async () => {
            setBusyUid(target.uid);
            try { await setUserActive(target, !target.active, me); }
            catch { Alert.alert('Could not update', 'Check your connection and try again.'); }
            finally { setBusyUid(null); }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <AppBar
        title="Manage members"
        subtitle={`${users.filter((u) => u.active).length} active`}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Banner
          tone="info"
          title="You create every account"
          message="Nobody can sign themselves up. You make the account, give them the temporary password, and they choose their own on first sign-in."
        />

        <Button
          label="Create an account"
          icon={UserPlus}
          onPress={() => router.push('/admin/new-user')}
          full
        />

        <ResetRequests admin={me} />

        <View>
          <SectionHeader title="Members" />
          <View style={styles.list}>
            {sorted.map((u) => (
              <Card key={u.uid} flush style={styles.row}>
                <ListRow
                  leading={<Avatar uid={u.uid} name={u.displayName} size={42} highlighted={u.uid === me.uid} />}
                  title={`${u.displayName}${u.uid === me.uid ? ' (you)' : ''}`}
                  subtitle={[
                    u.email,
                    u.role === 'superadmin' ? 'Admin' : null,
                    !u.active ? 'Paused' : null,
                    u.mustChangePassword ? 'Has not set a password yet' : null,
                  ].filter(Boolean).join(' · ')}
                  trailing={
                    u.role === 'superadmin' ? (
                      <View style={[styles.badge, { backgroundColor: c.primarySoft }]}>
                        <ShieldCheck size={16} color={c.primary} strokeWidth={2.4} />
                      </View>
                    ) : (
                      <Button
                        label={u.active ? 'Pause' : 'Restore'}
                        variant={u.active ? 'secondary' : 'primary'}
                        icon={u.active ? PauseCircle : PlayCircle}
                        loading={busyUid === u.uid}
                        onPress={() => toggleActive(u)}
                      />
                    )
                  }
                />
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.huge, gap: space.lg },
  list: { gap: space.sm },
  row: { borderRadius: radius.md, overflow: 'hidden' },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
