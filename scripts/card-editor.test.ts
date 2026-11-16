import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import type {CardInput} from '../src/core/vault/models';

type Element = {
  type: string;
  props: {
    children?: unknown;
    onPress?: () => void;
    onUse?: (details: object) => void;
    accessibilityLabel?: string;
    [key: string]: unknown;
  };
};

function hooks() {
  const slots: unknown[] = [];
  let index = 0;
  const effects: (() => unknown)[] = [];
  return {
    render<T>(render: () => T): T {
      index = 0;
      const result = render();
      effects.splice(0).forEach((effect) => effect());
      return result;
    },
    react: {
      useRef<T>(initial: T) {
        const key = index++;
        slots[key] ??= {current: initial};
        return slots[key] as {current: T};
      },
      useState<T>(initial: T | (() => T)) {
        const key = index++;
        if (!(key in slots))
          slots[key] =
            typeof initial === 'function' ? (initial as () => T)() : initial;
        return [slots[key], (value: T) => (slots[key] = value)];
      },
      useCallback: <T>(callback: T) => callback,
      useEffect: (effect: () => unknown) => effects.push(effect),
    },
  };
}

function load<T>(file: string, modules: Record<string, unknown>, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      assert(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
    ...globals,
  });
  return exports as T;
}

function nodes(element: unknown): Element[] {
  if (!element || typeof element !== 'object') return [];
  const node = element as Element;
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}

const filled: CardInput = {
  number: '0000000000000019',
  expiry: '12/2030',
  cvv: '007',
  holder: 'Synthetic Name',
  bank: 'Synthetic Bank',
  network: 'Visa',
  type: 'Credit',
  variant: 'Scapia',
  tier: 'Gold',
  country: 'Synthetic Country',
};

test('add-only clear controls share a reset, discard the draft, and allow a fresh draft', () => {
  const runtime = hooks();
  let values = {...filled};
  let errors: object = {variant: {message: 'Invalid variant'}};
  const drafts: Record<string, unknown> = {
    'card:new': {kind: 'card', values: {...values}},
  };
  let autosave: (event: {values: CardInput}) => void = () => {};
  let resets = 0;
  let lookupResets = 0;
  let dismissed = 0;
  const session = {
    status: 'unlocked',
    generation: 1,
    drafts,
  };
  const jsx = (type: string, props: Element['props']) => ({type, props});
  const modules: Record<string, unknown> = {
    react: runtime.react,
    'react/jsx-runtime': {jsx, jsxs: jsx},
    'react-native': {
      ...Object.fromEntries(
        [
          'ActivityIndicator',
          'KeyboardAvoidingView',
          'Pressable',
          'ScrollView',
          'Text',
          'View',
        ].map((name) => [name, name])
      ),
      BackHandler: {addEventListener: () => ({remove() {}})},
      Keyboard: {dismiss: () => dismissed++},
      Platform: {OS: 'android'},
      StyleSheet: {create: (styles: object) => styles},
    },
    'react-hook-form': {
      Controller: 'Controller',
      useWatch: () => values,
      useForm: () => ({
        control: {},
        getValues: () => values,
        setValue: () => assert.fail('Stale reader must not set values'),
        subscribe: ({callback}: {callback: typeof autosave}) => {
          autosave = callback;
          return () => {};
        },
        reset: (next: CardInput) => {
          resets++;
          values = {...next};
          errors = {};
          autosave({values});
        },
        formState: {errors},
      }),
    },
    '@hookform/resolvers/zod': {zodResolver() {}},
    '@expo/vector-icons/Feather': {default: 'Feather'},
    'react-native-safe-area-context': {useSafeAreaInsets: () => ({bottom: 0})},
    '../../core/security/sessionStore': {
      useSessionStore: {getState: () => session},
      keepSessionDraft: (key: string, draft: unknown) => (drafts[key] = draft),
      discardSessionDraft: (key: string) => delete drafts[key],
    },
    '../../core/validation/cardRules': {
      cardDetailFields: ['bank', 'network', 'type', 'tier', 'country'],
      cardDetailLabels: {},
      cardEntryLimits: {},
      cardFieldLimits: {},
      cardNetworkIdentity: () => '',
    },
    '../../core/vault/vaultService': {},
    '../../core/security/clipboardGuard': {},
    '../../core/errors/VaultError': {},
    '../../core/errors/noticeStore': {notify() {}},
    '../../shared/theme/ThemeProvider': {useTheme: () => ({colors: {}})},
    '../../shared/theme/typography': {typography: {}},
    '../../shared/hooks/useHaptics': {useHaptics: () => () => {}},
    '../../shared/utils/formatters': {
      formatCardExpiry: (value: string) => value,
    },
    './cardFormSchema': {},
    './cardBinLookup': {cardBinPrefix: (value: string) => value.slice(0, 8)},
    './useCardBinLookup': {
      useCardBinLookup: () => ({
        state: {status: 'idle'},
        reset: () => lookupResets++,
        stop() {},
        getDraftAutofill: () => ({}),
      }),
    },
    './useCardRemoval': {useCardRemoval() {}},
  };
  for (const [path, name] of [
    ['../../shared/components/Screen', 'Screen'],
    ['../../shared/components/TextField', 'TextField'],
    ['../../shared/components/Button', 'Button'],
    ['../../shared/components/Dropdown', 'Dropdown'],
    ['./CardNetworkLogo', 'CardNetworkLogo'],
    ['./CardEditorPreview', 'CardEditorPreview'],
    ['./CardExpiryPicker', 'CardExpiryPicker'],
    ['./CardReadScreen', 'CardReadScreen'],
  ] as const)
    modules[path] = {[name]: name};
  const {CardEditor} = load<{
    CardEditor: (props: {
      card: CardInput | null;
      onClose: () => void;
    }) => Element;
  }>('src/features/cards/CardEditor.tsx', modules);
  const render = (card: CardInput | null = null) =>
    runtime.render(() => CardEditor({card, onClose() {}}));
  const tree = nodes(render());
  const bin = tree.find(
    (node) => node.props.accessibilityLabel === 'Clear all card details'
  )!;
  const clearText = tree.find(
    (node) =>
      node.type === 'Pressable' &&
      nodes(node).some((child) => child.props?.children === 'Clear All')
  )!;
  assert.equal(typeof bin.props.onPress, 'function');
  assert.equal(clearText.props.onPress, bin.props.onPress);
  tree.find(
    (node) => node.props.accessibilityLabel === 'Scan card with camera'
  )!.props.onPress!();
  const staleReader = nodes(render()).find(
    (node) => node.type === 'CardReadScreen'
  )!;
  bin.props.onPress!();
  staleReader.props.onUse!({});
  assert.equal(resets, 1);
  assert.equal(lookupResets, 1);
  assert(dismissed > 0);
  assert(Object.values(values).every((value) => value === ''));
  assert.deepEqual(errors, {});
  assert.equal(drafts['card:new'], undefined);
  const cleared = nodes(render());
  assert(!cleared.some((node) => node.type === 'CardReadScreen'));
  assert.equal(
    (
      cleared.find((node) => node.props.accessibilityLabel === 'Card details')!
        .props.accessibilityState as {expanded: boolean}
    ).expanded,
    false
  );
  autosave({values});
  cleared.find((node) => node.props.accessibilityLabel === 'Back to cards')!
    .props.onPress!();
  assert.equal(drafts['card:new'], undefined);
  values = {...values, variant: 'IOCL'};
  autosave({values});
  assert(drafts['card:new']);
  const edited = nodes(render(filled));
  assert(
    !edited.some(
      (node) => node.props.accessibilityLabel === 'Clear all card details'
    )
  );
  assert(
    !edited.some(
      (node) =>
        node.type === 'Pressable' &&
        nodes(node).some((child) => child.props?.children === 'Clear All')
    )
  );
});

test('lookup reset cancels stale results and clears manual/autofill state for the next card', async () => {
  const runtime = hooks();
  const timers = new Map<number, () => void>();
  const requests: {signal: AbortSignal; resolve: (details: object) => void}[] =
    [];
  const writes: unknown[] = [];
  let timer = 0;
  const {useCardBinLookup} = load<{
    useCardBinLookup: (args: object) => {
      start: (number: string) => void;
      reset: () => void;
      getDraftAutofill: () => {
        manualFields: string[];
        automaticFields: string[];
      };
    };
  }>(
    'src/features/cards/useCardBinLookup.ts',
    {
      react: runtime.react,
      '../../core/errors/VaultError': {},
      '../../core/security/sessionStore': {
        useSessionStore: {
          getState: () => ({status: 'unlocked', generation: 1}),
        },
      },
      '../../core/validation/cardRules': {
        cardDetailFields: ['bank'],
        cardDetailLabels: {bank: 'Bank'},
      },
      './cardBinLookup': {
        cardBinPrefix: (number: string) => number.slice(0, 8),
        isCardBinLookupConfigured: () => true,
        lookupCardBin: (_bin: string, signal: AbortSignal) =>
          new Promise((resolve) => requests.push({signal, resolve})),
      },
    },
    {
      AbortController,
      setTimeout: (callback: () => void) => {
        timers.set(++timer, callback);
        return timer;
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
  );
  const lookup = runtime.render(() =>
    useCardBinLookup({
      initialValues: {...filled, number: ''},
      restoredDraft: true,
      initialAutofill: {manualFields: ['bank'], automaticFields: ['bank']},
      getValues: () => filled.number,
      setValue: (...args: unknown[]) => writes.push(args),
      generation: 1,
    })
  );
  const startRequest = () => {
    lookup.start(filled.number);
    const entry = [...timers][0];
    assert(entry);
    const [id, callback] = entry;
    timers.delete(id);
    callback();
  };
  const details = {
    bin: filled.number.slice(0, 8),
    bank: 'Synthetic Detected Bank',
    missingFields: [],
    warnings: [],
  };
  startRequest();
  lookup.reset();
  const first = requests[0];
  assert(first);
  assert.equal(first.signal.aborted, true);
  assert.equal(timers.size, 0);
  assert.equal(lookup.getDraftAutofill().manualFields.length, 0);
  assert.equal(lookup.getDraftAutofill().automaticFields.length, 0);
  first.resolve(details);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(writes.length, 0);
  startRequest();
  assert.equal(requests.length, 2);
  const second = requests[1];
  assert(second);
  second.resolve(details);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(writes.length, 1);
  assert.equal(lookup.getDraftAutofill().automaticFields[0], 'bank');
  lookup.reset();
  lookup.start(filled.number);
  assert.equal(timers.size, 1);
  lookup.reset();
  assert.equal(timers.size, 0);
});
