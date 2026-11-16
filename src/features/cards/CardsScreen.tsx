import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  AppState,
  BackHandler,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Feather from '@expo/vector-icons/Feather';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {useSessionStore} from '../../core/security/sessionStore';
import type {VaultCard} from '../../core/vault/models';
import {Screen} from '../../shared/components/Screen';
import {BrandMark} from '../../shared/components/BrandMark';
import {EmptyState} from '../../shared/components/EmptyState';
import {Button} from '../../shared/components/Button';
import {TextField} from '../../shared/components/TextField';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {useHaptics} from '../../shared/hooks/useHaptics';
import type {DropdownPlacement} from '../../shared/components/Dropdown';
import {CardFace, type CardActionDirection} from './CardFace';
import {CardFilters, type CardMenuKind} from './CardFilters';
import {CardFilterDropdown, type CardDropdownState} from './CardFilterDropdown';
import {CardActionTray} from './CardActionMenu';
import {
  cardFilterOptions,
  initialCardFilter,
  selectCards,
  type CardFilterOption,
} from './cardSelectors';
import {createCardSearch} from './cardSearch';

const emptyCards: VaultCard[] = [];

function optionLabel(
  options: CardFilterOption[],
  key: string | null
): string | null {
  return key === null
    ? null
    : (options.find((option) => option.key === key)?.label ?? null);
}

type NativeAnchor = ComponentRef<typeof View>;
type CollectionMenu = {type: 'filters'; value: CardDropdownState};
type RevealedCard = {id: string; direction: CardActionDirection};
const visibleSliver = 0.2;
const trayGap = 12;
const closeDuration = 280;
const trayExit = FadeOut.duration(closeDuration)
  .easing(Easing.bezier(0.22, 1, 0.36, 1))
  .reduceMotion(ReduceMotion.System);

function CardCollectionItem({
  card,
  index,
  direction,
  onEdit,
  onReveal,
  onClose,
}: {
  card: VaultCard;
  index: number;
  direction: CardActionDirection | null;
  onEdit: (value: VaultCard) => void;
  onReveal: (value: VaultCard, direction: CardActionDirection) => void;
  onClose: () => void;
}) {
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const open = direction !== null;
  useEffect(() => {
    const target =
      open && width > 0 ? direction * width * (1 - visibleSliver) : 0;
    offset.value = withTiming(target, {
      duration: open ? 320 : closeDuration,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      reduceMotion: ReduceMotion.System,
    });
  }, [direction, offset, open, width]);
  const cardMotion = useAnimatedStyle(() => ({
    transform: [{translateX: offset.value}],
  }));
  const trayMotion = useAnimatedStyle(() => {
    const progress =
      width > 0
        ? Math.min(1, Math.abs(offset.value) / (width * (1 - visibleSliver)))
        : 0;
    return {opacity: progress, transform: [{scale: 0.94 + progress * 0.06}]};
  });
  const showActions = useCallback(
    (value: CardActionDirection) => onReveal(card, value),
    [card, onReveal]
  );
  const traySide = direction === 1 ? {left: 0} : {right: 0};
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 5) * 45)
        .duration(280)
        .reduceMotion(ReduceMotion.System)}
      style={styles.cardItem}>
      <View
        style={styles.cardSlot}
        onTouchStart={open ? (event) => event.stopPropagation() : undefined}
        onAccessibilityEscape={onClose}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {open ? (
          <Animated.View
            exiting={trayExit}
            style={[
              styles.tray,
              traySide,
              {width: Math.max(0, width * (1 - visibleSliver) - trayGap)},
              trayMotion,
            ]}>
            <CardActionTray card={card} onEdit={onEdit} onClose={onClose} />
          </Animated.View>
        ) : null}
        <Animated.View
          style={cardMotion}
          importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={open}>
          <CardFace card={card} onActions={showActions} />
        </Animated.View>
        {open ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close actions for ${card.bank} card ending ${card.number.slice(-4)}`}
            onPress={onClose}
            style={[
              styles.sliver,
              direction === 1 ? {right: 0} : {left: 0},
              {width: width * visibleSliver},
            ]}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

export function CardsScreen({
  onOpenCard,
}: {
  onOpenCard: (card: VaultCard | null) => void;
}) {
  const {colors} = useTheme();
  const haptic = useHaptics();
  const cards = useSessionStore((state) => state.snapshot?.cards ?? emptyCards);
  const [selectedFilter, setFilter] = useState(initialCardFilter);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const search = useMemo(() => createCardSearch(cards), [cards]);
  const options = useMemo(() => cardFilterOptions(cards), [cards]);
  const filter = useMemo(
    () => ({
      ...selectedFilter,
      holder:
        optionLabel(options.holders, selectedFilter.holder) === null
          ? null
          : selectedFilter.holder,
      bank:
        optionLabel(options.banks, selectedFilter.bank) === null
          ? null
          : selectedFilter.bank,
    }),
    [options, selectedFilter]
  );
  const [menu, setMenu] = useState<CollectionMenu | null>(null);
  const viewport = useRef<NativeAnchor>(null);
  const menuRequest = useRef(0);
  const [revealed, setRevealed] = useState<RevealedCard | null>(null);
  const closeMenu = useCallback(() => {
    menuRequest.current++;
    setMenu(null);
    setRevealed(null);
  }, []);
  const closeCardActions = useCallback(() => setRevealed(null), []);
  const resetCollection = useCallback(() => {
    setFilter(initialCardFilter);
    setQuery('');
    closeMenu();
  }, [closeMenu]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        closeMenu();
        Keyboard.dismiss();
      }
    });
    return () => subscription.remove();
  }, [closeMenu]);
  useEffect(() => {
    if (!revealed) return undefined;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setRevealed(null);
        return true;
      }
    );
    return () => subscription.remove();
  }, [revealed]);
  useFocusEffect(useCallback(() => closeMenu, [closeMenu]));
  const openMenu = useCallback(
    (
      anchor: NativeAnchor,
      create: (placement: DropdownPlacement) => CollectionMenu
    ) => {
      const request = ++menuRequest.current;
      anchor.measureInWindow((x, y, width, height) => {
        viewport.current?.measureInWindow(
          (screenX, screenY, screenWidth, screenHeight) => {
            if (
              menuRequest.current !== request ||
              width <= 0 ||
              screenWidth <= 0 ||
              screenHeight <= 0
            )
              return;
            setMenu(
              create({
                anchor: {x: x - screenX, y: y - screenY, width, height},
                viewport: {width: screenWidth, height: screenHeight},
              })
            );
          }
        );
      });
    },
    []
  );
  const openFilterMenu = useCallback(
    (kind: CardMenuKind, anchor: NativeAnchor) => {
      openMenu(anchor, (placement) => ({
        type: 'filters',
        value: {...placement, kind},
      }));
    },
    [openMenu]
  );
  const revealCardActions = useCallback(
    (card: VaultCard, direction: CardActionDirection) => {
      haptic();
      menuRequest.current++;
      setMenu(null);
      setRevealed({id: card.id, direction});
    },
    [haptic]
  );
  const editCard = useCallback(
    (card: VaultCard | null) => {
      Keyboard.dismiss();
      closeMenu();
      onOpenCard(card);
    },
    [closeMenu, onOpenCard]
  );
  const activeMenu = menu;
  const filtered = useMemo(
    () => selectCards(search(deferredQuery), filter),
    [deferredQuery, filter, search]
  );
  const hasFilters = filter.holder !== null || filter.bank !== null;
  const hasSearch = Boolean(deferredQuery.trim());
  return (
    <Screen>
      <View
        ref={viewport}
        collapsable={false}
        style={styles.viewport}
        onTouchStart={closeCardActions}
        onLayout={closeMenu}>
        <View
          style={styles.viewport}
          accessibilityElementsHidden={activeMenu !== null}
          importantForAccessibility={
            activeMenu ? 'no-hide-descendants' : 'auto'
          }>
          <FlatList
            data={filtered}
            keyExtractor={(card) => card.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            extraData={revealed}
            onScrollBeginDrag={closeMenu}
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <View style={styles.header}>
                <View style={styles.brandRow}>
                  <View style={styles.wordmark}>
                    <BrandMark size={32} />
                    <Text style={[styles.brand, {color: colors.textPrimary}]}>
                      CARDVAULT
                    </Text>
                  </View>
                  <View style={styles.privacy}>
                    <View
                      style={[
                        styles.privacyDot,
                        {backgroundColor: colors.success},
                      ]}
                    />
                    <Text
                      style={[
                        styles.privacyLabel,
                        {color: colors.textSecondary},
                      ]}>
                      ONLY ON YOUR DEVICE
                    </Text>
                  </View>
                </View>
                <View style={styles.collection}>
                  <View style={styles.introduction}>
                    <Text
                      accessibilityRole="header"
                      style={[styles.headline, {color: colors.textPrimary}]}>
                      Your collection.
                    </Text>
                    <Text
                      style={[styles.subtitle, {color: colors.textSecondary}]}>
                      <Text style={[styles.total, {color: colors.textPrimary}]}>
                        {cards.length.toLocaleString()}{' '}
                        {cards.length === 1 ? 'card' : 'cards'}
                      </Text>
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add a card"
                    onPress={() => editCard(null)}
                    style={({pressed}) => [
                      styles.add,
                      {
                        backgroundColor: colors.accent,
                        transform: [{scale: pressed ? 0.94 : 1}],
                      },
                    ]}>
                    <Feather
                      name="plus"
                      size={22}
                      color={colors.onAccent}
                      accessible={false}
                    />
                  </Pressable>
                </View>
                {cards.length ? (
                  <View
                    style={[
                      styles.search,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Feather
                      name="search"
                      size={18}
                      color={colors.textSecondary}
                      accessible={false}
                    />
                    <TextField
                      variant="plain"
                      containerStyle={styles.searchInput}
                      style={styles.searchText}
                      accessibilityLabel="Search cards"
                      accessibilityHint="Search bank, variant, name, tier, network, type, country or card number. Expiry and CVV are not searched."
                      placeholder="Search your cards"
                      value={query}
                      maxLength={120}
                      returnKeyType="search"
                      onFocus={closeMenu}
                      onChangeText={(value) => {
                        closeMenu();
                        setQuery(value);
                      }}
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    {query ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear card search"
                        onPress={() => setQuery('')}
                        style={styles.clearSearch}>
                        <Feather
                          name="x"
                          size={18}
                          color={colors.textSecondary}
                          accessible={false}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {cards.length ? (
                  <CardFilters
                    filter={filter}
                    holderLabel={optionLabel(options.holders, filter.holder)}
                    bankLabel={optionLabel(options.banks, filter.bank)}
                    openMenu={activeMenu ? activeMenu.value.kind : null}
                    onOpen={(kind, anchor) => {
                      setRevealed(null);
                      openFilterMenu(kind, anchor);
                    }}
                  />
                ) : null}
                {hasFilters || hasSearch ? (
                  <View style={styles.filterSummary}>
                    <Text
                      accessibilityLiveRegion="polite"
                      numberOfLines={1}
                      style={[styles.summary, {color: colors.textSecondary}]}>
                      {filtered.length.toLocaleString()} of{' '}
                      {cards.length.toLocaleString()} cards
                      {filter.holder
                        ? ` / ${optionLabel(options.holders, filter.holder)}`
                        : ''}
                      {filter.bank
                        ? ` / ${optionLabel(options.banks, filter.bank)}`
                        : ''}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear card search and filters"
                      onPress={resetCollection}
                      style={styles.reset}>
                      <Text style={[styles.resetText, {color: colors.accent}]}>
                        Reset
                      </Text>
                      <Feather
                        name="rotate-ccw"
                        size={11}
                        color={colors.accent}
                        accessible={false}
                      />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <View style={{paddingHorizontal: 24}}>
                <EmptyState
                  icon="credit-card"
                  title={
                    cards.length
                      ? 'No cards found.'
                      : 'Your first card belongs here.'
                  }
                  description={
                    cards.length
                      ? 'Try another search, name, or bank.'
                      : 'Keep the details you reach for, without carrying the worry.'
                  }
                />
                <Button
                  title={
                    cards.length
                      ? 'Clear search and filters'
                      : 'Add your first card'
                  }
                  icon={cards.length ? 'filter' : 'plus'}
                  onPress={() => {
                    if (cards.length) resetCollection();
                    else editCard(null);
                  }}
                />
              </View>
            }
            renderItem={({item, index}) => (
              <CardCollectionItem
                card={item}
                index={index}
                direction={revealed?.id === item.id ? revealed.direction : null}
                onEdit={editCard}
                onReveal={revealCardActions}
                onClose={closeCardActions}
              />
            )}
          />
        </View>
        {activeMenu ? (
          <CardFilterDropdown
            menu={activeMenu.value}
            options={options}
            filter={filter}
            onChange={setFilter}
            onClose={closeMenu}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewport: {flex: 1},
  content: {paddingBottom: 28},
  header: {paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 22},
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordmark: {flexDirection: 'row', alignItems: 'center', gap: 8},
  brand: {...typography.eyebrow},
  privacy: {flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1},
  privacyDot: {width: 4, height: 4, borderRadius: 2},
  privacyLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  collection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  introduction: {flex: 1, minWidth: 0, gap: 8},
  headline: {...typography.hero},
  subtitle: {...typography.label},
  total: {fontWeight: '600', fontVariant: ['tabular-nums']},
  add: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {flex: 1, minWidth: 0},
  searchText: {minHeight: 46, fontSize: 15},
  clearSearch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSummary: {
    marginTop: -13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summary: {
    ...typography.caption,
    flex: 1,
    minWidth: 0,
    fontVariant: ['tabular-nums'],
  },
  reset: {minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6},
  resetText: {...typography.caption, fontWeight: '600'},
  cardItem: {paddingHorizontal: 24, paddingBottom: 20},
  cardSlot: {position: 'relative'},
  tray: {position: 'absolute', top: 0, bottom: 0, justifyContent: 'center'},
  sliver: {position: 'absolute', top: 0, bottom: 0},
});
