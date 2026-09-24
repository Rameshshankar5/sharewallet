import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Archive, ArchiveRestore, Check } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { createRoom, setRoomArchived, updateRoom } from '../../../services/rooms';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { SectionHeader } from '../../../components/SectionHeader';
import { PersonToggle } from '../../../components/PersonToggle';
import { ROOM_ICONS } from '../../../components/icons';

export default function RoomFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useAuth();
  const { rooms, friends, usersById, nameOf } = useData();
  const { c } = useTheme();

  const me = profile!.uid;
  const existing = id ? rooms.find((r) => r.id === id) : undefined;
  const editing = !!id;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('home');
  const [memberIds, setMemberIds] = useState<string[]>([me]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const hydrated = useRef(false);
  useEffect(() => {
    if (!editing || !existing || hydrated.current) return;
    hydrated.current = true;
    setName(existing.name);
    setIcon(existing.icon);
    setMemberIds([...existing.memberIds]);
  }, [editing, existing]);

  // You can add the people you are connected to. Anyone already in the room
  // stays listed, so they can be taken out, even if they joined by link and
  // you have never met.
  const pool = new Map([profile!, ...friends].map((u) => [u.uid, u]));
  (existing?.memberIds ?? []).forEach((uid) => {
    const u = usersById[uid];
    if (u) pool.set(uid, u);
  });
  const candidates = [...pool.values()]
    .sort((a, b) => (a.uid === me ? -1 : b.uid === me ? 1 : a.displayName.localeCompare(b.displayName)));

  const nameError = showErrors && !name.trim() ? 'Give the room a name.' : null;
  const canSave = !!name.trim() && memberIds.length >= 1 && !saving;

  const toggle = (uid: string) => {
    if (uid === me) return; // You are always in a room you can see.
    setMemberIds((prev) => (prev.includes(uid) ? prev.filter((p) => p !== uid) : [...prev, uid]));
  };

  const save = async () => {
    setShowErrors(true);
    setError(null);
    if (!canSave) return;
    setSaving(true);
    try {
      if (editing && existing) {
        await updateRoom(existing, { name, icon, memberIds }, profile!, nameOf);
      } else {
        await createRoom({ name, icon, memberIds }, profile!);
      }
      router.back();
    } catch {
      setError('Could not save the room. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = () => {
    if (!existing) return;
    const archiving = !existing.archived;
    Alert.alert(
      archiving ? 'Archive this room?' : 'Bring this room back?',
      archiving
        ? 'It stays visible with all its history, but no new expenses can be added to it.'
        : 'The room becomes active again and can take new expenses.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: archiving ? 'Archive' : 'Restore',
          onPress: async () => {
            try {
              await setRoomArchived(existing, archiving, profile!);
              router.back();
            } catch {
              setError('Could not update the room.');
            }
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppBar title={editing ? 'Edit room' : 'New room'} leading="close" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Banner tone="error" title="Not saved" message={error} /> : null}

          <Card style={styles.block}>
            <Input
              label="Room name"
              value={name}
              onChangeText={setName}
              error={nameError}
              placeholder="Kandy trip, Flat 3B, Friday football…"
              autoCapitalize="words"
              required
            />

            <View>
              <Text variant="label" tone="muted" style={styles.label}>Icon</Text>
              <View style={styles.iconGrid}>
                {ROOM_ICONS.map(({ key, Icon, label }) => {
                  const active = key === icon;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setIcon(key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={label}
                      style={({ pressed }) => [
                        styles.iconCell,
                        {
                          backgroundColor: active ? c.primary : c.elevated,
                          borderColor: active ? c.primary : c.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Icon size={20} color={active ? c.onPrimary : c.textMuted} strokeWidth={2.2} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>

          <View style={styles.block}>
            <SectionHeader
              title="Members"
              hint="Everyone here can see every expense added to this room. To add someone you are not connected to yet, save the room and use its invite link."
            />
            <View style={styles.people}>
              {candidates.map((u) => (
                <PersonToggle
                  key={u.uid}
                  uid={u.uid}
                  name={u.displayName}
                  subtitle={u.uid === me ? 'Always a member' : u.email}
                  isYou={u.uid === me}
                  selected={memberIds.includes(u.uid)}
                  onToggle={() => toggle(u.uid)}
                  disabled={u.uid === me}
                />
              ))}
            </View>
          </View>

          {editing ? (
            <Banner
              tone="info"
              title="Membership changes are shared"
              message="Adding or removing someone updates who can see this room's expenses, and is recorded in Activity."
            />
          ) : null}

          {editing && existing ? (
            <View style={styles.block}>
              <Button
                label={existing.archived ? 'Restore room' : 'Archive room'}
                variant="secondary"
                icon={existing.archived ? ArchiveRestore : Archive}
                onPress={toggleArchive}
                full
              />
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <Button
            label={editing ? 'Save changes' : 'Create room'}
            icon={Check}
            onPress={save}
            loading={saving}
            disabled={!canSave}
            full
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  block: { gap: space.lg },
  label: { marginBottom: space.sm },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  iconCell: {
    width: 52, height: 52, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  people: { gap: space.sm },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: Platform.OS === 'ios' ? space.xxl : space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
