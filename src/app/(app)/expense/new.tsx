import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Scale, Users } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../theme/ThemeProvider';
import { space } from '../../../theme/tokens';
import { CURRENCY_SYMBOL, centsToInput, formatMoney, parseAmount } from '../../../lib/money';
import {
  checkBalance, rebalanceUnlocked, splitEqually,
  type CentMap, type SplitMode,
} from '../../../lib/split';
import {
  ConflictError, UnbalancedError, createExpense, updateExpense,
} from '../../../services/expenses';
import { Screen } from '../../../components/Screen';
import { AppBar } from '../../../components/AppBar';
import { Text } from '../../../components/Text';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { SectionHeader } from '../../../components/SectionHeader';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { ChipRow } from '../../../components/ChipRow';
import { PersonToggle } from '../../../components/PersonToggle';
import { CalculatorButton } from '../../../components/CalculatorButton';
import { useCalculator } from '../../../components/CalculatorSheet';
import { AmountRow } from '../../../components/AmountRow';
import { DateField } from '../../../components/DateField';
import { ReceiptField } from '../../../components/ReceiptField';
import { imagesConfigured } from '../../../lib/cloudinaryConfig';
import { notifyExpense } from '../../../services/notify';
import { Loading } from '../../../components/Loading';
import { CATEGORIES } from '../../../components/icons';
import type { Expense, ExpenseCategory, UserProfile } from '../../../types';

type PayerMode = 'single' | 'multiple';

type Params = { id?: string; roomId?: string; with?: string };

export default function ExpenseFormScreen() {
  const params = useLocalSearchParams<Params>();
  const { expenses, loading } = useData();

  const existing = params.id ? expenses.find((e) => e.id === params.id) : undefined;

  // When editing, wait for the expense to arrive before building the form. The
  // form seeds every field from it on mount, so it must not mount empty and
  // then be overwritten — that fights whatever the user has already typed.
  if (params.id && !existing) {
    if (loading) return <Loading label="Opening expense\u2026" />;
    return (
      <Screen edges={['top', 'left', 'right']}>
        <AppBar title="Edit expense" leading="close" />
        <View style={styles.missing}>
          <Banner
            tone="error"
            title="Expense not found"
            message="It may have been removed, or you may no longer have access to it."
          />
        </View>
      </Screen>
    );
  }

  // Keyed so that switching target remounts the form with fresh initial values.
  return <ExpenseForm key={existing?.id ?? 'new'} existing={existing} params={params} />;
}

function ExpenseForm({ existing, params }: { existing?: Expense; params: Params }) {
  const { profile } = useAuth();
  const { rooms, friends, usersById, nameOf, roomNameOf } = useData();
  const { c } = useTheme();

  const me = profile!.uid;
  const editing = !!existing;
  const calc = useCalculator();

  // ---------------------------------------------------------------- fields
  // Every field is seeded lazily from `existing`, so an edit opens fully
  // populated on its first render.
  const [description, setDescription] = useState(() => existing?.description ?? '');
  const [note, setNote] = useState(() => existing?.note ?? '');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(() => existing?.receiptUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>(() => existing?.category ?? 'general');
  const [roomId, setRoomId] = useState<string | null>(() => existing?.roomId ?? params.roomId ?? null);
  const [date, setDate] = useState(() => existing?.date ?? Date.now());
  const [totalText, setTotalText] = useState(() => (existing ? centsToInput(existing.totalCents) : ''));

  const initialPayers = useMemo(
    () => (existing ? Object.keys(existing.payers).filter((k) => existing.payers[k] > 0) : [me]),
    [existing, me],
  );

  const [payerMode, setPayerMode] = useState<PayerMode>(
    () => (initialPayers.length > 1 ? 'multiple' : 'single'),
  );
  const [singlePayer, setSinglePayer] = useState(() => initialPayers[0] ?? me);
  const [payerIds, setPayerIds] = useState<string[]>(() => initialPayers);
  const [payerText, setPayerText] = useState<Record<string, string>>(() => (
    existing
      ? Object.fromEntries(initialPayers.map((k) => [k, centsToInput(existing.payers[k])]))
      : {}
  ));

  const [splitIds, setSplitIds] = useState<string[]>(() => {
    if (existing) return Object.keys(existing.splits);
    const seed = [me];
    if (params.with && params.with !== me) seed.push(params.with);
    return seed;
  });
  const [splitMode, setSplitMode] = useState<SplitMode>(() => existing?.splitMode ?? 'equal');
  const [exactText, setExactText] = useState<Record<string, string>>(() => (
    existing
      ? Object.fromEntries(Object.keys(existing.splits).map((k) => [k, centsToInput(existing.splits[k])]))
      : {}
  ));
  const [lockedSplits, setLockedSplits] = useState<Set<string>>(() => (
    // Exact amounts were chosen deliberately, so reopening must not recalculate
    // them out from under whoever set them.
    existing?.splitMode === 'exact' ? new Set(Object.keys(existing.splits)) : new Set()
  ));

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // ------------------------------------------------------------- selection
  const room = roomId ? rooms.find((r) => r.id === roomId) ?? null : null;

  /**
   * Picking a room narrows who you can split with to that room's members. That
   * is what keeps a room's expenses visible to exactly the room — you can't
   * accidentally include someone who then can't see it.
   */
  const candidates = useMemo(() => {
    // Outside a room, the people you are connected to. Inside one, its
    // members — everyone in a room is connected, so they are all loaded.
    const everyone = [profile!, ...friends];
    const scoped = room
      ? room.memberIds.map((id) => usersById[id]).filter((u): u is UserProfile => !!u && u.active)
      : everyone;
    // Editing an old expense must still show everyone already on it.
    const onIt = existing ? existing.participantIds : [];
    const pool = new Map(scoped.map((u) => [u.uid, u]));
    onIt.forEach((id) => { if (usersById[id] && !pool.has(id)) pool.set(id, usersById[id]); });
    return [...pool.values()].sort((a, b) => {
      if (a.uid === me) return -1;
      if (b.uid === me) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [profile, friends, usersById, room, me, existing]);

  const selectRoom = (next: string | null) => {
    setRoomId(next);
    const target = next ? rooms.find((r) => r.id === next) : null;
    if (target) {
      // Choosing a room is also the "select this group of friends" shortcut.
      setSplitIds([...target.memberIds]);
      setPayerIds((prev) => prev.filter((p) => target.memberIds.includes(p)));
      if (!target.memberIds.includes(singlePayer)) setSinglePayer(me);
    }
    setLockedSplits(new Set());
    setSplitMode('equal');
  };

  const toggleSplit = (uid: string) => {
    setSplitIds((prev) => (prev.includes(uid) ? prev.filter((p) => p !== uid) : [...prev, uid]));
    setLockedSplits((prev) => {
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
  };

  const togglePayer = (uid: string) => {
    setPayerIds((prev) => (prev.includes(uid) ? prev.filter((p) => p !== uid) : [...prev, uid]));
  };

  // ------------------------------------------------------------------ maths
  const totalCents = parseAmount(totalText) ?? 0;

  const payerCents = useMemo<CentMap>(() => {
    if (payerMode === 'single') return totalCents > 0 ? { [singlePayer]: totalCents } : {};
    const out: CentMap = {};
    payerIds.forEach((id) => { out[id] = parseAmount(payerText[id] ?? '') ?? 0; });
    return out;
  }, [payerMode, singlePayer, payerIds, payerText, totalCents]);

  const orderedSplitIds = useMemo(
    () => candidates.filter((u) => splitIds.includes(u.uid)).map((u) => u.uid),
    [candidates, splitIds],
  );

  const splitCents = useMemo<CentMap>(() => {
    const ids = orderedSplitIds;
    if (ids.length === 0) return {};

    if (splitMode === 'equal') return splitEqually(totalCents, ids);

    const current: CentMap = {};
    ids.forEach((id) => { current[id] = parseAmount(exactText[id] ?? '') ?? 0; });
    // Untouched rows soak up whatever is left, so correcting one person's
    // share doesn't force you to retype everyone else's.
    return rebalanceUnlocked(totalCents, ids, current, lockedSplits) ?? current;
  }, [orderedSplitIds, splitMode, totalCents, exactText, lockedSplits]);

  const payerCheck = checkBalance(totalCents, payerCents);
  const splitCheck = checkBalance(totalCents, splitCents);

  const descriptionError = showErrors && !description.trim() ? 'Give the expense a name.' : null;
  const totalError = showErrors && totalCents <= 0 ? 'Enter how much was spent.' : null;

  const canSave =
    !!description.trim() &&
    totalCents > 0 &&
    orderedSplitIds.length > 0 &&
    payerCheck.balanced &&
    splitCheck.balanced &&
    // Saving mid-upload would store the expense without the photo that is
    // seconds from being ready, and there is no second chance to notice.
    !uploading &&
    !saving;

  // ----------------------------------------------------------------- edits
  const editSplitAmount = (uid: string, text: string) => {
    // Typing into a row in any auto mode means "I want this exact number" —
    // so we flip to exact amounts and pin that row.
    if (splitMode !== 'exact') {
      const snapshot: Record<string, string> = {};
      orderedSplitIds.forEach((id) => { snapshot[id] = centsToInput(splitCents[id] ?? 0); });
      setExactText({ ...snapshot, [uid]: text });
      setSplitMode('exact');
    } else {
      setExactText((prev) => ({ ...prev, [uid]: text }));
    }
    setLockedSplits((prev) => new Set(prev).add(uid));
  };

  const unlockSplit = (uid: string) => {
    setLockedSplits((prev) => {
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
  };

  const resetSplit = () => {
    setSplitMode('equal');
    setLockedSplits(new Set());
    setExactText({});
  };

  const spreadRemainingToPayers = () => {
    const fixed = payerIds.filter((id) => (parseAmount(payerText[id] ?? '') ?? 0) > 0);
    const free = payerIds.filter((id) => !fixed.includes(id));
    const target = free.length > 0 ? free : payerIds;
    const fixedTotal = target === free
      ? fixed.reduce((s, id) => s + (parseAmount(payerText[id] ?? '') ?? 0), 0)
      : 0;
    const spread = splitEqually(Math.max(0, totalCents - fixedTotal), target);
    setPayerText((prev) => {
      const next = { ...prev };
      target.forEach((id) => { next[id] = centsToInput(spread[id]); });
      return next;
    });
  };

  // ------------------------------------------------------------------ save
  const handleSave = async () => {
    setShowErrors(true);
    setFormError(null);
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = {
        description, note, category, totalCents,
        payers: payerCents, splits: splitCents,
        roomId, date, splitMode, receiptUrl,
      };

      // Notified after the write, never before: telling people about an
      // expense that then failed to save is worse than not telling them.
      const participantIds = Array.from(new Set([
        ...Object.keys(payerCents), ...Object.keys(splitCents),
      ]));
      const notice = { ...payload, participantIds };

      if (editing && existing) {
        await updateExpense(existing.id, existing.version, payload, profile!, nameOf, roomNameOf);
        notifyExpense(notice, existing.id, 'updated', profile!, usersById,
          (id) => (id ? roomNameOf(id) : null));
      } else {
        const id = await createExpense(payload, profile!, nameOf);
        notifyExpense(notice, id, 'created', profile!, usersById,
          (rid) => (rid ? roomNameOf(rid) : null));
      }
      router.back();
    } catch (e) {
      if (e instanceof ConflictError) {
        Alert.alert(
          'Someone else edited this',
          `${nameOf(e.latest.updatedBy)} saved a change while you had this open. Reload to see their version — your edits here will be lost.`,
          [
            { text: 'Keep editing', style: 'cancel' },
            {
              text: 'Reload theirs',
              style: 'destructive',
              onPress: () => router.replace(`/expense/new?id=${existing!.id}`),
            },
          ],
        );
      } else if (e instanceof UnbalancedError) {
        setFormError(e.message);
      } else {
        setFormError('Could not save. Check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------ view
  const roomChips = [
    { value: '__none__', label: 'No room', Icon: Users },
    ...rooms.filter((r) => !r.archived).map((r) => ({ value: r.id, label: r.name })),
  ];

  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppBar
        title={editing ? 'Edit expense' : 'New expense'}
        subtitle={editing ? `Version ${existing?.version ?? 1} · everyone sees your changes` : undefined}
        leading="close"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {formError ? <Banner tone="error" title="Not saved" message={formError} /> : null}

          {/* ------------------------------------------------ what and how much */}
          <Card style={styles.block}>
            <Input
              label="What was it for?"
              value={description}
              onChangeText={setDescription}
              error={descriptionError}
              placeholder="Dinner at Ministry of Crab"
              autoCapitalize="sentences"
              required
            />

            <Input
              label="Total amount"
              value={totalText}
              onChangeText={setTotalText}
              error={totalError}
              helper="The full cost of the whole thing, before splitting."
              prefix={CURRENCY_SYMBOL}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="0.00"
              required
              accessory={
                <CalculatorButton
                  label="Work out the total with the calculator"
                  onPress={() => calc.open({
                    title: 'Total amount',
                    initialText: totalText,
                    onUse: setTotalText,
                  })}
                />
              }
            />

            <ChipRow<ExpenseCategory>
              label="Category"
              value={category}
              onChange={setCategory}
              items={CATEGORIES.map((c2) => ({ value: c2.key, label: c2.label, Icon: c2.Icon }))}
            />

            <ChipRow
              label="Room"
              value={roomId ?? '__none__'}
              onChange={(v) => selectRoom(v === '__none__' ? null : v)}
              items={roomChips}
            />
            <Text variant="caption" tone="faint">
              {room
                ? `Everyone in ${room.name} can see this expense.`
                : 'Only the people you split with can see this expense.'}
            </Text>

            <DateField label="Date" value={date} onChange={setDate} />
          </Card>

          {/* -------------------------------------------------------- who paid */}
          <View style={styles.block}>
            <SectionHeader
              title="Who paid"
              hint="More than one person can pay for the same thing."
            />

            <Card flush>
              <View style={styles.cardPad}>
                <SegmentedControl<PayerMode>
                  value={payerMode}
                  onChange={(m) => {
                    setPayerMode(m);
                    if (m === 'multiple' && payerIds.length === 0) setPayerIds([singlePayer]);
                  }}
                  segments={[
                    { value: 'single', label: 'One person paid' },
                    { value: 'multiple', label: 'Several people paid' },
                  ]}
                />
              </View>

              {payerMode === 'single' ? (
                <View style={styles.cardPadTight}>
                  <ChipRow
                    value={singlePayer}
                    onChange={setSinglePayer}
                    items={candidates.map((u) => ({
                      value: u.uid,
                      label: u.uid === me ? 'You' : u.displayName,
                    }))}
                  />
                  <Text variant="caption" tone="muted" style={styles.hint}>
                    {nameOf(singlePayer)} paid the full {formatMoney(totalCents)}.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.cardPadTight}>
                    <View style={styles.toggleGrid}>
                      {candidates.map((u) => (
                        <View key={u.uid} style={styles.toggleCell}>
                          <PersonToggle
                            uid={u.uid}
                            name={u.displayName}
                            isYou={u.uid === me}
                            selected={payerIds.includes(u.uid)}
                            onToggle={() => togglePayer(u.uid)}
                          />
                        </View>
                      ))}
                    </View>
                  </View>

                  {payerIds.length > 0 ? (
                    <View style={styles.rows}>
                      {candidates
                        .filter((u) => payerIds.includes(u.uid))
                        .map((u) => (
                          <AmountRow
                            key={u.uid}
                            uid={u.uid}
                            name={u.displayName}
                            isYou={u.uid === me}
                            value={payerText[u.uid] ?? ''}
                            onChangeText={(t) => setPayerText((p) => ({ ...p, [u.uid]: t }))}
                            onCalculator={() => calc.open({
                              title: u.uid === me ? 'What you paid' : `What ${u.displayName} paid`,
                              initialText: payerText[u.uid] ?? '',
                              onUse: (t) => setPayerText((p) => ({ ...p, [u.uid]: t })),
                            })}
                          />
                        ))}
                    </View>
                  ) : null}

                  <View style={styles.cardPadTight}>
                    <RemainderNotice
                      check={payerCheck}
                      total={totalCents}
                      zeroLabel="Everything paid is accounted for."
                      action={
                        !payerCheck.balanced && payerIds.length > 0 ? (
                          <Pressable onPress={spreadRemainingToPayers} hitSlop={8} accessibilityRole="button">
                            <Text variant="smallStrong" tone="primary">Split evenly</Text>
                          </Pressable>
                        ) : undefined
                      }
                    />
                  </View>
                </>
              )}
            </Card>
          </View>

          {/* ---------------------------------------------------- split between */}
          <View style={styles.block}>
            <SectionHeader
              title="Split between"
              hint="Tap any amount to type an exact figure."
              right={
                splitMode !== 'equal' || lockedSplits.size > 0 ? (
                  <Pressable onPress={resetSplit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Reset split to equal">
                    <Text variant="smallStrong" tone="primary">Reset</Text>
                  </Pressable>
                ) : undefined
              }
            />

            <Card flush>
              <View style={styles.cardPad}>
                <View style={styles.toggleGrid}>
                  {candidates.map((u) => (
                    <View key={u.uid} style={styles.toggleCell}>
                      <PersonToggle
                        uid={u.uid}
                        name={u.displayName}
                        isYou={u.uid === me}
                        selected={splitIds.includes(u.uid)}
                        onToggle={() => toggleSplit(u.uid)}
                      />
                    </View>
                  ))}
                </View>

                <View style={styles.quickRow}>
                  <Pressable
                    onPress={() => { setSplitIds(candidates.map((u) => u.uid)); resetSplit(); }}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text variant="smallStrong" tone="primary">
                      {room ? `Everyone in ${room.name}` : 'Select everyone'}
                    </Text>
                  </Pressable>
                  <Text variant="small" tone="faint">·</Text>
                  <Pressable
                    onPress={() => { setSplitIds([me]); resetSplit(); }}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text variant="smallStrong" tone="primary">Just me</Text>
                  </Pressable>
                </View>
              </View>

              {orderedSplitIds.length > 0 ? (
                <>
                  <View style={styles.cardPadTight}>
                    <SegmentedControl<SplitMode>
                      value={splitMode}
                      onChange={(m) => {
                        setSplitMode(m);
                        if (m !== 'exact') setLockedSplits(new Set());
                      }}
                      segments={[
                        { value: 'equal', label: 'Split equally' },
                        { value: 'exact', label: 'Enter amounts' },
                      ]}
                    />
                  </View>

                  <View style={styles.rows}>
                    {orderedSplitIds.map((uid) => {
                      const person = candidates.find((u) => u.uid === uid);
                      const name = person?.displayName ?? nameOf(uid);
                      const locked = lockedSplits.has(uid);
                      return (
                        <AmountRow
                          key={uid}
                          uid={uid}
                          name={name}
                          isYou={uid === me}
                          value={locked ? (exactText[uid] ?? '') : centsToInput(splitCents[uid] ?? 0)}
                          onChangeText={(t) => editSplitAmount(uid, t)}
                          onCalculator={() => calc.open({
                            title: uid === me ? 'Your share' : `${name}'s share`,
                            initialText: locked ? (exactText[uid] ?? '') : centsToInput(splitCents[uid] ?? 0),
                            onUse: (t) => editSplitAmount(uid, t),
                          })}
                          locked={locked}
                          onUnlock={() => unlockSplit(uid)}
                          hint={locked ? 'set by you' : splitMode === 'equal' ? 'equal share' : 'auto'}
                        />
                      );
                    })}
                  </View>

                  <View style={styles.cardPadTight}>
                    <RemainderNotice
                      check={splitCheck}
                      total={totalCents}
                      zeroLabel={`The split adds up to ${formatMoney(totalCents)}.`}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.cardPad}>
                  <Banner
                    tone="warning"
                    title="Nobody selected"
                    message="Pick at least one person to split this with."
                  />
                </View>
              )}
            </Card>
          </View>

          {/* -------------------------------------------------- receipt + note */}
          <Card style={styles.block}>
            {imagesConfigured ? (
              <ReceiptField
                value={receiptUrl}
                onChange={setReceiptUrl}
                onBusyChange={setUploading}
                onError={setFormError}
              />
            ) : null}
            <Input
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="Anything the others should know"
              multiline
              numberOfLines={3}
              autoCapitalize="sentences"
            />
          </Card>

          {editing ? (
            <View style={styles.block}>
              <Banner
                tone="info"
                title="This edit is recorded"
                message="Your name, the time, and every value you changed will appear in Activity for everyone who can see this expense."
              />
            </View>
          ) : null}
        </ScrollView>

        {/* Sticky footer: the balance state and the Save button stay visible */}
        {/* while scrolling, so you always know why Save is unavailable. */}
        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <View style={styles.footerSummary}>
            <Scale size={16} color={canSave ? c.positive : c.warning} strokeWidth={2.4} />
            <Text variant="caption" tone={canSave ? 'positive' : 'warning'} numberOfLines={2} style={styles.flex}>
              {canSave
                ? 'Balanced and ready to save'
                : !description.trim() ? 'Needs a description'
                : totalCents <= 0 ? 'Needs a total amount'
                : orderedSplitIds.length === 0 ? 'Pick who to split with'
                : !payerCheck.balanced
                  ? `Who paid is ${payerCheck.over ? 'over' : 'short'} by ${formatMoney(Math.abs(payerCheck.difference))}`
                  : `The split is ${splitCheck.over ? 'over' : 'short'} by ${formatMoney(Math.abs(splitCheck.difference))}`}
            </Text>
          </View>
          <Button
            label={editing ? 'Save changes' : 'Add expense'}
            icon={Check}
            onPress={handleSave}
            loading={saving}
            disabled={!canSave}
            full
          />
        </View>
      </KeyboardAvoidingView>
      {calc.sheet}
    </Screen>
  );
}

/** Live "short by / over by / balanced" readout under an editable amount list. */
function RemainderNotice({
  check, total, zeroLabel, action,
}: {
  check: { balanced: boolean; difference: number; over: boolean };
  total: number;
  zeroLabel: string;
  action?: React.ReactNode;
}) {
  if (total <= 0) {
    return <Text variant="caption" tone="faint">Enter a total amount first.</Text>;
  }
  if (check.balanced) {
    return <Banner tone="success" title="Balanced" message={zeroLabel} />;
  }
  return (
    <Banner
      tone="warning"
      title={check.over
        ? `Over by ${formatMoney(-check.difference)}`
        : `Short by ${formatMoney(check.difference)}`}
      message={check.over
        ? 'These amounts add up to more than the total.'
        : 'These amounts add up to less than the total.'}
      right={action}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  block: { gap: space.lg },
  cardPad: { padding: space.lg, gap: space.md },
  cardPadTight: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  rows: {},
  hint: {},
  toggleGrid: { gap: space.sm },
  toggleCell: {},
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: Platform.OS === 'ios' ? space.xxl : space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.md,
  },
  footerSummary: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  missing: { padding: space.lg },
});
