import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, font } from '../theme/tokens';
import { Text } from './Text';

/** How far the active icon lifts out of the bar. */
const LIFT = 22;
const PUCK = 56;
const BAR_HEIGHT = 62;

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

  // Driven by `focused` rather than by the press, so the lift follows the
  // route that actually ended up selected — including a back gesture or a
  // deep link, where no tap happened here at all.
  const progress = useSharedValue(focused ? 1 : 0);
  progress.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 190 });

  const puckStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -LIFT * progress.value },
      { scale: 0.82 + 0.18 * progress.value },
    ],
    opacity: progress.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -LIFT * progress.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0.85, { duration: 140 }),
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
      <View style={styles.iconSlot}>
        {/* The raised disc. It sits behind the icon and carries the ring, so
            the icon itself never moves relative to its own label. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.puck,
            { backgroundColor: c.primary, borderColor: c.background },
            puckStyle,
          ]}
        />
        <Animated.View style={iconStyle}>
          <Icon
            size={22}
            color={focused ? c.onPrimary : c.textMuted}
            strokeWidth={focused ? 2.5 : 2.1}
          />
        </Animated.View>
      </View>

      <Animated.View style={labelStyle}>
        <Text
          variant="caption"
          numberOfLines={1}
          style={{
            color: focused ? c.text : c.textMuted,
            fontFamily: focused
              ? font.bodyStrong.fontFamily
              : font.caption.fontFamily,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * A floating pill tab bar with the selected tab riding above it.
 *
 * The lift is doing real work, not decoration: at a glance from arm's length
 * the raised disc says where you are without anyone having to compare four
 * icon tints. Labels stay on every tab — the shape tells you which is
 * selected, the words tell you what the others are, and an icon alone is a
 * guessing game.
 *
 * Built by hand rather than styled out of the default bar because the disc has
 * to escape the bar's bounds, and a tab bar that clips its own contents cannot
 * do that.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space.md) }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: c.card,
            borderColor: c.border,
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
    </View>
  );
}

export const FLOATING_TAB_CLEARANCE = BAR_HEIGHT + LIFT + space.xl;

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    // Lifts the bar off the textured background, which otherwise reads as
    // continuous with it and loses the pill shape entirely.
    ...Platform.select({
      ios: { shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
      default: {},
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingBottom: space.sm,
    gap: 2,
  },
  iconSlot: { alignItems: 'center', justifyContent: 'center', height: 26 },
  puck: {
    position: 'absolute',
    width: PUCK,
    height: PUCK,
    borderRadius: PUCK / 2,
    borderWidth: 4,
  },
});
