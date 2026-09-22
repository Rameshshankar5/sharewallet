import React from 'react';
import type { LucideIcon } from 'lucide-react-native';

interface Props {
  icon: LucideIcon;
  size?: number;
  color: string;
  strokeWidth?: number;
}

/**
 * Renders an icon chosen at runtime.
 *
 * Assigning a looked-up component to a capitalised local inside render
 * (`const Icon = categoryIcon(x)`) reads to React's compiler as defining a new
 * component on every render, which costs it the ability to memoise the tree.
 * Passing the component through a prop instead keeps the lookup dynamic and the
 * render static.
 */
export function Glyph({ icon: Icon, size = 20, color, strokeWidth = 2.2 }: Props) {
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}
