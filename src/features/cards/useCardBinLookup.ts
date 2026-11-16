import {useCallback, useEffect, useRef, useState} from 'react';
import type {UseFormGetValues, UseFormSetValue} from 'react-hook-form';
import {errorMessage} from '../../core/errors/VaultError';
import {
  useSessionStore,
  type CardAutofillField,
  type CardAutofillState,
} from '../../core/security/sessionStore';
import type {CardInput} from '../../core/vault/models';
import {
  cardDetailFields,
  cardDetailLabels,
} from '../../core/validation/cardRules';
import {
  cardBinPrefix,
  isCardBinLookupConfigured,
  lookupCardBin,
  type CardBinDetails,
} from './cardBinLookup';

interface LookupState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'unconfigured';
  message: string;
  details?: CardBinDetails;
}
interface Request {
  bin: string;
  delay?: ReturnType<typeof setTimeout>;
  timeout?: ReturnType<typeof setTimeout>;
  controller?: AbortController;
}

function idleState(): LookupState {
  return isCardBinLookupConfigured()
    ? {status: 'idle', message: ''}
    : {
        status: 'unconfigured',
        message:
          'HandyAPI is off in this APK (no public key). Your current selections are unchanged.',
      };
}

export function useCardBinLookup({
  getValues,
  setValue,
  initialValues,
  restoredDraft,
  initialAutofill,
  generation,
}: {
  getValues: UseFormGetValues<CardInput>;
  setValue: UseFormSetValue<CardInput>;
  initialValues: CardInput;
  restoredDraft: boolean;
  initialAutofill?: CardAutofillState;
  generation: number;
}) {
  const [state, setState] = useState<LookupState>(idleState);
  const active = useRef<Request | null>(null);
  const lastBin = useRef(cardBinPrefix(initialValues.number));
  const latest = useRef<CardBinDetails | null>(null);
  const manual = useRef(
    new Set<CardAutofillField>(
      initialAutofill?.manualFields ??
        (restoredDraft
          ? cardDetailFields.filter(
              (field) =>
                Boolean(initialValues[field]) &&
                initialValues[field] !== 'Other'
            )
          : [])
    )
  );
  const automatic = useRef<Partial<Pick<CardInput, CardAutofillField>>>({
    ...(initialAutofill?.automaticFields.includes('bank')
      ? {bank: initialValues.bank}
      : {}),
    ...(initialAutofill?.automaticFields.includes('network')
      ? {network: initialValues.network}
      : {}),
    ...(initialAutofill?.automaticFields.includes('type')
      ? {type: initialValues.type}
      : {}),
    ...(initialAutofill?.automaticFields.includes('tier')
      ? {tier: initialValues.tier}
      : {}),
    ...(initialAutofill?.automaticFields.includes('country')
      ? {country: initialValues.country}
      : {}),
  });
  const cancelPending = useCallback(() => {
    const request = active.current;
    active.current = null;
    if (request?.delay !== undefined) clearTimeout(request.delay);
    if (request?.timeout !== undefined) clearTimeout(request.timeout);
    request?.controller?.abort();
  }, []);
  useEffect(() => cancelPending, [cancelPending]);

  const apply = useCallback(
    (details: CardBinDetails, replaceManual: boolean) => {
      for (const field of cardDetailFields) {
        const value = details[field];
        if (
          value !== undefined &&
          (replaceManual || !manual.current.has(field))
        ) {
          automatic.current[field] = value;
          manual.current.delete(field);
          setValue(field, value, {shouldDirty: true, shouldValidate: true});
        }
      }
    },
    [setValue]
  );

  const start = useCallback(
    (number: string, force = false) => {
      const bin = cardBinPrefix(number);
      if (!force && bin === lastBin.current) return;
      cancelPending();
      latest.current = null;
      lastBin.current = bin;
      if (bin.length !== 8 || !isCardBinLookupConfigured()) {
        setState(idleState());
        return;
      }
      const request: Request = {bin};
      active.current = request;
      setState({status: 'loading', message: 'Finding card details...'});
      request.delay = setTimeout(() => {
        const session = useSessionStore.getState();
        if (active.current !== request) return;
        if (
          session.status !== 'unlocked' ||
          session.generation !== generation
        ) {
          cancelPending();
          return;
        }
        const controller = new AbortController();
        request.controller = controller;
        request.timeout = setTimeout(() => {
          if (active.current !== request) return;
          controller.abort();
          setState({
            status: 'error',
            message:
              'Card lookup timed out. Current selections are unchanged; review them or retry.',
          });
        }, 8_000);
        void lookupCardBin(bin, controller.signal)
          .then((details) => {
            const current = useSessionStore.getState();
            if (
              active.current !== request ||
              controller.signal.aborted ||
              current.status !== 'unlocked' ||
              current.generation !== generation
            )
              return;
            latest.current = details;
            apply(details, false);
            const missing = details.missingFields
              .map((field) => cardDetailLabels[field].toLowerCase())
              .join(', ');
            const message = details.warnings.length
              ? details.warnings.join(' ')
              : missing
                ? `Not provided: ${missing}. You can edit Card details below.`
                : '';
            setState({status: 'success', details, message});
          })
          .catch((cause) => {
            if (active.current === request && !controller.signal.aborted)
              setState({
                status: 'error',
                message: `${errorMessage(cause)} Current selections are unchanged.`,
              });
          })
          .finally(() => {
            if (request.timeout !== undefined) clearTimeout(request.timeout);
            if (active.current === request) active.current = null;
          });
      }, 450);
    },
    [apply, cancelPending, generation]
  );

  const getDraftAutofill = useCallback((): CardAutofillState => {
    const automaticFields: CardAutofillField[] = [];
    for (const field of cardDetailFields)
      if (automatic.current[field] !== undefined) automaticFields.push(field);
    return {manualFields: [...manual.current], automaticFields};
  }, []);
  const markManual = useCallback((field: CardAutofillField) => {
    manual.current.add(field);
    delete automatic.current[field];
  }, []);
  const applyDetected = useCallback(() => {
    const details = latest.current;
    const session = useSessionStore.getState();
    if (session.status !== 'unlocked' || session.generation !== generation) {
      setState({
        status: 'error',
        message: 'Unlock your vault before detecting card details.',
      });
      return;
    }
    if (!details || details.bin !== cardBinPrefix(getValues('number'))) {
      setState({
        status: 'error',
        message: 'The card number changed. Detect its details again.',
      });
      return;
    }
    apply(details, true);
  }, [apply, generation, getValues]);
  const stop = useCallback(() => {
    cancelPending();
    latest.current = null;
    setState(idleState());
  }, [cancelPending]);
  const reset = useCallback(() => {
    stop();
    lastBin.current = '';
    manual.current.clear();
    automatic.current = {};
  }, [stop]);
  return {
    state,
    start,
    markManual,
    applyDetected,
    stop,
    reset,
    getDraftAutofill,
  };
}
