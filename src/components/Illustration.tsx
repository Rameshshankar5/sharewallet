import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

export type IlloName = 'balance' | 'rooms' | 'activity' | 'people' | 'settled' | 'locked';

interface Props {
  name: IlloName;
  size?: number;
}

/**
 * Flat vector scenes, drawn from theme tokens so they recolour with dark/light
 * instead of being flat PNGs that look wrong in one mode. Everything is a plain
 * shape — no gradients, no raster assets, crisp at any density.
 */
export function Illustration({ name, size = 160 }: Props) {
  const { c } = useTheme();
  const fill = c.illoFill;
  const ink = c.illoInk;
  const accent = c.illoAccent;

  const common = { width: size, height: size, viewBox: '0 0 200 200' } as const;

  switch (name) {
    case 'balance':
      return (
        <Svg {...common}>
          <Ellipse cx={100} cy={172} rx={62} ry={9} fill={fill} />
          <Rect x={96} y={54} width={8} height={96} rx={4} fill={ink} />
          <Rect x={70} y={146} width={60} height={9} rx={4.5} fill={ink} />
          <Rect x={40} y={50} width={120} height={7} rx={3.5} fill={ink} />
          <Circle cx={100} cy={40} r={11} fill={accent} />
          <G>
            <Path d="M22 57 L58 57 L46 92 L34 92 Z" fill={fill} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
            <Path d="M142 57 L178 57 L166 92 L154 92 Z" fill={accent} opacity={0.35} stroke={accent} strokeWidth={5} strokeLinejoin="round" />
          </G>
        </Svg>
      );

    case 'rooms':
      return (
        <Svg {...common}>
          <Ellipse cx={100} cy={172} rx={66} ry={9} fill={fill} />
          <Rect x={32} y={78} width={62} height={84} rx={10} fill={fill} stroke={ink} strokeWidth={5} />
          <Rect x={106} y={54} width={62} height={108} rx={10} fill={fill} stroke={ink} strokeWidth={5} />
          <Rect x={48} y={98} width={30} height={8} rx={4} fill={ink} opacity={0.55} />
          <Rect x={48} y={118} width={20} height={8} rx={4} fill={ink} opacity={0.35} />
          <Rect x={122} y={78} width={30} height={8} rx={4} fill={accent} />
          <Rect x={122} y={98} width={22} height={8} rx={4} fill={ink} opacity={0.35} />
          <Circle cx={137} cy={134} r={14} fill={accent} opacity={0.35} stroke={accent} strokeWidth={4} />
        </Svg>
      );

    case 'activity':
      return (
        <Svg {...common}>
          <Ellipse cx={100} cy={172} rx={60} ry={9} fill={fill} />
          <Rect x={44} y={30} width={112} height={128} rx={12} fill={fill} stroke={ink} strokeWidth={5} />
          <Circle cx={68} cy={62} r={7} fill={accent} />
          <Rect x={84} y={57} width={56} height={9} rx={4.5} fill={ink} opacity={0.6} />
          <Circle cx={68} cy={94} r={7} fill={ink} opacity={0.45} />
          <Rect x={84} y={89} width={44} height={9} rx={4.5} fill={ink} opacity={0.35} />
          <Circle cx={68} cy={126} r={7} fill={ink} opacity={0.3} />
          <Rect x={84} y={121} width={52} height={9} rx={4.5} fill={ink} opacity={0.25} />
        </Svg>
      );

    case 'people':
      return (
        <Svg {...common}>
          <Ellipse cx={100} cy={172} rx={62} ry={9} fill={fill} />
          <Circle cx={68} cy={74} r={22} fill={fill} stroke={ink} strokeWidth={5} />
          <Path d="M32 148 a36 36 0 0 1 72 0 Z" fill={fill} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
          <Circle cx={134} cy={86} r={18} fill={accent} opacity={0.3} stroke={accent} strokeWidth={5} />
          <Path d="M104 150 a30 30 0 0 1 60 0 Z" fill={accent} opacity={0.3} stroke={accent} strokeWidth={5} strokeLinejoin="round" />
        </Svg>
      );

    case 'settled':
      return (
        <Svg {...common}>
          <Ellipse cx={100} cy={172} rx={58} ry={9} fill={fill} />
          <Circle cx={100} cy={92} r={54} fill={fill} stroke={accent} strokeWidth={6} />
          <Path
            d="M74 92 L94 112 L128 74"
            fill="none" stroke={accent} strokeWidth={9}
            strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      );

    case 'locked':
    default:
      return (
        <Svg {...common}>
          <Ellipse cx={100} cy={172} rx={56} ry={9} fill={fill} />
          <Path
            d="M72 82 V64 a28 28 0 0 1 56 0 V82"
            fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round"
          />
          <Rect x={54} y={82} width={92} height={72} rx={14} fill={fill} stroke={ink} strokeWidth={5} />
          <Circle cx={100} cy={112} r={9} fill={accent} />
          <Rect x={95} y={118} width={10} height={20} rx={5} fill={accent} />
        </Svg>
      );
  }
}
