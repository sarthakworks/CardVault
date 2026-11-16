import type {CardInput} from '../../core/vault/models';
import {CardFace} from './CardFace';
import {cardPreviewValues} from './cardPresentation';

export function CardEditorPreview({
  values,
  reserveActionSpace,
}: {
  values: CardInput;
  reserveActionSpace?: boolean;
}) {
  return (
    <CardFace
      card={cardPreviewValues(values)}
      reserveActionSpace={reserveActionSpace}
    />
  );
}
