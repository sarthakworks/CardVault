import { useState } from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { VaultCard } from '../../core/vault/models';
import { copySecret } from '../../core/security/clipboardGuard';
import { vaultService } from '../../core/vault/vaultService';
import { notify, reportError } from '../../core/errors/noticeStore';
import { Sheet } from '../../shared/components/Sheet';
import { Button } from '../../shared/components/Button';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { typography } from '../../shared/theme/typography';
import { displayDate } from '../../shared/utils/formatters';
import { ActionAuthorizationSheet } from '../auth/ActionAuthorizationSheet';
import { CardFace } from './CardFace';

export function CardDetailSheet({ card, onClose, onEdit }: { card: VaultCard; onClose: () => void; onEdit: () => void }) {
  const { colors } = useTheme();
  const [flipped, setFlipped] = useState(false);
  const [showNumber, setShowNumber] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  async function copy(value: string) {
    try { await copySecret(value); notify('Copied securely. Clears within 30 seconds.'); }
    catch (error) { reportError(error); }
  }
  return (
    <>
      <Sheet visible onClose={onClose} title="The finer details." subtitle={`${card.bank} / ${card.network}`}>
        <CardFace card={card} flipped={flipped} showNumber={showNumber} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Button title={flipped ? 'Hide CVV' : 'Reveal CVV'} icon="rotate-cw" variant="secondary" onPress={() => setFlipped(!flipped)} /></View>
          <View style={{ flex: 1 }}><Button title={showNumber ? 'Hide number' : 'Show number'} icon={showNumber ? 'eye-off' : 'eye'} variant="secondary" onPress={() => { setFlipped(false); setShowNumber(!showNumber); }} /></View>
        </View>
        <View style={{ gap: 16, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 18 }}>
          {[['CARDHOLDER', card.holder], ['OWNER', card.owner], ['ADDED', displayDate(card.createdAt)]].map(([label, value]) => <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 15 }}><Text style={[typography.small, { color: colors.textSecondary }]}>{label}</Text><Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>{value}</Text></View>)}
        </View>
        <Button title="Copy card number" icon="copy" variant="secondary" onPress={() => void copy(card.number)} />
        <Button title="Copy CVV" icon="copy" variant="secondary" onPress={() => void copy(card.cvv)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Feather name="shield" size={14} color={colors.textSecondary} /><Text style={[typography.small, { color: colors.textSecondary, flex: 1 }]}>Confirm changes with your fingerprint or master password.</Text></View>
        <Button title="Edit card" icon="edit-2" onPress={onEdit} />
        <Button title="Delete card" icon="trash-2" variant="danger" onPress={() => setDeleteOpen(true)} />
      </Sheet>
      <ActionAuthorizationSheet visible={deleteOpen} operation={`card:delete:${card.id}`} onClose={() => setDeleteOpen(false)} title="Delete this card?" description="This permanently removes the card from this device. Authenticate to confirm." confirmLabel="Delete permanently" onAuthorized={async (authorization) => {
        await vaultService.deleteCard(card.id, authorization);
        notify('Card removed from your vault.');
        onClose();
      }} />
    </>
  );
}
