import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

const BACKGROUNDS = {
  light: require('../../assets/images/bg-light.jpg'),
  dark: require('../../assets/images/bg-dark.jpg'),
};

/**
 * How much of the flat theme colour is laid over the texture.
 *
 * The texture is decoration; the figures on top are the point. Without this
 * the light patches behind pale text, and the bright patches behind dark text,
 * drop the contrast below what is readable — and a balance you have to squint
 * at is worse than no texture at all. Enough of the pattern survives to be
 * seen, and nothing has to be read through its busiest parts.
 */
const SCRIM = { light: 0.62, dark: 0.68 };

interface Props {
  children: React.ReactNode;
  /** Which safe-area edges to pad. Screens with a bottom bar drop 'bottom'. */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, edges = ['top', 'left', 'right'], style }: Props) {
  const { c, scheme } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <Image
        source={BACKGROUNDS[scheme]}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        // Decoration: a screen reader should walk straight past it.
        accessible={false}
        // No fade. The texture arriving a beat after the content reads as a
        // glitch on a screen you open many times a day.
        transition={0}
        cachePolicy="memory-disk"
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: c.background, opacity: SCRIM[scheme] },
        ]}
      />

      <SafeAreaView edges={edges} style={styles.root}>
        <View style={[styles.inner, style]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
});
