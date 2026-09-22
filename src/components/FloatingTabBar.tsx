import React from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle, useDerivedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, font } from '../theme/tokens';
import { Text } from './Text';

const BAR_HEIGHT = 64;
const INDICATOR = 54;
const ICON_SIZE = 23;
const SIDE_MARGIN = space.lg;

/**
 * Vertical geometry, all measured up from the bottom of the bar so the numbers
 * can be checked against each other instead of tuned by eye.
 */
/** Where a resting icon sits. */
const ICON_REST_Y = 32;
/** Where the indicator's centre sits — above the bar's top edge. */
const INDICATOR_Y = BAR_HEIGHT - 4;
/** Room above the bar for the part of the indicator that escapes it. */
const OVERHANG = INDICATOR / 2 + 6;

const SPRING = { damping: 17, stiffness: 165, mass: 0.9 };

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

  const progress = useDerivedValue(() => withSpring(focused ? 1 : 0, SPRING), [focused]);

  // The resting icon fades out as the indicator arrives, because the indicator
  // carries its own copy of the icon. Two icons briefly crossing looks like a
  // glitch; one handing over to the other does not.
  const restingIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -10 * progress.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 170 }),
    transform: [{ translateY: (1 - progress.value) * 6 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      // Only the selected tab shows a label, so the name has to be spoken here
      // or three of the four tabs are unlabelled to a screen reader.
      accessibilityLabel={accessibilityLabel}
      style={styles.item}
    >
      <Animated.View style={[styles.restingIcon, restingIconStyle]} pointerEvents="none">
        <Icon size={ICON_SIZE} color={c.textMuted} strokeWidth={2.1} />
      </Animated.View>

      <Animated.View style={[styles.labelSlot, labelStyle]} pointerEvents="none">
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: c.text, fontFamily: font.bodyStrong.fontFamily }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * A floating bar with one indicator that slides between tabs, the active icon
 * riding inside it.
 *
 * The icon is a child of the indicator rather than of the tab. On Android the
 * indicator needs an elevation to sit above the bar, and elevation also puts
 * it above anything drawn beside it — so an icon left in the tab underneath
 * disappeared behind the disc. Nesting it makes the two impossible to
 * misalign, and impossible to stack in the wrong order.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const count = state.routes.length;
  const slot = (width - SIDE_MARGIN * 2) / count;

  // Driven by the navigation state, not by taps, so the indicator follows a
  // back gesture or a deep link just as it follows a press.
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: withSpring(state.index * slot + slot / 2 - INDICATOR / 2, SPRING),
    }],
  }));

  const activeRoute = state.routes[state.index];
  const ActiveIcon = descriptors[activeRoute.key].options.tabBarIcon as unknown as LucideIcon;

  return (
    <View
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space.md) }]}
      pointerEvents="box-none"
    >
      <View style={styles.stack} pointerEvents="box-none">
        <View
          style={[
            styles.bar,
            { backgroundColor: c.card, borderColor: c.border, shadowColor: '#000' },
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

        {/* Untouchable, so the press still reaches the tab underneath that put
            it here. The ring is the page colour, which is what notches it out
            of the bar's edge without any masking. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { backgroundColor: c.primary, borderColor: c.background },
            indicatorStyle,
          ]}
        >
          <ActiveIcon size={ICON_SIZE} color={c.onPrimary} strokeWidth={2.5} />
        </Animated.View>
      </View>
    </View>
  );
}

/** What a scrolling screen must leave clear at the bottom. */
export const FLOATING_TAB_CLEARANCE = BAR_HEIGHT + OVERHANG + space.lg;

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: SIDE_MARGIN,
  },
  // Tall enough to contain the indicator where it rises above the bar. Android
  // clips children that leave their parent, so the parent has to be big enough
  // rather than relying on overflow.
  stack: { height: BAR_HEIGHT + OVERHANG, justifyContent: 'flex-end' },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
      default: {},
    }),
  },
  item: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  restingIcon: {
    position: 'absolute',
    bottom: ICON_REST_Y - ICON_SIZE / 2,
    alignItems: 'center',
  },
  labelSlot: { position: 'absolute', bottom: 5 },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: INDICATOR_Y - INDICATOR / 2,
    width: INDICATOR,
    height: INDICATOR,
    borderRadius: INDICATOR / 2,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000', shadowOpacity: 0.25,
        shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
});
