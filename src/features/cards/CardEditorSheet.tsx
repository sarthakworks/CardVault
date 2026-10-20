import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CardInput, VaultCard } from '../../core/vault/models';
import { cardFieldLimits, networks } from '../../core/validation/cardRules';
import { vaultService } from '../../core/vault/vaultService';
import { notify } from '../../core/errors/noticeStore';
import { VaultError } from '../../core/errors/VaultError';
import { Sheet } from '../../shared/components/Sheet';
import { SheetTextField as TextField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';
import { Chip } from '../../shared/components/Chip';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { ActionAuthorizationSheet } from '../auth/ActionAuthorizationSheet';
import { cardFormSchema } from './cardFormSchema';
import { discardSessionDraft, keepSessionDraft, useSessionStore } from '../../core/security/sessionStore';

export function CardEditorSheet({ card, onClose }: { card: VaultCard | null; onClose: () => void }) {
  const { colors } = useTheme();
  const draftKey = card ? `card:${card.id}` : 'card:new';
  const { generation, drafts } = useSessionStore.getState();
  const draft = drafts[draftKey];
  const saved = useRef(false);
  const [pending, setPending] = useState<CardInput | null>(null);
  const { control, handleSubmit, setValue, subscribe, getValues, formState: { errors } } = useForm<CardInput>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: draft?.kind === 'card' ? draft.values : card ? { number: card.number, expiry: card.expiry, cvv: card.cvv, holder: card.holder, bank: card.bank, network: card.network, owner: card.owner }
      : { number: '', expiry: '', cvv: '', holder: '', bank: '', network: 'Visa', owner: 'Myself' },
  });
  useEffect(() => subscribe({
    formState: { values: true },
    callback: ({ values }) => {
      if (!saved.current) keepSessionDraft(draftKey, { kind: 'card', values }, generation);
    },
  }), [subscribe, draftKey, generation]);
  const selectedNetwork = useWatch({ control, name: 'network' });
  const selectedOwner = useWatch({ control, name: 'owner' });
  const selectedBank = useWatch({ control, name: 'bank' });
  function closeEditor() {
    if (!saved.current) keepSessionDraft(draftKey, { kind: 'card', values: getValues() }, generation);
    onClose();
  }
  return (
    <>
      <Sheet visible onClose={closeEditor} title={card ? 'A little update.' : 'Make room for a card.'} subtitle="Drafts stay in this unlocked session. Every save is encrypted.">
        <Controller control={control} name="number" render={({ field }) => <TextField label="CARD NUMBER" placeholder="Card number as you want to store it" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.number?.message} maxLength={cardFieldLimits.number} />} />
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ flex: 1 }}><Controller control={control} name="expiry" render={({ field }) => <TextField label="EXPIRY DATE" placeholder="MM/YY or your own text" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.expiry?.message} maxLength={cardFieldLimits.expiry} />} /></View>
          <View style={{ flex: 1 }}><Controller control={control} name="cvv" render={({ field }) => <TextField label="CVV / SECURITY CODE" placeholder="Your security code" secureTextEntry value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.cvv?.message} maxLength={cardFieldLimits.cvv} />} /></View>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>Stored as entered. Card number, expiry, and security-code validity are not checked.</Text>
        <Controller control={control} name="holder" render={({ field }) => <TextField label="CARDHOLDER NAME" placeholder="Name as it appears on your card" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.holder?.message} maxLength={80} />} />
        <Controller control={control} name="bank" render={({ field }) => <TextField label="BANK NAME" placeholder="e.g. HDFC Bank" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.bank?.message} maxLength={60} />} />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {['HDFC', 'Axis', 'ICICI', 'SBI', 'HSBC'].map((bank) => <Chip key={bank} label={bank} selected={selectedBank === bank} onPress={() => setValue('bank', bank, { shouldValidate: true })} />)}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.7 }}>CARD NETWORK</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{networks.map((network) => <Chip key={network} label={network} selected={selectedNetwork === network} onPress={() => setValue('network', network, { shouldValidate: true })} />)}</View>
        <Controller control={control} name="owner" render={({ field }) => <TextField label="OWNER TAG" placeholder="Myself, family, or a custom tag" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.owner?.message} maxLength={40} />} />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{['Myself', 'Spouse', 'Parent', 'Other'].map((owner) => <Chip key={owner} label={owner} selected={selectedOwner === owner} onPress={() => setValue('owner', owner, { shouldValidate: true })} />)}</View>
        <Button title={card ? 'Authorize & save changes' : 'Save card securely'} icon="lock" onPress={() => void handleSubmit(setPending)()} />
        <Button title="Close & keep draft" variant="ghost" onPress={closeEditor} />
      </Sheet>
      <ActionAuthorizationSheet visible={pending !== null} operation={card ? `card:update:${card.id}` : 'card:create'} title={card ? 'Confirm your update.' : 'Save this card?'} onClose={() => setPending(null)} onAuthorized={async (authorization) => {
        if (!pending) throw new VaultError('authorization', 'This save is no longer active.');
        if (card) await vaultService.updateCard(card.id, pending, authorization);
        else await vaultService.addCard(pending, authorization);
        saved.current = true;
        discardSessionDraft(draftKey, generation);
        notify(card ? 'Card updated securely.' : 'Your card is safely tucked away.');
        setPending(null);
        onClose();
      }} />
    </>
  );
}
