import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DoorOpen, UserPlus } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { space } from '../../../theme/tokens';
import {
  acceptFriendInvite, acceptRoomInvite, InviteError, inviteState, loadInvite,
} from '../../../services/invites';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { EmptyState } from '../../../components/EmptyState';
import { Loading } from '../../../components/Loading';
import { Glyph } from '../../../components/Glyph';
import { roomIcon } from '../../../components/icons';
import type { Invite } from '../../../types';

/**
 * Somebody's invite, and the one question it asks.
 *
 * Nothing happens on opening the link alone. Connecting lets two people see
 * each other's email and share expenses, so it is always a tap somebody chose
 * to make — never a side effect of a link that got forwarded further than
 * intended.
 */
export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { profile } = useAuth();
  const { connectedIds, roomsById, usersById } = useData();
  const { c } = useTheme();
  const me = profile!;

  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Where to go once the live data has caught up with the accept. */
  const [target, setTarget] = useState<{ kind: 'friend' | 'room'; id: string } | null>(null);

  useEffect(() => {
    loadInvite(String(code ?? ''))
      .then(setInvite)
      .catch(() => setLoadFailed(true));
  }, [code]);

  // Opening the friend or room straight after accepting would show "not
  // found" for the moment it takes the listeners to deliver it. Wait for it,
  // but not for ever.
  const arrived = target
    ? (target.kind === 'room' ? !!roomsById[target.id] : !!usersById[target.id])
    : false;
  useEffect(() => {
    if (!target) return;
    const go = () => router.replace(target.kind === 'room' ? `/room/${target.id}` : `/friend/${target.id}`);
    if (arrived) { go(); return; }
    const t = setTimeout(go, 5000);
    return () => clearTimeout(t);
  }, [target, arrived]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)'));

  if (loadFailed) {
    return (
      <Screen>
        <AppBar title="Invite" leading="close" onLeadingPress={close} />
        <EmptyState
          illo="locked"
          title="Could not open this invite"
          message="Check your connection and open the link again."
          action={<Button label="Close" variant="secondary" onPress={close} />}
        />
      </Screen>
    );
  }

  if (invite === undefined || target) return <Loading label={target ? 'Opening…' : undefined} />;

  if (invite === null) {
    return (
      <Screen>
        <AppBar title="Invite" leading="close" onLeadingPress={close} />
        <EmptyState
          illo="locked"
          title="This link does not work"
          message="It may have been copied incompletely. Ask the person who sent it for a fresh one."
          action={<Button label="Close" variant="secondary" onPress={close} />}
        />
      </Screen>
    );
  }

  const state = inviteState(invite);
  const isRoom = invite.kind === 'room';
  const alreadyIn = isRoom
    ? !!(invite.roomId && roomsById[invite.roomId])
    : connectedIds.includes(invite.createdBy);
  const own = invite.createdBy === me.uid;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isRoom) {
        setTarget({ kind: 'room', id: await acceptRoomInvite(invite, me) });
      } else {
        setTarget({ kind: 'friend', id: await acceptFriendInvite(invite, me) });
      }
    } catch (e) {
      setError(e instanceof InviteError
        ? e.message
        : 'Could not accept the invite. Check your connection and try again.');
      setBusy(false);
    }
  };

  const openExisting = () => {
    if (isRoom && invite.roomId) router.replace(`/room/${invite.roomId}`);
    else router.replace(`/friend/${invite.createdBy}`);
  };

  let title: string;
  let message: string;
  if (own) {
    title = 'This is your own link';
    message = isRoom
      ? `Send it to friends you want in ${invite.roomName ?? 'this room'}.`
      : 'Send it to a friend; when they open it they can connect with you.';
  } else if (alreadyIn) {
    title = isRoom ? `You're already in ${invite.roomName ?? 'this room'}` : `You're already connected with ${invite.createdByName}`;
    message = 'Nothing more to do here.';
  } else if (state !== 'live') {
    title = state === 'expired' ? 'This invite has expired' : 'This invite was switched off';
    message = `Ask ${invite.createdByName} to send you a new link.`;
  } else if (isRoom) {
    title = `Join ${invite.roomName ?? 'this room'}?`;
    message = `${invite.createdByName} invited you. Everyone in the room can see every expense added to it, and you will be able to see who else is in it.`;
  } else {
    title = `Connect with ${invite.createdByName}?`;
    message = 'You will be able to see each other’s name and email, and split expenses together.';
  }

  const canAccept = !own && !alreadyIn && state === 'live';

  return (
    <Screen>
      <AppBar title={isRoom ? 'Room invite' : 'Friend invite'} leading="close" onLeadingPress={close} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <View style={styles.faces}>
            <Avatar
              uid={invite.createdBy}
              name={invite.createdByName}
              photoUrl={invite.createdByPhoto}
              size={72}
            />
            {isRoom ? (
              <View style={[styles.roomBadge, { backgroundColor: c.primarySoft, borderColor: c.card }]}>
                <Glyph icon={roomIcon(invite.roomIcon ?? 'home')} size={22} color={c.primary} />
              </View>
            ) : null}
          </View>
          <Text variant="title" center>{title}</Text>
          <Text variant="body" tone="muted" center>{message}</Text>
        </Card>

        {error ? <Banner tone="error" title="Not accepted" message={error} /> : null}

        <View style={styles.actions}>
          {canAccept ? (
            <Button
              label={isRoom ? 'Join room' : 'Connect'}
              icon={isRoom ? DoorOpen : UserPlus}
              onPress={accept}
              loading={busy}
              full
            />
          ) : null}
          {alreadyIn && !own ? (
            <Button label={isRoom ? 'Open the room' : 'Open'} onPress={openExisting} full />
          ) : null}
          <Button label={canAccept ? 'Not now' : 'Close'} variant="ghost" onPress={close} full />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  card: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  faces: { marginBottom: space.sm },
  roomBadge: {
    position: 'absolute', right: -10, bottom: -6,
    width: 40, height: 40, borderRadius: 20, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  actions: { gap: space.md },
});
