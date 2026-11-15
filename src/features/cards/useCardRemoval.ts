import type { VaultCard } from '../../core/vault/models';
import { vaultService } from '../../core/vault/vaultService';
import { notify } from '../../core/errors/noticeStore';
import { useConfirmation } from '../../shared/components/ConfirmationProvider';

export function useCardRemoval() {
  const confirm = useConfirmation();
  return (card: VaultCard, onDeleted?: () => void) => {
    const id = card.id;
    confirm({
      title: 'Delete this card?',
      description: 'This card will leave your vault. This cannot be undone.',
      confirmLabel: 'Delete card',
      cancelLabel: 'Keep card',
      itemTitle: card.bank,
      itemDescription: `${card.network} / ending ${card.number.slice(-4)}`,
      itemIcon: 'credit-card',
      onConfirm: async () => {
        await vaultService.deleteCard(id);
        notify('Card removed from your vault.');
        onDeleted?.();
      },
    });
  };
}
