import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, font } from '../theme/tokens';
import { Text } from './Text';

const BAR_HEIGHT = 62;
const ICON_SIZE = 19;
/** How far the label drops to make room for the icon appearing above it. */
const LABEL_DROP = 9;
const DURATION = 200;

interface ItemProps {
  icon: LucideIcon;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
}

function TabItem({
  icon: Icon, label, focused, onPress, onLongPress, accessibilityLabel,
}: ItemProps) {
  const { c } = useTheme();

  const progress = useDerivedValue(
    () => withTiming(focused ? 1 : 0, { duration: DURATION }),
    [focused],
  );

  // The icon rises into the space the label vacates, rather than both moving
  // at once — so the row's height never changes and nothing below it shifts.
  const iconStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: -16 * progress.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: LABEL_DROP * progress.value }],
  }));

  const underlineStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.4 + 0.6 * progress.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      style={styles.item}
    >
      <Animated.View style={[styles.icon, iconStyle]} pointerEvents="none">
        <Icon size={ICON_SIZE} color={c.primary} strokeWidth={2.3} />
      </Animated.View>

      <Animated.View style={labelStyle} pointerEvents="none">
        <Text
          variant="caption"
          numberOfLines={1}
          style={[
            styles.label,
            { color: focused ? c.primary : c.textMuted },
          ]}
        >
          {label.toUpperCase()}
        </Text>
      </Animated.View>

      {/* Colour alone never carries the state — the underline and the icon
          both say it too. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.underline, { backgroundColor: c.primary }, underlineStyle]}
      />
    </Pressable>
  );
}

/**
 * The bottom navigation.
 *
 * Every tab keeps its name, always. The selected one gains an icon above it,
 * shifts down to make room, and takes an underline — three signals for one
 * state, so it reads at a glance and still reads without colour.
 *
 * Deliberately plain after two attempts at a raised indicator: that shape
 * fought the platform (Android draws elevated views above their siblings) and
 * needed the bar to escape its own bounds. This one has nowhere to go wrong.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.card,
          borderTopColor: c.border,
          paddingBottom: insets.bottom,
          shadowColor: '#000',
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = (options.title ?? route.name) as string;
        const Icon = options.tabBarIcon as unknown as LucideIcon;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress', target: route.key, canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <TabItem
            key={route.key}
            icon={Icon}
            label={label}
            focused={focused}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
          />
        );
      })}
    </View>
  );
}

/**
 * What a scrolling screen leaves clear at the bottom.
 *
 * The safe-area inset is added by the bar itself, so this covers the bar plus
 * a little breathing room; screens that also carry a floating button add their
 * own on top.
 */
export const TAB_BAR_CLEARANCE = BAR_HEIGHT + space.xl;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...Platform.select({
      ios: { shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 12 },
      default: {},
    }),
  },
  item: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { position: 'absolute' },
  label: { letterSpacing: 0.6, fontFamily: font.label.fontFamily, fontSize: 11 },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '46%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});
