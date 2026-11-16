import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import type {VaultCard} from '../src/core/vault/models';
import {createCardSearch} from '../src/features/cards/cardSearch';
import * as selectors from '../src/features/cards/cardSelectors';

const card: VaultCard = {
  id: 'synthetic-federal-credit',
  bank: 'Federal Bank',
  variant: 'Scapia',
  holder: 'Alex Example',
  tier: 'Platinum',
  network: 'Visa',
  type: 'Credit',
  country: 'India',
  number: '0000000000003711',
  expiry: '09/2098',
  cvv: '986',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const cards: VaultCard[] = [
  card,
  {
    ...card,
    id: 'synthetic-federal-debit',
    variant: 'IOCL',
    holder: 'Blair Example',
    type: 'Debit',
    number: '0000000000003712',
  },
  {
    ...card,
    id: 'synthetic-axis',
    bank: 'Axis Bank',
    variant: undefined,
    holder: 'Casey Example',
    network: 'Mastercard',
    number: '0000000000008145',
    tier: undefined,
    country: undefined,
    createdAt: '2020-01-01T00:00:00.000Z',
  },
];
const ids = (values: VaultCard[]) => values.map((value) => value.id);

test('bank options contain only saved banks and selection always sorts by bank name', () => {
  const options = selectors.cardFilterOptions([
    ...cards,
    {...card, id: 'duplicate-label', bank: 'Federal Bank Ltd.'},
  ]);
  assert.deepEqual(options.banks, [
    {key: 'axis', label: 'Axis'},
    {key: 'federal', label: 'Federal'},
  ]);
  assert.deepEqual(Object.keys(options), ['holders', 'banks']);
  const original = [...cards];
  assert.deepEqual(
    ids(selectors.selectCards(cards, selectors.initialCardFilter)),
    ['synthetic-axis', 'synthetic-federal-credit', 'synthetic-federal-debit']
  );
  assert.deepEqual(cards, original);
  assert.deepEqual(
    ids(
      selectors.selectCards(cards, {holder: 'blair example', bank: 'federal'})
    ),
    ['synthetic-federal-debit']
  );
  assert.deepEqual(
    selectors.selectCards(cards, {holder: 'blair example', bank: 'axis'}),
    []
  );
});

test('fuzzy search combines words across fields and keeps card types and numbers distinct', () => {
  const search = createCardSearch(cards);
  for (const query of [
    'fedral scapia credit',
    'SCAPIA',
    '3711',
    '0000000000003711',
  ]) {
    assert.deepEqual(ids(search(query)), [card.id], query);
  }
  assert.deepEqual(ids(search('fedral')), [card.id, cards[1]!.id]);
  assert.deepEqual(ids(search('fedrl debit')), [cards[1]!.id]);
  assert.deepEqual(ids(search('fedrl debt')), [cards[1]!.id]);
  assert.deepEqual(search('fedral scapia debit'), []);
  assert.deepEqual(search('3713'), []);
  assert.deepEqual(search('0000 0000 0000 3711'), [card]);
  assert.deepEqual(
    ids(selectors.selectCards(search('credit'), selectors.initialCardFilter)),
    ['synthetic-axis', card.id]
  );
  assert.equal(search(''), cards);
  assert.equal(search('   '), cards);
  assert.deepEqual(createCardSearch([])('scapia'), []);
});

test('search allows only card details, never expiry, CVV, record IDs or timestamps', () => {
  const search = createCardSearch([card]);
  for (const query of [
    'federal',
    'scapia',
    'alex',
    'platinum',
    'visa',
    'credit',
    'india',
    '3711',
  ])
    assert.deepEqual(search(query), [card], query);
  for (const query of ['986', '2098', '09/2098', card.id, '2026']) {
    assert.deepEqual(search(query), [], query);
  }
  const accented = {...card, holder: 'José Example'};
  assert.deepEqual(createCardSearch([accented])('jose'), [accented]);
  const legacy = {...cards[2]!, type: undefined};
  assert.deepEqual(createCardSearch([legacy])('axis mastercard'), [legacy]);
});

test('bank and network abbreviations match full names and aliases in both directions', () => {
  const examples = [
    {...card, id: 'amex', bank: 'American Express', network: 'Amex'},
    {
      ...card,
      id: 'hsbc',
      bank: 'The Hongkong and Shanghai Banking Corporation Limited',
    },
    {...card, id: 'sbi', bank: 'State Bank of India'},
    {...card, id: 'pnb', bank: 'Punjab National Bank Ltd.'},
  ];
  const search = createCardSearch(examples);
  for (const [query, expected] of [
    ['AE', 'amex'],
    ['amex', 'amex'],
    ['HSBC', 'hsbc'],
    ['SBI', 'sbi'],
    ['ABI', 'sbi'],
    ['PNB', 'pnb'],
    ['ae credit', 'amex'],
  ] as const)
    assert.deepEqual(ids(search(query)), [expected], query);
  const abbreviated = createCardSearch([
    {...card, id: 'amex', bank: 'Amex', network: 'Amex'},
    {...card, id: 'hsbc', bank: 'HSBC'},
    {...card, id: 'sbi', bank: 'SBI'},
  ]);
  assert.deepEqual(ids(abbreviated('american express')), ['amex']);
  assert.deepEqual(ids(abbreviated('hongkong shanghai')), ['hsbc']);
  assert.deepEqual(ids(abbreviated('state bank of inida')), ['sbi']);
  assert.deepEqual(
    ids(
      createCardSearch([{...card, bank: 'HDFC', network: 'American Express'}])(
        'AE'
      )
    ),
    [card.id]
  );
});

test('bank aliases tolerate a misspelled full name without aliasing unrelated banks', () => {
  const typo = {...card, id: 'hsbc-typo', bank: 'Hongbok and Shanghai Bank'};
  const other = {...card, id: 'mizuho', bank: 'Mizuho Bank'};
  const search = createCardSearch([typo, other]);
  assert.deepEqual(ids(search('HSBC')), ['hsbc-typo']);
  assert.deepEqual(search('MUFG'), []);
  assert.deepEqual(search('3713'), []);
  assert.deepEqual(search('986'), []);
  assert.deepEqual(search('AB'), []);
});

type Element = {
  type: string;
  props: Record<string, unknown> & {children?: unknown};
};
function nodes(value: unknown): Element[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Element;
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
function load<T>(file: string, modules: Record<string, unknown>): T {
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
  });
  return exports as T;
}

function collectionHarness() {
  let index = 0;
  const state: unknown[] = [];
  const cleanups: (() => void)[] = [];
  let onStateChange = (_state: string) => {};
  const react = {
    useState<T>(initial: T) {
      const key = index++;
      if (!(key in state)) state[key] = initial;
      return [state[key], (next: T) => (state[key] = next)];
    },
    useRef<T>(initial: T) {
      const key = index++;
      state[key] ??= {current: initial};
      return state[key];
    },
    useMemo: <T>(callback: () => T) => callback(),
    useCallback: <T>(callback: T) => callback,
    useDeferredValue: <T>(value: T) => value,
    useEffect: (effect: () => (() => void) | undefined) => {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    },
  };
  const jsx = (type: string, props: Element['props']) => ({type, props});
  const animations: {target: number; duration: number}[] = [];
  const fade = {
    delay: () => fade,
    duration: () => fade,
    easing: () => fade,
    reduceMotion: () => fade,
  };
  const modules: Record<string, unknown> = {
    react,
    'react/jsx-runtime': {jsx, jsxs: jsx},
    'react-native': {
      AppState: {
        addEventListener: (_event: string, listener: typeof onStateChange) => {
          onStateChange = listener;
          return {remove() {}};
        },
      },
      BackHandler: {addEventListener: () => ({remove() {}})},
      FlatList: 'FlatList',
      Keyboard: {dismiss() {}},
      Pressable: 'Pressable',
      StyleSheet: {create: (value: object) => value},
      Text: 'Text',
      View: 'View',
      useWindowDimensions: () => ({width: 320, fontScale: 2}),
    },
    '@react-navigation/native': {useFocusEffect() {}},
    '@expo/vector-icons/Feather': {default: 'Feather'},
    'react-native-reanimated': {
      default: {View: 'AnimatedView'},
      Easing: {bezier() {}},
      FadeInDown: fade,
      FadeOut: fade,
      ReduceMotion: {System: 'system'},
      useSharedValue: (value: number) => ({value}),
      useAnimatedStyle: (callback: () => object) => callback(),
      withTiming: (target: number, config: {duration: number}) => {
        animations.push({target, duration: config.duration});
        return target;
      },
    },
    '../../core/security/sessionStore': {
      useSessionStore: () => cards,
    },
    '../../shared/theme/ThemeProvider': {useTheme: () => ({colors: {}})},
    '../../shared/theme/typography': {typography: {}},
    '../../shared/hooks/useHaptics': {useHaptics: () => () => {}},
    './cardSelectors': selectors,
    './cardSearch': {createCardSearch},
  };
  for (const [path, name] of [
    ['../../shared/components/Screen', 'Screen'],
    ['../../shared/components/BrandMark', 'BrandMark'],
    ['../../shared/components/EmptyState', 'EmptyState'],
    ['../../shared/components/Button', 'Button'],
    ['../../shared/components/TextField', 'TextField'],
    ['./CardFace', 'CardFace'],
    ['./CardFilters', 'CardFilters'],
    ['./CardFilterDropdown', 'CardFilterDropdown'],
    ['./CardActionMenu', 'CardActionTray'],
  ] as const)
    modules[path] = {[name]: name};
  const {CardsScreen} = load<{
    CardsScreen: (props: {onOpenCard: () => void}) => Element;
  }>('src/features/cards/CardsScreen.tsx', modules);
  const render = (component = () => CardsScreen({onOpenCard() {}})) => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    index = 0;
    return nodes(component());
  };
  return {
    render,
    modules,
    animations,
    fade,
    onStateChange: (value: string) => onStateChange(value),
    reset() {
      cleanups.splice(0).forEach((cleanup) => cleanup());
      state.length = 0;
    },
  };
}

test('collection search and filters survive backgrounding but reset on a fresh launch, with no sort/network controls', () => {
  const {render, modules, onStateChange, reset} = collectionHarness();
  const list = (tree: Element[]) =>
    tree.find((node) => node.type === 'FlatList')!;
  const header = (tree: Element[]) =>
    nodes(list(tree).props.ListHeaderComponent);
  const setQuery = (tree: Element[], value: string) =>
    (
      header(tree).find((node) => node.type === 'TextField')!.props
        .onChangeText as (query: string) => void
    )(value);
  const tree = render();
  assert.deepEqual(ids(list(tree).props.data as VaultCard[]), [
    'synthetic-axis',
    card.id,
    cards[1]!.id,
  ]);
  setQuery(tree, 'fedrl debit');
  const searched = render();
  assert.deepEqual(ids(list(searched).props.data as VaultCard[]), [
    cards[1]!.id,
  ]);
  const viewport = searched.find((node) => node.props.collapsable === false)!;
  const anchor = {
    measureInWindow: (
      callback: (x: number, y: number, width: number, height: number) => void
    ) => callback(0, 0, 320, 640),
  };
  (viewport.props.ref as {current: object}).current = anchor;
  const searchFilters = header(searched).find(
    (node) => node.type === 'CardFilters'
  )!;
  (searchFilters.props.onOpen as (kind: string, anchor: object) => void)(
    'bank',
    anchor
  );
  const dropdown = render().find((node) => node.type === 'CardFilterDropdown')!;
  assert.deepEqual(Object.keys(dropdown.props.options as object), [
    'holders',
    'banks',
  ]);
  (dropdown.props.onChange as (filter: selectors.CardFilter) => void)({
    holder: 'blair example',
    bank: 'federal',
  });
  const selected = header(render()).find(
    (node) => node.type === 'CardFilters'
  )!;
  assert.equal((selected.props.filter as selectors.CardFilter).bank, 'federal');
  for (const appState of ['inactive', 'background', 'active']) {
    onStateChange(appState);
    const resumed = render();
    assert.equal(
      header(resumed).find((node) => node.type === 'TextField')!.props.value,
      'fedrl debit'
    );
    assert.deepEqual(
      {
        ...(header(resumed).find((node) => node.type === 'CardFilters')!.props
          .filter as object),
      },
      {holder: 'blair example', bank: 'federal'}
    );
    assert.deepEqual(ids(list(resumed).props.data as VaultCard[]), [
      cards[1]!.id,
    ]);
    assert.equal(
      resumed.find((node) => node.type === 'CardFilterDropdown'),
      undefined
    );
  }
  reset();
  const reopened = render();
  assert.equal(
    header(reopened).find((node) => node.type === 'TextField')!.props.value,
    ''
  );
  const filters = header(reopened).find((node) => node.type === 'CardFilters')!;
  assert.deepEqual(
    {...(filters.props.filter as object)},
    {holder: null, bank: null}
  );
  setQuery(reopened, 'no-such-card-zzzz');
  const empty = render();
  assert.deepEqual(list(empty).props.data, []);
  const emptyButton = nodes(list(empty).props.ListEmptyComponent).find(
    (node) => node.type === 'Button'
  )!;
  (emptyButton.props.onPress as () => void)();
  assert.equal((list(render()).props.data as VaultCard[]).length, cards.length);
  const {CardFilters} = load<{
    CardFilters: (props: object) => Element;
  }>('src/features/cards/CardFilters.tsx', modules);
  const controls = nodes(CardFilters(filters.props)).filter(
    (node) => typeof node.type === 'function'
  );
  assert.deepEqual(
    controls.map((node) => node.props.kind),
    ['holder', 'bank']
  );
  modules['../../shared/components/Dropdown'] = {Dropdown: 'Dropdown'};
  (modules['react-native'] as Record<string, unknown>).SectionList =
    'SectionList';
  const {CardFilterDropdown} = load<{
    CardFilterDropdown: (props: object) => Element;
  }>('src/features/cards/CardFilterDropdown.tsx', modules);
  const bankMenu = nodes(CardFilterDropdown(dropdown.props));
  const sections = bankMenu.find((node) => node.type === 'SectionList')!.props
    .sections as {data: {label: string}[]}[];
  assert.deepEqual(
    Array.from(sections[0]!.data, (option) => option.label),
    ['All banks', 'Axis', 'Federal']
  );
  assert.equal(sections.length, 1);
  reset();
});

test('outside touches close either action tray while inside touches keep its buttons usable', () => {
  const {render, animations, fade, reset} = collectionHarness();
  type ItemProps = {
    card: VaultCard;
    index: number;
    direction: -1 | 1 | null;
    onReveal: (card: VaultCard, direction: -1 | 1) => void;
    onClose: () => void;
  };
  const item = (tree: Element[]) =>
    (
      tree.find((node) => node.type === 'FlatList')!.props
        .renderItem as (info: {item: VaultCard; index: number}) => {
        type: (props: ItemProps) => Element;
        props: ItemProps;
      }
    )({item: card, index: 0});
  for (const direction of [-1, 1] as const) {
    reset();
    item(render()).props.onReveal(card, direction);
    const opened = render();
    const active = item(opened);
    assert.equal(active.props.direction, direction);
    (
      opened.find((node) => node.props.collapsable === false)!.props
        .onTouchStart as () => void
    )();
    assert.equal(item(render()).props.direction, null);

    reset();
    let closed = 0;
    const row = (value: -1 | 1 | null) =>
      render(() =>
        active.type({
          ...active.props,
          direction: value,
          onClose: () => closed++,
        })
      );
    const initial = row(direction);
    (
      initial.find((node) => node.props.onLayout)!.props.onLayout as (event: {
        nativeEvent: {layout: {width: number}};
      }) => void
    )({nativeEvent: {layout: {width: 320}}});
    const shown = row(direction);
    assert.equal(animations.at(-1)!.target, direction * 320 * 0.8);
    const slot = shown.find((node) => node.props.onTouchStart)!;
    let stopped = false;
    (slot.props.onTouchStart as (event: {stopPropagation: () => void}) => void)(
      {stopPropagation: () => (stopped = true)}
    );
    assert(stopped);
    assert.equal(closed, 0);
    const tray = shown.find((node) => node.props.exiting)!;
    assert.equal(tray.props.exiting, fade);
    assert.equal(
      (tray.props.style as Record<string, unknown>[])[1]![
        direction === 1 ? 'left' : 'right'
      ],
      0
    );
    const actionTray = shown.find((node) => node.type === 'CardActionTray')!;
    (actionTray.props.onClose as () => void)();
    assert.equal(closed, 1);
    const closing = row(null);
    assert.equal(animations.at(-1)!.target, 0);
    assert.equal(animations.at(-1)!.duration, 280);
    assert.equal(
      closing.find((node) => node.type === 'CardActionTray'),
      undefined
    );
    assert.equal(
      closing.find((node) => node.props.onTouchStart),
      undefined
    );
  }
  reset();
});
