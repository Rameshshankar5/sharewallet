import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  Bell, BellOff, Camera, Copy, KeyRound, LogOut, Moon, ShieldCheck, Smartphone, Sun, Users2,
} from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme, type ThemePreference } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { APP_NAME } from '../../../lib/app';
import { Screen } from '../../../components/Screen';
import { TAB_BAR_CLEARANCE } from '../../../components/TabBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Avatar } from '../../../components/Avatar';
import { ListRow } from '../../../components/ListRow';
import { SectionHeader } from '../../../components/SectionHeader';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { usePhotoPicker } from '../../../components/usePhotoPicker';
import { imagesConfigured } from '../../../lib/cloudinaryConfig';
import { setOwnPhoto } from '../../../services/users';
import { pushConfigured, registerForPush } from '../../../services/push';

export default function AccountScreen() {
  const { profile, signOut } = useAuth();
  const { users, expenses } = useData();
  const { c, isDark, preference, setPreference } = useTheme();
  const [copied, setCopied] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);

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

  const savePhoto = useCallback(async (url: string | null) => {
    setPhotoError(null);
    try {
      await setOwnPhoto(me, url);
    } catch {
      // The upload worked and the profile write did not, so the picture exists
      // on Cloudinary but nobody can see it. Say so rather than appearing to
      // succeed.
      setPhotoError('The photo uploaded but could not be saved to your profile. Try again.');
    }
  }, [me]);

  const photo = usePhotoPicker({
    kind: 'avatar',
    value: me.photoUrl,
    onChange: (url) => { void savePhoto(url); },
    onError: setPhotoError,
  });

  // Tokens live on the profile, so "is this phone registered" is answered by
  // the profile itself rather than by a second source that can disagree.
  const notifyOn = (me.pushTokens ?? []).length > 0;

  const enableNotifications = () => {
    setPushBusy(true);
    setPushNote(null);
    void registerForPush(me.uid)
      .then((result) => {
        if (result === 'denied') {
          setPushNote(
            'Android is blocking notifications for this app. Turn them on in your '
            + 'phone settings, then come back.',
          );
        } else if (result === 'unsupported') {
          setPushNote('This build cannot receive notifications.');
        }
      })
      .catch(() => setPushNote('Could not turn notifications on. Try again.'))
      .finally(() => setPushBusy(false));
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
          {imagesConfigured ? (
            <Pressable
              onPress={photo.open}
              disabled={photo.busy}
              accessibilityRole="button"
              accessibilityLabel={me.photoUrl ? 'Change your profile picture' : 'Add a profile picture'}
              style={({ pressed }) => ({ opacity: pressed || photo.busy ? 0.6 : 1 })}
            >
              <Avatar uid={me.uid} name={me.displayName} size={64} />
              <View style={[styles.cameraBadge, { backgroundColor: c.primary, borderColor: c.card }]}>
                {photo.busy
                  ? <ActivityIndicator size="small" color={c.onPrimary} />
                  : <Camera size={13} color={c.onPrimary} strokeWidth={2.6} />}
              </View>
            </Pressable>
          ) : (
            <Avatar uid={me.uid} name={me.displayName} size={64} />
          )}
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

        {photoError ? (
          <Banner tone="error" title="Picture not changed" message={photoError} />
        ) : null}

        {pushNote ? (
          <Banner tone="warning" title="Notifications" message={pushNote} />
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
            {pushConfigured ? (
              <ListRow
                leading={
                  notifyOn
                    ? <Bell size={20} color={c.positive} strokeWidth={2.2} />
                    : <BellOff size={20} color={c.textMuted} strokeWidth={2.2} />
                }
                title="Notifications"
                subtitle={
                  pushBusy
                    ? 'Turning them on\u2026'
                    : notifyOn
                      ? 'On for this phone — you will be told when an expense involves you.'
                      : 'Off for this phone. Turn them on to hear about new expenses.'
                }
                divider
                onPress={notifyOn || pushBusy ? undefined : enableNotifications}
                chevron={!notifyOn && !pushBusy}
              />
            ) : null}

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
      {photo.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: TAB_BAR_CLEARANCE, gap: space.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  profileText: { flex: 1, gap: 2 },
  cameraBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
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
