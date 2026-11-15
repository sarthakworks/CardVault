import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CardInput, VaultCard } from '../../core/vault/models';
import { cardBinPrefix } from './cardBinLookup';
import { cardDetailFields, cardDetailLabels, cardEntryLimits, cardExpiryInput, cardFieldLimits, cardNetworkIdentity, numericCardInput, type CardDetailField } from '../../core/validation/cardRules';
import { vaultService } from '../../core/vault/vaultService';
import { discardSessionDraft, keepSessionDraft, useSessionStore } from '../../core/security/sessionStore';
import { copySecret } from '../../core/security/clipboardGuard';
import { errorMessage } from '../../core/errors/VaultError';
import { notify, reportError } from '../../core/errors/noticeStore';
import { Screen } from '../../shared/components/Screen';
import { TextField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';
import { Dropdown, type DropdownPlacement } from '../../shared/components/Dropdown';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { useHaptics } from '../../shared/hooks/useHaptics';
import { formatCardExpiry } from '../../shared/utils/formatters';
import { cardFormSchema } from './cardFormSchema';
import { useCardBinLookup } from './useCardBinLookup';
import { useCardRemoval } from './useCardRemoval';
import { CardNetworkLogo } from './CardNetworkLogo';
import { CardEditorPreview } from './CardEditorPreview';
import { CardExpiryPicker } from './CardExpiryPicker';
import { CardReadScreen } from './CardReadScreen';
import type { CardReadMethod, CardReadReview } from './cardReadResults';

type Anchor = ComponentRef<typeof View>;
type EditorMenu = { kind: 'actions'; placement: DropdownPlacement };
const logoNetworks = new Set(['visa', 'mastercard', 'amex', 'maestro', 'rupay', 'discover', 'jcb', 'unionpay', 'diners']);

export function CardEditor({ card, onClose }: { card: VaultCard | null; onClose: () => void }) {
  const { colors } = useTheme();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const removeCard = useCardRemoval();
  const { generation, drafts } = useSessionStore.getState();
  const draftKey = card ? `card:${card.id}` : 'card:new';
  const draft = drafts[draftKey];
  const finished = useRef(false);
  const pending = useRef(false);
  const viewport = useRef<Anchor>(null);
  const moreAnchor = useRef<Anchor>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const detailsY = useRef(0);
  const pendingFocus = useRef<keyof CardInput | null>(null);
  const menuRequest = useRef(0);
  const [menu, setMenu] = useState<EditorMenu | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [reader, setReader] = useState<{ method: CardReadMethod; existing: CardReadReview } | null>(null);
  const [readLookupBin, setReadLookupBin] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [focusRequest, setFocusRequest] = useState(0);
  const initialValues: CardInput = draft?.kind === 'card' ? {
    ...draft.values, type: draft.values.type ?? '', tier: draft.values.tier ?? '', country: draft.values.country ?? '',
  } : card ? {
    number: card.number, expiry: card.expiry, cvv: card.cvv, holder: card.holder, bank: card.bank, network: card.network,
    type: card.type ?? '', tier: card.tier ?? '', country: card.country ?? '',
  } : { number: '', expiry: '', cvv: '', holder: '', bank: '', network: '', type: '', tier: '', country: '' };
  const { control, getValues, setValue, setFocus, handleSubmit, subscribe, formState: { errors } } = useForm<CardInput>({
    resolver: zodResolver(cardFormSchema),
    mode: 'onBlur',
    shouldFocusError: false,
    defaultValues: { ...initialValues, number: initialValues.number.replace(/[\s-]/g, ''), expiry: formatCardExpiry(initialValues.expiry) },
  });
  const lookup = useCardBinLookup({ getValues, setValue, initialValues, restoredDraft: draft?.kind === 'card', initialAutofill: draft?.kind === 'card' ? draft.autofill : undefined, generation });
  const { stop, getDraftAutofill } = lookup;
  const watched = useWatch({ control });
  const current: CardInput = {
    number: watched.number ?? '', expiry: watched.expiry ?? '', cvv: watched.cvv ?? '', holder: watched.holder ?? '',
    bank: watched.bank ?? '', network: watched.network ?? '', type: watched.type ?? '', tier: watched.tier ?? '', country: watched.country ?? '',
  };
  const detailsOpen = expanded ?? (lookup.state.status === 'unconfigured' || lookup.state.status === 'success' && Boolean(lookup.state.details?.missingFields.length));
  const overlayOpen = calendarOpen || menu !== null || reader !== null;
  const detected = lookup.state.details;
  const canRestore = Boolean(detected && cardDetailFields.some((field) => detected[field] !== undefined && detected[field] !== current[field]));
  const received = detected ? cardDetailFields.length - detected.missingFields.length : 0;
  useEffect(() => subscribe({
    formState: { values: true },
    callback: ({ values }) => { if (!finished.current) keepSessionDraft(draftKey, { kind: 'card', values, autofill: getDraftAutofill() }, generation); },
  }), [draftKey, generation, getDraftAutofill, subscribe]);
  const closeMenu = useCallback(() => { menuRequest.current++; setMenu(null); }, [setMenu]);
  const closeEditor = useCallback(() => {
    if (pending.current) return;
    stop();
    if (!finished.current) keepSessionDraft(draftKey, { kind: 'card', values: getValues(), autofill: getDraftAutofill() }, generation);
    Keyboard.dismiss();
    onClose();
  }, [draftKey, generation, getDraftAutofill, getValues, onClose, stop]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (reader) setReader(null);
      else if (calendarOpen) setCalendarOpen(false);
      else if (menu) closeMenu();
      else closeEditor();
      return true;
    });
    return () => subscription.remove();
  }, [calendarOpen, closeEditor, closeMenu, menu, reader]);
  useEffect(() => {
    if (busy || !pendingFocus.current) return;
    const field = pendingFocus.current;
    if (cardDetailFields.some((name) => name === field) && !detailsOpen) return;
    pendingFocus.current = null;
    scroll.current?.scrollTo({ y: cardDetailFields.some((name) => name === field) ? detailsY.current : 0, animated: true });
    setFocus(field);
  }, [busy, detailsOpen, focusRequest, setFocus]);
  function openMenu(kind: EditorMenu['kind'], anchor: Anchor | null) {
    if (!anchor || pending.current) return;
    haptic();
    const request = ++menuRequest.current;
    anchor.measureInWindow((x, y, width, height) => {
      viewport.current?.measureInWindow((screenX, screenY, screenWidth, screenHeight) => {
        if (menuRequest.current !== request || width <= 0 || screenWidth <= 0 || screenHeight <= 0) return;
        setMenu({ kind, placement: { anchor: { x: x - screenX, y: y - screenY, width, height }, viewport: { width: screenWidth, height: screenHeight } } });
      });
    });
  }
  function invalid(fields: FieldErrors<CardInput>) {
    pendingFocus.current = (['number', 'expiry', 'cvv', 'holder', ...cardDetailFields] as const).find((field) => fields[field]) ?? null;
    setFocusRequest((request) => request + 1);
    if (cardDetailFields.some((field) => fields[field])) setExpanded(true);
  }
  async function submit() {
    if (pending.current || finished.current) return;
    haptic();
    pending.current = true;
    setBusy(true);
    setError(undefined);
    setExpanded(detailsOpen);
    stop();
    closeMenu();
    try {
      await handleSubmit(async (input) => {
        if (card) await vaultService.updateCard(card.id, input);
        else await vaultService.addCard(input);
        finished.current = true;
        discardSessionDraft(draftKey, generation);
        notify(card ? 'Card updated securely.' : 'Your card is safely tucked away.');
        Keyboard.dismiss();
        onClose();
      }, invalid)();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  function detailField(name: CardDetailField, placeholder: string) {
    return <Controller control={control} name={name} render={({ field }) => <TextField variant="soft" label={cardDetailLabels[name]} labelStyle={styles.fieldLabel} accessibilityLabel={cardDetailLabels[name]} placeholder={placeholder} value={field.value ?? ''} inputRef={field.ref} editable={!busy} onChangeText={(value) => { lookup.markManual(name); field.onChange(value); }} onBlur={field.onBlur} error={errors[name]?.message} maxLength={Math.max(cardFieldLimits[name], field.value?.length ?? 0)} style={styles.detailInput} />} />;
  }
  function requestDelete() {
    if (!card || pending.current) return;
    setExpanded(detailsOpen);
    stop();
    removeCard(card, () => { finished.current = true; onClose(); });
  }
  function openReader(method: CardReadMethod) {
    if (pending.current) return;
    Keyboard.dismiss();
    closeMenu();
    setCalendarOpen(false);
    stop();
    const values = getValues();
    keepSessionDraft(draftKey, { kind: 'card', values, autofill: getDraftAutofill() }, generation);
    setReader({ method, existing: { number: values.number, expiry: values.expiry, holder: values.holder } });
  }
  function useReadDetails(details: CardReadReview) {
    const session = useSessionStore.getState();
    if (session.status !== 'unlocked' || session.generation !== generation) {
      setReader(null);
      setError('Unlock your vault again before using these details.');
      return;
    }
    setValue('number', details.number, { shouldDirty: true, shouldValidate: true });
    setValue('expiry', details.expiry, { shouldDirty: true, shouldValidate: true });
    setValue('holder', details.holder, { shouldDirty: true, shouldValidate: true });
    setReader(null);
    setReadLookupBin(cardBinPrefix(details.number));
    lookup.start(details.number, true);
  }
  return (
    <Screen>
      <View ref={viewport} collapsable={false} style={styles.viewport} onLayout={closeMenu}>
        <KeyboardAvoidingView style={styles.viewport} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents={overlayOpen ? 'none' : 'auto'} accessibilityElementsHidden={overlayOpen} importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'}>
          <View style={styles.toolbar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to cards" disabled={busy} onPress={closeEditor} style={styles.iconButton}><Feather name="chevron-left" size={27} color={colors.textPrimary} accessible={false} /></Pressable>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{card ? 'Edit card' : 'New card'}</Text>
            {card ? <Pressable ref={moreAnchor} collapsable={false} accessibilityRole="button" accessibilityLabel="Card options" accessibilityState={{ expanded: menu?.kind === 'actions' }} disabled={busy} onPress={() => openMenu('actions', moreAnchor.current)} style={styles.iconButton}><Feather name="more-horizontal" size={23} color={colors.textPrimary} accessible={false} /></Pressable>
              : <Text style={[styles.privateLabel, { color: colors.textSecondary }]}>Private by design</Text>}
          </View>
          <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false} onScrollBeginDrag={closeMenu} contentContainerStyle={styles.content}>
            <CardEditorPreview values={current} />
            {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            <View style={styles.numberGroup}>
              <View style={styles.numberHeading}>
                <Text style={[styles.numberLabel, { color: colors.textSecondary }]}>Card number</Text>
                {!card ? <View style={styles.readerActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Scan card with camera" disabled={busy} onPress={() => openReader('camera')} style={styles.readerAction}><Feather name="camera" size={16} color={colors.accent} accessible={false} /><Text style={[styles.readerLabel, { color: colors.accent }]}>Scan card</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Add card via NFC" disabled={busy} onPress={() => openReader('nfc')} style={styles.readerAction}><Feather name="wifi" size={16} color={colors.accent} style={{ transform: [{ rotate: '90deg' }] }} accessible={false} /><Text style={[styles.readerLabel, { color: colors.accent }]}>NFC</Text></Pressable>
                </View> : null}
              </View>
              <Controller control={control} name="number" render={({ field }) => <TextField variant="soft" accessibilityLabel="Card number" placeholder="13 to 19 digits" inputMode="numeric" keyboardType="number-pad" inputRef={field.ref} value={field.value} editable={!busy} onChangeText={(value) => { const number = numericCardInput(value, cardEntryLimits.maximumNumberDigits); field.onChange(number); lookup.start(number); }} onBlur={field.onBlur} error={errors.number?.message} maxLength={cardFieldLimits.number} style={styles.panInput} rightAccessory={logoNetworks.has(cardNetworkIdentity(current.network)) ? <View style={styles.inlineLogo}><CardNetworkLogo network={current.network} /></View> : undefined} />} />
              {lookup.state.message ? <View style={styles.statusRow}>{lookup.state.status === 'loading' ? <ActivityIndicator size="small" color={colors.accent} accessible={false} /> : null}<Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.textSecondary }]}>{lookup.state.message}</Text></View> : null}
              {!lookup.state.message && readLookupBin && lookup.state.status === 'success' && lookup.state.details?.bin === readLookupBin && cardBinPrefix(current.number) === readLookupBin ? <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.success }]}>Issuer details found. Review before saving.</Text> : null}
              {cardBinPrefix(current.number).length === 8 && (lookup.state.status === 'error' || lookup.state.status === 'idle') ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => lookup.start(getValues('number'), true)} style={styles.detect}><Feather name="refresh-cw" size={13} color={colors.accent} accessible={false} /><Text style={[styles.detectLabel, { color: colors.accent }]}>{lookup.state.status === 'error' ? 'Retry lookup' : 'Detect card details'}</Text></Pressable> : null}
            </View>
            <View style={styles.pair}>
              <View style={styles.half}><Controller control={control} name="expiry" render={({ field }) => <TextField variant="soft" label="Expiry date" labelStyle={styles.fieldLabel} accessibilityLabel="Expiry date" placeholder="MM/YY" inputMode="numeric" keyboardType="number-pad" inputRef={field.ref} value={field.value} editable={!busy} onChangeText={(value) => field.onChange(cardExpiryInput(value))} onBlur={field.onBlur} error={errors.expiry?.message} maxLength={cardFieldLimits.expiry} rightAccessory={<Pressable accessibilityRole="button" accessibilityLabel="Choose expiry date" accessibilityState={{ expanded: calendarOpen }} disabled={busy} onPress={() => { Keyboard.dismiss(); closeMenu(); setCalendarOpen(true); }} style={styles.iconButton}><Feather name="calendar" size={19} color={colors.textSecondary} accessible={false} /></Pressable>} />} /></View>
              <View style={styles.half}><Controller control={control} name="cvv" render={({ field }) => <TextField variant="soft" label="CVV" labelStyle={styles.fieldLabel} accessibilityLabel="CVV" placeholder="3 or 4 digits" inputMode="numeric" keyboardType="number-pad" inputRef={field.ref} secureTextEntry value={field.value} editable={!busy} onChangeText={(value) => field.onChange(numericCardInput(value, cardEntryLimits.maximumCvvDigits))} onBlur={field.onBlur} error={errors.cvv?.message} maxLength={cardFieldLimits.cvv} />} /></View>
            </View>
            <Controller control={control} name="holder" render={({ field }) => <TextField variant="soft" label="Name on card" labelStyle={styles.fieldLabel} accessibilityLabel="Name on card" placeholder="Name as printed on your card" inputRef={field.ref} value={field.value} editable={!busy} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.holder?.message} maxLength={80} />} />
            <View style={[styles.details, { borderColor: colors.border }]} onLayout={(event) => { detailsY.current = event.nativeEvent.layout.y; }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Card details" accessibilityState={{ expanded: detailsOpen, disabled: busy }} disabled={busy} onPress={() => { if (detailsOpen) Keyboard.dismiss(); setExpanded(!detailsOpen); }} style={styles.detailsHeading}>
                <View style={styles.detailsTitleGroup}><Text style={[styles.detailsTitle, { color: colors.textPrimary }]}>Card details</Text><Text style={[styles.detailsSubtitle, { color: colors.textSecondary }]}>{detected ? `${received} details received / Always editable` : 'Bank, network, tier, type and country'}</Text></View>
                <Feather name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} accessible={false} />
              </Pressable>
              <View style={[styles.detailFields, { borderTopColor: colors.border, display: detailsOpen ? 'flex' : 'none' }]} accessibilityElementsHidden={!detailsOpen} importantForAccessibility={detailsOpen ? 'auto' : 'no-hide-descendants'}>
                {detailField('bank', 'Add bank name')}
                <View style={styles.pair}><View style={styles.half}>{detailField('network', 'Add network')}</View><View style={styles.half}>{detailField('tier', 'Add tier')}</View></View>
                <View style={styles.pair}><View style={styles.half}>{detailField('type', 'Add card type')}</View><View style={styles.half}>{detailField('country', 'Add country')}</View></View>
                <Text style={[styles.lookupPrivacy, { color: colors.textSecondary }]}>Lookup uses only the first 8 digits, never your full card number or CVV.</Text>
                {canRestore ? <Button title="Use API details" variant="ghost" disabled={busy} onPress={lookup.applyDetected} /> : null}
              </View>
            </View>
          </ScrollView>
          <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={card ? 'Save changes' : 'Save card'} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => { void submit(); }} style={({ pressed }) => [styles.save, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
              {busy ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Feather name="lock" size={20} color={colors.onAccent} accessible={false} />}<Text style={[styles.saveLabel, { color: colors.onAccent }]}>{card ? 'Save changes' : 'Save card'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
        {menu ? <Dropdown placement={menu.placement} title="Card options" contentHeight={64 + 2 * 48} align="right" onClose={closeMenu}>
          <View><Pressable accessibilityRole="button" accessibilityLabel="Copy CVV" disabled={!current.cvv} onPress={() => { closeMenu(); void copySecret(getValues('cvv')).then(() => notify('CVV copied securely. Clears within 30 seconds.')).catch(reportError); }} style={styles.menuOption}><Feather name="copy" size={17} color={colors.accent} accessible={false} /><Text style={[styles.menuText, { color: colors.textPrimary }]}>Copy CVV</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Delete card" onPress={() => { closeMenu(); requestDelete(); }} style={styles.menuOption}><Feather name="trash-2" size={17} color={colors.danger} accessible={false} /><Text style={[styles.menuText, { color: colors.danger }]}>Delete card</Text></Pressable></View>
        </Dropdown> : null}
        {calendarOpen ? <CardExpiryPicker value={current.expiry} onClose={() => setCalendarOpen(false)} onSelect={(value) => { setValue('expiry', value, { shouldDirty: true, shouldValidate: true }); setCalendarOpen(false); }} /> : null}
        {reader ? <CardReadScreen method={reader.method} existing={reader.existing} generation={generation} onClose={() => setReader(null)} onUse={useReadDetails} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1 },
  toolbar: { paddingHorizontal: 15, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  title: { ...typography.title, flex: 1, minWidth: 0 },
  privateLabel: { ...typography.caption, maxWidth: '35%', flexShrink: 1, textAlign: 'right' },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 26, gap: 21 },
  error: { ...typography.small },
  numberGroup: { gap: 8 },
  numberHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12 },
  numberLabel: { ...typography.label },
  readerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  readerAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },
  readerLabel: { ...typography.small, fontWeight: '600' },
  panInput: { fontSize: 16, letterSpacing: 0.3 },
  fieldLabel: { fontWeight: '600', letterSpacing: 0.2 },
  inlineLogo: { width: 58, marginRight: 12, justifyContent: 'center' },
  statusRow: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  status: { ...typography.small, flex: 1 },
  detect: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44 },
  detectLabel: { ...typography.small, fontWeight: '600' },
  pair: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  half: { flex: 1, minWidth: 0 },
  details: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  detailsHeading: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 17, gap: 10 },
  detailsTitleGroup: { flex: 1, gap: 5 },
  detailsTitle: { ...typography.label },
  detailsSubtitle: { ...typography.small },
  detailFields: { borderTopWidth: 1, padding: 15, gap: 16 },
  detailInput: { minHeight: 46, fontSize: 16, paddingHorizontal: 11, paddingVertical: 12 },
  lookupPrivacy: { ...typography.small },
  footer: { paddingTop: 12, paddingHorizontal: 24, borderTopWidth: StyleSheet.hairlineWidth },
  save: { minHeight: 52, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveLabel: { ...typography.button },
  menuOption: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
