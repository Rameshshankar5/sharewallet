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

const BAR_HEIGHT = 68;
/** Diameter of the travelling indicator that carries the active icon. */
const INDICATOR = 56;
/** How far the indicator's centre sits above the bar's top edge. */
const RISE = 26;
const SIDE_MARGIN = space.lg;

/** A spring, not a duration: the indicator should settle, not stop dead. */
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

  const progress = useDerivedValue(
    () => withSpring(focused ? 1 : 0, SPRING),
    [focused],
  );

  // The icon rides up into the indicator, which is travelling to meet it.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(RISE + 4) * progress.value }],
  }));

  // The label only exists for the selected tab, and fades up from under it.
  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 180 }),
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      // The label is invisible when inactive, so the name has to be spoken here
      // or three of the four tabs are unlabelled to a screen reader.
      accessibilityLabel={accessibilityLabel}
      style={styles.item}
    >
      <Animated.View style={iconStyle}>
        <Icon
          size={23}
          color={focused ? c.onPrimary : c.textMuted}
          strokeWidth={focused ? 2.5 : 2.1}
        />
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
 * A floating bar with a single indicator that slides between tabs, the active
 * icon riding inside it.
 *
 * One moving piece rather than four independent ones: the eye follows the
 * indicator from where it was to where it is now, so the change of screen has
 * somewhere to come from. Only the selected tab is labelled — with four
 * destinations the indicator says which, and four permanent labels under four
 * icons is more ink than the question needs.
 *
 * Built by hand rather than restyling the stock bar, which clips anything
 * leaving its bounds and so cannot let the indicator rise above its edge.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const count = state.routes.length;
  const barWidth = width - SIDE_MARGIN * 2;
  const slot = barWidth / count;

  // Driven by the navigation state rather than by taps, so the indicator
  // follows a back gesture or a deep link just as it follows a press.
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: withSpring(
        state.index * slot + slot / 2 - INDICATOR / 2,
        SPRING,
      ),
    }],
  }));

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

        {/* Drawn after the bar so it sits above it, and untouchable so the tab
            underneath still receives the press that put it here. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              backgroundColor: c.primary,
              // The ring is the page colour, which is what cuts the notch out
              // of the bar's top edge without any masking.
              borderColor: c.background,
            },
            indicatorStyle,
          ]}
        />
      </View>
    </View>
  );
}

export const FLOATING_TAB_CLEARANCE = BAR_HEIGHT + RISE + space.lg;

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: SIDE_MARGIN,
  },
  // Tall enough to hold the indicator where it rises above the bar, so it is
  // never clipped by its own parent.
  stack: { height: BAR_HEIGHT + RISE, justifyContent: 'flex-end' },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
      default: {},
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: BAR_HEIGHT,
    paddingBottom: space.md,
  },
  labelSlot: { position: 'absolute', bottom: -2 },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: BAR_HEIGHT - INDICATOR / 2 - (INDICATOR / 2 - RISE),
    width: INDICATOR,
    height: INDICATOR,
    borderRadius: INDICATOR / 2,
    borderWidth: 5,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 14 },
      default: {},
    }),
  },
});
