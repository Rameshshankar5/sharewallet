import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../theme/ThemeProvider';
import { avatarColorFor } from '../theme/tokens';
import { useDataOptional } from '../context/DataContext';
import { avatarUrl } from '../lib/cloudinary';
import { Text } from './Text';

interface Props {
  uid: string;
  name: string;
  size?: number;
  /** Draws a ring — used to mark "you" in a list of people. */
  highlighted?: boolean;
  /**
   * Overrides the looked-up picture. Only needed where the person is not in
   * the signed-in user's directory — previewing a photo before it is saved,
   * for instance.
   */
  photoUrl?: string | null;
}

/** Initials from the first and last word, e.g. "Kasun Perera" -> "KP". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ uid, name, size = 40, highlighted, photoUrl }: Props) {
  const { c } = useTheme();
  const bg = avatarColorFor(uid);

  // Looked up rather than passed in, so every avatar already placed around the
  // app picks up a picture without each caller having to thread one through.
  // Optional because this also renders where there is no session to look in.
  const data = useDataOptional();
  const stored = photoUrl !== undefined ? photoUrl : data?.usersById[uid]?.photoUrl ?? null;
  const src = avatarUrl(stored, size);

  return (
    <View
      accessible={false}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: highlighted ? 2 : 0,
          borderColor: c.text,
        },
      ]}
    >
      {src ? (
        <Image
          source={{ uri: src }}
          style={[styles.photo, { borderRadius: size / 2 }]}
          contentFit="cover"
          // The initials underneath are the placeholder, so a slow or failed
          // load degrades to something that still identifies the person.
          transition={140}
          cachePolicy="memory-disk"
        />
      ) : (
        <Text
          variant="label"
          style={{ color: '#0B1220', fontSize: Math.round(size * 0.36) }}
        >
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
});
