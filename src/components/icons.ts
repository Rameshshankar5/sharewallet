import {
  Home, Plane, UtensilsCrossed, PartyPopper, Building2, Car, Mountain,
  GraduationCap, Briefcase, ShoppingBag, Tent, Music,
  Receipt, Fuel, HeartPulse, Ticket, BedDouble, Coffee, Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import type { ExpenseCategory } from '../types';

/**
 * A curated icon set, all from one family at one stroke weight. Deliberately
 * not emoji: emoji render differently on every Android skin and iOS version,
 * can't be tinted by the theme, and read as decoration rather than as UI.
 */
export const ROOM_ICONS: { key: string; Icon: LucideIcon; label: string }[] = [
  { key: 'home', Icon: Home, label: 'Home' },
  { key: 'plane', Icon: Plane, label: 'Trip' },
  { key: 'food', Icon: UtensilsCrossed, label: 'Food' },
  { key: 'party', Icon: PartyPopper, label: 'Party' },
  { key: 'office', Icon: Building2, label: 'Office' },
  { key: 'car', Icon: Car, label: 'Road trip' },
  { key: 'mountain', Icon: Mountain, label: 'Outdoors' },
  { key: 'study', Icon: GraduationCap, label: 'Study' },
  { key: 'work', Icon: Briefcase, label: 'Work' },
  { key: 'shopping', Icon: ShoppingBag, label: 'Shopping' },
  { key: 'camp', Icon: Tent, label: 'Camping' },
  { key: 'music', Icon: Music, label: 'Music' },
];

export function roomIcon(key: string): LucideIcon {
  return ROOM_ICONS.find((r) => r.key === key)?.Icon ?? Home;
}

export const CATEGORIES: { key: ExpenseCategory; Icon: LucideIcon; label: string }[] = [
  { key: 'general', Icon: Wallet, label: 'General' },
  { key: 'food', Icon: Coffee, label: 'Food & drink' },
  { key: 'travel', Icon: Plane, label: 'Travel' },
  { key: 'stay', Icon: BedDouble, label: 'Stay' },
  { key: 'shopping', Icon: ShoppingBag, label: 'Shopping' },
  { key: 'bills', Icon: Receipt, label: 'Bills' },
  { key: 'fuel', Icon: Fuel, label: 'Fuel' },
  { key: 'entertainment', Icon: Ticket, label: 'Entertainment' },
  { key: 'health', Icon: HeartPulse, label: 'Health' },
];

export function categoryIcon(key: ExpenseCategory): LucideIcon {
  return CATEGORIES.find((c) => c.key === key)?.Icon ?? Wallet;
}

export function categoryLabel(key: ExpenseCategory): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? 'General';
}
