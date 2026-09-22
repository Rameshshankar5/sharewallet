import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  Copy, KeyRound, LogOut, Moon, ShieldCheck, Smartphone, Sun, Users2,
} from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme, type ThemePreference } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { APP_NAME } from '../../../lib/app';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Avatar } from '../../../components/Avatar';
import { ListRow } from '../../../components/ListRow';
import { SectionHeader } from '../../../components/SectionHeader';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { SegmentedControl } from '../../../components/SegmentedControl';

export default function AccountScreen() {
  const { profile, signOut } = useAuth();
  const { users, expenses } = useData();
  const { c, isDark, preference, setPreference } = useTheme();
  const [copied, setCopied] = useState(false);

  const me = profile!;
  const isAdmin = me.role === 'superadmin';

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'You will need your email and password to get back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => { signOut(); } },
      ],
    );
  };

  const copyEmail = async () => {
    await Clipboard.setStringAsync(me.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title">Account</Text>

        <Card style={styles.profileCard}>
          <Avatar uid={me.uid} name={me.displayName} size={64} />
          <View style={styles.profileText}>
            <Text variant="heading" numberOfLines={1}>{me.displayName}</Text>
            <Text variant="small" tone="muted" numberOfLines={1}>{me.email}</Text>
            {isAdmin ? (
              <View style={[styles.roleChip, { backgroundColor: c.primarySoft }]}>
                <ShieldCheck size={13} color={c.primary} strokeWidth={2.4} />
                <Text variant="caption" tone="primary">Group admin</Text>
              </View>
            ) : null}
          </View>
        </Card>

        {copied ? (
          <Banner tone="success" title="Email copied" message="Paste it wherever you need it." />
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Your group" />
          <Card flush>
            <ListRow
              leading={<Users2 size={20} color={c.textMuted} strokeWidth={2.2} />}
              title={`${users.filter((u) => u.active).length} active members`}
              subtitle={`${expenses.filter((e) => !e.deleted).length} expenses you can see`}
              divider
            />
            <ListRow
              leading={<Copy size={20} color={c.textMuted} strokeWidth={2.2} />}
              title="Copy my email"
              subtitle={me.email}
              onPress={copyEmail}
            />
          </Card>
        </View>

        {isAdmin ? (
          <View style={styles.section}>
            <SectionHeader title="Admin" hint="Only you can do these" />
            <Card flush>
              <ListRow
                leading={<ShieldCheck size={20} color={c.primary} strokeWidth={2.2} />}
                title="Manage members"
                subtitle="Create accounts, pause access, rename people"
                chevron
                onPress={() => router.push('/admin/users')}
              />
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Settings" />
          <Card flush>
            <ListRow
              leading={<KeyRound size={20} color={c.textMuted} strokeWidth={2.2} />}
              title="Change password"
              chevron
              divider
              onPress={() => router.push('/settings/password')}
            />
            <ListRow
              leading={
                isDark
                  ? <Moon size={20} color={c.textMuted} strokeWidth={2.2} />
                  : <Sun size={20} color={c.textMuted} strokeWidth={2.2} />
              }
              title="Appearance"
              subtitle={
                preference === 'system'
                  ? `Following your phone (${isDark ? 'dark' : 'light'})`
                  : `Always ${preference}, whatever your phone is set to`
              }
            />
            <View style={styles.appearance}>
              <SegmentedControl<ThemePreference>
                value={preference}
                onChange={setPreference}
                segments={[
                  { value: 'system', label: 'System', Icon: Smartphone },
                  { value: 'light', label: 'Light', Icon: Sun },
                  { value: 'dark', label: 'Dark', Icon: Moon },
                ]}
              />
            </View>
          </Card>
        </View>

        {/* Kept well away from the rest — a destructive action shouldn't sit */}
        {/* next to things people tap casually. */}
        <View style={styles.danger}>
          <Button label="Sign out" variant="danger" icon={LogOut} onPress={confirmSignOut} full />
        </View>

        <Text variant="caption" tone="faint" center style={styles.version}>
          {APP_NAME} · private build for you and your friends
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.huge, gap: space.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  profileText: { flex: 1, gap: 2 },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    alignSelf: 'flex-start', marginTop: space.xs,
    paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill,
  },
  section: { marginTop: space.md },
  appearance: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  danger: { marginTop: space.xxl },
  version: { marginTop: space.lg },
});
