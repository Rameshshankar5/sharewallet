import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import { CURRENCY_SYMBOL, centsToInput, formatMoney, parseAmount } from '../../../lib/money';
import { recordSettlement } from '../../../services/settlements';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { Avatar } from '../../../components/Avatar';
import { ChipRow } from '../../../components/ChipRow';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { DateField } from '../../../components/DateField';

type Direction = 'iPaid' | 'theyPaid';

/**
 * Records cash actually changing hands. It doesn't erase any expense — it just
 * offsets the balance, so the history of what was spent stays intact.
 */
export default function SettleScreen() {
  const params = useLocalSearchParams<{ with?: string; amount?: string }>();
  const { profile } = useAuth();
  const { friends, ledger, nameOf, rooms } = useData();
  const { c } = useTheme();

  const me = profile!.uid;
  const [otherUid, setOtherUid] = useState(params.with ?? friends[0]?.uid ?? '');
  const [direction, setDirection] = useState<Direction>(() => {
    const seed = params.with ? ledger.between(me, params.with) : 0;
    // Default to whichever way actually clears the debt.
    return seed < 0 ? 'iPaid' : 'theyPaid';
  });
  const [amountText, setAmountText] = useState(
    params.amount ? centsToInput(Number(params.amount)) : '',
  );
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const amount = parseAmount(amountText) ?? 0;

  /**
   * Members of every room both people belong to. They need to see the payment
   * so their copy of that room's balances matches everyone else's.
   */
  const alsoVisibleTo = useMemo(() => {
    if (!otherUid) return [];
    const ids = new Set<string>();
    rooms
      .filter((r) => r.memberIds.includes(me) && r.memberIds.includes(otherUid))
      .forEach((r) => r.memberIds.forEach((m) => ids.add(m)));
    return Array.from(ids);
  }, [rooms, me, otherUid]);

  const sharedRooms = rooms.filter(
    (r) => r.memberIds.includes(me) && !!otherUid && r.memberIds.includes(otherUid),
  );
  const balance = otherUid ? ledger.between(me, otherUid) : 0;
  const suggested = Math.abs(balance);

  const amountError = showErrors && amount <= 0 ? 'Enter how much was paid.' : null;
  const canSave = !!otherUid && amount > 0 && !saving;

  const fromUid = direction === 'iPaid' ? me : otherUid;
  const toUid = direction === 'iPaid' ? otherUid : me;

  const save = async () => {
    setShowErrors(true);
    setError(null);
    if (!canSave) return;
    setSaving(true);
    try {
      await recordSettlement({ fromUid, toUid, amount, note, date, alsoVisibleTo }, profile!, nameOf);
      router.back();
    } catch (e) {
      setError((e as Error).message || 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  if (friends.length === 0) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <AppBar title="Settle up" leading="close" />
        <View style={styles.content}>
          <Banner tone="info" title="No one to settle with" message="Your admin needs to add friends first." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppBar title="Record a payment" leading="close" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Banner tone="error" title="Not saved" message={error} /> : null}

          <Card style={styles.block}>
            <ChipRow
              label="With"
              value={otherUid}
              onChange={setOtherUid}
              items={friends.map((f) => ({ value: f.uid, label: f.displayName }))}
            />

            <SegmentedControl<Direction>
              label="Which way did the money go?"
              value={direction}
              onChange={setDirection}
              segments={[
                // Same colour language as the Balances screen: red arrow out
                // for money leaving you, green arrow in for money arriving.
                { value: 'iPaid', label: 'I paid them', Icon: ArrowUpRight, tone: 'negative' },
                { value: 'theyPaid', label: 'They paid me', Icon: ArrowDownLeft, tone: 'positive' },
              ]}
            />

            <View style={[styles.flow, { backgroundColor: c.elevated }]}>
              <Avatar uid={fromUid} name={nameOf(fromUid)} size={36} highlighted={fromUid === me} />
              <ArrowRight size={18} color={c.textMuted} strokeWidth={2.4} />
              <Avatar uid={toUid} name={nameOf(toUid)} size={36} highlighted={toUid === me} />
              <Text variant="small" tone="muted" style={styles.flowText} numberOfLines={2}>
                {fromUid === me ? 'You give' : `${nameOf(fromUid)} gives`}{' '}
                {toUid === me ? 'you' : nameOf(toUid)}{' '}
                {amount > 0 ? formatMoney(amount) : 'cash'}
              </Text>
            </View>

            <Input
              label="Amount"
              value={amountText}
              onChangeText={setAmountText}
              error={amountError}
              helper={
                suggested > 0
                  ? `Outstanding between you: ${formatMoney(suggested)}`
                  : 'You are currently square with this person.'
              }
              prefix={CURRENCY_SYMBOL}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="0.00"
              required
            />

            {suggested > 0 && amount !== suggested ? (
              <Button
                label={`Use full ${formatMoney(suggested)}`}
                variant="ghost"
                onPress={() => {
                  setAmountText(centsToInput(suggested));
                  setDirection(balance < 0 ? 'iPaid' : 'theyPaid');
                }}
              />
            ) : null}

            {sharedRooms.length > 0 ? (
              <Text variant="caption" tone="faint">
                This payment settles up everywhere at once. Members of{' '}
                {sharedRooms.map((r) => r.name).join(', ')} will see it, because
                it changes the balances in {sharedRooms.length === 1 ? 'that room' : 'those rooms'}.
              </Text>
            ) : (
              <Text variant="caption" tone="faint">
                Only you and {nameOf(otherUid)} will see this payment.
              </Text>
            )}

            <DateField label="Date" value={date} onChange={setDate} />

            <Input
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="Cash, bank transfer, …"
              autoCapitalize="sentences"
            />
          </Card>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <Button label="Record payment" icon={Check} onPress={save} loading={saving} disabled={!canSave} full />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  block: { gap: space.lg },
  flow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    padding: space.md, borderRadius: radius.md,
  },
  flowText: { flex: 1 },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: Platform.OS === 'ios' ? space.xxl : space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
