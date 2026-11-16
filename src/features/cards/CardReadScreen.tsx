import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  CardCameraView,
  CardReader,
  type CardCameraProps,
  type ReadCardDetails,
} from '../../../modules/card-reader';
import {useSessionStore} from '../../core/security/sessionStore';
import {errorMessage, VaultError} from '../../core/errors/VaultError';
import {reportError} from '../../core/errors/noticeStore';
import {
  cardEntryLimits,
  cardExpiryInput,
  numericCardInput,
} from '../../core/validation/cardRules';
import {TextField} from '../../shared/components/TextField';
import {useTheme} from '../../shared/theme/ThemeProvider';
import {typography} from '../../shared/theme/typography';
import {
  cardReadReviewSchema,
  createCardReadReview,
  parseCameraCard,
  parseNfcCard,
  selectStableCameraCard,
  type CardReadMethod,
  type CardReadReview,
} from './cardReadResults';

interface Props {
  method: CardReadMethod;
  existing: CardReadReview;
  generation: number;
  onClose: () => void;
  onUse: (details: CardReadReview) => void;
}

export function CardReadScreen(props: Props) {
  const [attempt, setAttempt] = useState(0);
  return (
    <CardReadAttempt
      key={`${props.method}-${props.generation}-${attempt}`}
      {...props}
      requestId={attempt}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function CardReadAttempt({
  method,
  existing,
  generation,
  onClose,
  onUse,
  requestId,
  onRetry,
}: Props & {requestId: number; onRetry: () => void}) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const camera = method === 'camera';
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState(
    camera
      ? 'Preparing on-device scanner...'
      : 'Hold one contactless card against the back of your phone.'
  );
  const [error, setError] = useState<string>();
  const [settings, setSettings] = useState<'camera' | 'nfc' | null>(null);
  const [review, setReview] = useState<CardReadReview | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CardReadReview, string>>
  >({});
  const [ready, setReady] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [focusPoint, setFocusPoint] = useState({x: 0.5, y: 0.5, request: 0});
  const [cameraNotice, setCameraNotice] = useState<string>();
  const [enhance, setEnhance] = useState(false);
  const [enhanceAllowed, setEnhanceAllowed] = useState(true);
  const mounted = useRef(false);
  const paused = useRef(false);
  const readingStarted = useRef(false);
  const reviewing = useRef(false);
  const submitted = useRef(false);
  const stable = useRef<(ReadCardDetails | null)[]>([]);
  const enhancedStable = useRef<(ReadCardDetails | null)[]>([]);
  const confirmedNumber = useRef<{number: string; since: number} | null>(null);
  const analyzedFrames = useRef(0);
  const previewSize = useRef({width: 0, height: 0});
  const cameraTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaults = useRef(existing);
  const darkCamera = camera && !review;
  const foreground = darkCamera ? '#F3F6FC' : colors.textPrimary;
  const secondary = darkCamera ? '#ACB9CC' : colors.textSecondary;
  const background = darkCamera ? '#101824' : colors.surface;

  const isCurrent = useCallback(() => {
    const session = useSessionStore.getState();
    return (
      mounted.current &&
      !paused.current &&
      session.status === 'unlocked' &&
      session.generation === generation &&
      AppState.currentState === 'active'
    );
  }, [generation]);
  const clearCameraTimeout = useCallback(() => {
    if (cameraTimeout.current !== null) clearTimeout(cameraTimeout.current);
    cameraTimeout.current = null;
  }, []);
  const clearReadings = useCallback(() => {
    stable.current = [];
    enhancedStable.current = [];
    confirmedNumber.current = null;
    analyzedFrames.current = 0;
  }, []);
  const showReview = useCallback(
    (details: ReadCardDetails) => {
      reviewing.current = true;
      clearReadings();
      setEnhance(false);
      clearCameraTimeout();
      setCameraActive(false);
      setError(undefined);
      setReview(createCardReadReview(details, defaults.current));
    },
    [clearCameraTimeout, clearReadings]
  );

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    paused.current = false;
    function pause() {
      if (!reviewing.current && !paused.current) {
        paused.current = true;
        clearReadings();
        clearCameraTimeout();
        setCameraActive(false);
        setError('Reading paused. Return to Cardvault and tap Try again.');
        void CardReader?.cancelNfcRead().catch(reportError);
      }
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    const blur = AppState.addEventListener('blur', () => {
      if (readingStarted.current) pause();
    });
    async function start() {
      if (Platform.OS !== 'android' || !CardReader || !CardCameraView) {
        throw new VaultError(
          'storage',
          'Card reading requires the updated Android build of Cardvault. You can still enter details manually.'
        );
      }
      if (camera) {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Scan your card',
            message:
              'Cardvault reads card details on your phone. Photos are not saved or uploaded.',
            buttonPositive: 'Continue',
            buttonNegative: 'Not now',
          }
        );
        if (cancelled || !isCurrent()) return;
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          setSettings('camera');
          throw new VaultError(
            'storage',
            'Allow camera access in Android settings, or enter your card manually.'
          );
        }
        readingStarted.current = true;
        setCameraActive(true);
      } else {
        const status = await CardReader.getNfcStatus();
        if (cancelled || !isCurrent()) return;
        if (status !== 'ready') {
          if (status === 'disabled') setSettings('nfc');
          throw new VaultError(
            'storage',
            status === 'disabled'
              ? 'Turn on NFC in Android settings, then return and tap Try again.'
              : 'This phone does not support NFC card reading. Use the camera or enter details manually.'
          );
        }
        setReady(true);
        readingStarted.current = true;
        const details = await CardReader.readNfcCard();
        if (!cancelled && isCurrent()) showReview(parseNfcCard(details));
      }
    }
    void start().catch((cause) => {
      if (!cancelled && isCurrent()) {
        paused.current = true;
        setCameraActive(false);
        setError(errorMessage(cause));
      }
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      paused.current = true;
      clearCameraTimeout();
      subscription.remove();
      blur.remove();
      clearReadings();
      if (!camera) void CardReader?.cancelNfcRead().catch(reportError);
    };
  }, [camera, clearCameraTimeout, clearReadings, isCurrent, showReview]);

  const onCameraStatus: CardCameraProps['onStatus'] = ({nativeEvent}) => {
    if (
      nativeEvent.requestId !== requestId ||
      !isCurrent() ||
      reviewing.current
    )
      return;
    if (nativeEvent.torchAvailable !== undefined)
      setTorchAvailable(nativeEvent.torchAvailable);
    if (nativeEvent.torchEnabled !== undefined)
      setTorch(nativeEvent.torchEnabled);
    if (nativeEvent.enhancementAvailable === false) {
      setEnhanceAllowed(false);
      setEnhance(false);
    }
    if (nativeEvent.status === 'error') {
      paused.current = true;
      clearReadings();
      clearCameraTimeout();
      setCameraActive(false);
      setError(nativeEvent.message);
    } else if (nativeEvent.status === 'hint') {
      setCameraNotice(nativeEvent.message);
    } else {
      setCameraNotice(undefined);
      setMessage(nativeEvent.message);
      setReady(nativeEvent.status === 'ready');
      if (nativeEvent.status === 'ready' && cameraTimeout.current === null) {
        cameraTimeout.current = setTimeout(() => {
          if (!mounted.current || reviewing.current) return;
          paused.current = true;
          clearReadings();
          setCameraActive(false);
          setError(
            'No stable card number was found. Adjust lighting and try again, or enter details manually.'
          );
        }, 45_000);
      }
    }
  };
  const onCameraText: CardCameraProps['onText'] = ({nativeEvent}) => {
    if (
      nativeEvent.requestId !== requestId ||
      !isCurrent() ||
      reviewing.current
    )
      return;
    try {
      const details = parseCameraCard(nativeEvent.lines, nativeEvent.regions);
      analyzedFrames.current++;
      if (analyzedFrames.current >= 4 && enhanceAllowed) setEnhance(true);
      const observations = nativeEvent.enhanced ? enhancedStable : stable;
      observations.current = [...observations.current.slice(-4), details];
      const confirmed = selectStableCameraCard(observations.current);
      if (confirmed) {
        if (confirmedNumber.current?.number !== confirmed.number)
          confirmedNumber.current = {
            number: confirmed.number,
            since: Date.now(),
          };
        if (
          confirmed.expiry ||
          Date.now() - confirmedNumber.current.since >= 1_800
        )
          showReview(confirmed);
        else
          setMessage(
            'Number confirmed. Keep the expiry sharp while we read it.'
          );
      } else {
        setMessage(
          details
            ? 'Number detected. Hold still while we confirm the details.'
            : nativeEvent.lines.length
              ? 'Text detected. Move closer until the whole number is sharp, or tap to refocus.'
              : 'Keep the card inside the frame. Try the light if it is dim, and tilt to avoid glare.'
        );
      }
    } catch (cause) {
      paused.current = true;
      clearReadings();
      clearCameraTimeout();
      setCameraActive(false);
      setError(errorMessage(cause));
    }
  };

  function refocusCamera(event?: GestureResponderEvent) {
    const {width, height} = previewSize.current;
    const location = event?.nativeEvent;
    // Accessibility activation can have no touch coordinates; keep centre focus for that case.
    const hasLocation =
      location &&
      width > 0 &&
      height > 0 &&
      Number.isFinite(location.locationX) &&
      Number.isFinite(location.locationY);
    const x = hasLocation
      ? Math.max(0, Math.min(1, location.locationX / width))
      : 0.5;
    const y = hasLocation
      ? Math.max(0, Math.min(1, location.locationY / height))
      : 0.5;
    clearReadings();
    setEnhance(false);
    setCameraNotice(undefined);
    setFocusPoint((value) => ({x, y, request: value.request + 1}));
  }
  function useDetails() {
    if (!review || submitted.current) return;
    const result = cardReadReviewSchema.safeParse(review);
    if (!result.success) {
      const errors: Partial<Record<keyof CardReadReview, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === 'number' || field === 'expiry' || field === 'holder')
          errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    if (!isCurrent()) {
      setError(
        'Your session changed. Close this reader and unlock your vault again.'
      );
      return;
    }
    submitted.current = true;
    onUse(result.data);
  }
  async function openSettings() {
    try {
      if (settings === 'camera') await Linking.openSettings();
      else if (settings === 'nfc' && CardReader)
        await CardReader.openNfcSettings();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  return (
    <View
      accessibilityViewIsModal
      style={[styles.overlay, {backgroundColor: background}]}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel card reading"
          onPress={onClose}
          style={styles.cancel}>
          <Feather
            name="chevron-left"
            size={23}
            color={foreground}
            accessible={false}
          />
          <Text style={[styles.cancelText, {color: foreground}]}>Cancel</Text>
        </Pressable>
        <View
          style={[
            styles.badge,
            {backgroundColor: darkCamera ? '#FFFFFF12' : colors.accentMuted},
          ]}>
          <Text
            style={[
              styles.badgeText,
              {color: darkCamera ? '#CAD7EC' : colors.accent},
            ]}>
            {review ? 'REVIEW' : camera ? 'CAMERA' : 'NFC'}
          </Text>
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            {review ? (
              <View
                style={[styles.success, {backgroundColor: colors.accentMuted}]}>
                <Feather
                  name="check"
                  size={27}
                  color={colors.accent}
                  accessible={false}
                />
              </View>
            ) : null}
            <Text
              accessibilityRole="header"
              style={[styles.title, {color: foreground}]}>
              {review
                ? 'Review the details.'
                : camera
                  ? 'Scan your card.'
                  : 'Add with a tap.'}
            </Text>
            <Text style={[styles.subtitle, {color: secondary}]}>
              {review
                ? 'Correct anything that looks wrong and fill any missing details.'
                : camera
                  ? 'Keep the number and expiry in view. Hold the card flat and avoid reflections.'
                  : 'Hold your physical contactless card against the back of your phone.'}
            </Text>
          </View>
          {review ? (
            <View style={styles.reviewFields}>
              <TextField
                label="CARD NUMBER"
                accessibilityLabel="Review card number"
                inputMode="numeric"
                keyboardType="number-pad"
                value={review.number}
                onChangeText={(number) =>
                  setReview({
                    ...review,
                    number: numericCardInput(
                      number,
                      cardEntryLimits.maximumNumberDigits
                    ),
                  })
                }
                error={fieldErrors.number}
                maxLength={19}
              />
              <TextField
                label="EXPIRY DATE"
                accessibilityLabel="Review expiry date"
                placeholder="MM/YY"
                inputMode="numeric"
                keyboardType="number-pad"
                value={review.expiry}
                onChangeText={(expiry) =>
                  setReview({...review, expiry: cardExpiryInput(expiry)})
                }
                error={fieldErrors.expiry}
                maxLength={7}
              />
              <TextField
                label="NAME ON CARD"
                accessibilityLabel="Review name on card"
                placeholder="Add the name printed on your card"
                value={review.holder}
                onChangeText={(holder) => setReview({...review, holder})}
                error={fieldErrors.holder}
                maxLength={80}
              />
              <View style={styles.note}>
                <Feather
                  name="lock"
                  size={15}
                  color={secondary}
                  accessible={false}
                />
                <Text style={[styles.noteText, {color: secondary}]}>
                  CVV stays manual. Use details returns to the editor and looks
                  up bank/network data using only the first 8 corrected digits.
                  This does not verify ownership or whether the card is active.
                </Text>
              </View>
            </View>
          ) : camera ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refocus card camera"
                accessibilityHint="Tap the printed number to focus on it"
                disabled={!ready || Boolean(error)}
                onLayout={({nativeEvent}) => {
                  previewSize.current = {
                    width: nativeEvent.layout.width,
                    height: nativeEvent.layout.height,
                  };
                }}
                onPress={refocusCamera}
                onAccessibilityTap={() => refocusCamera()}
                style={[styles.cameraFrame, {borderColor: '#B8CBE8'}]}>
                {cameraActive && CardCameraView ? (
                  <CardCameraView
                    active
                    requestId={requestId}
                    torch={torch}
                    focusPoint={focusPoint}
                    enhance={enhance}
                    pointerEvents="none"
                    onStatus={onCameraStatus}
                    onText={onCameraText}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <Feather
                    name="camera"
                    size={45}
                    color="#ACB9CC"
                    accessible={false}
                  />
                )}
                <View pointerEvents="none" style={styles.frameCorners}>
                  <View style={styles.cornerTopLeft} />
                  <View style={styles.cornerTopRight} />
                  <View style={styles.cornerBottomLeft} />
                  <View style={styles.cornerBottomRight} />
                </View>
              </Pressable>
              {!error ? (
                <View style={styles.cameraTools}>
                  <Text style={[styles.cameraHint, {color: secondary}]}>
                    {enhance
                      ? 'Contrast boost active. Tap the printed number to focus.'
                      : 'Tap the printed number to focus.'}
                  </Text>
                  {torchAvailable ? (
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityLabel="Camera light"
                      accessibilityState={{checked: torch, disabled: !ready}}
                      disabled={!ready}
                      onPress={() => {
                        clearReadings();
                        setEnhance(false);
                        setCameraNotice(undefined);
                        setTorch((value) => !value);
                      }}
                      style={[
                        styles.lightButton,
                        {backgroundColor: torch ? '#DCE7FF' : '#FFFFFF12'},
                      ]}>
                      <Feather
                        name={torch ? 'zap' : 'zap-off'}
                        size={15}
                        color={torch ? '#142744' : foreground}
                        accessible={false}
                      />
                      <Text
                        style={[
                          styles.lightLabel,
                          {color: torch ? '#142744' : foreground},
                        ]}>
                        {torch ? 'Light on' : 'Light'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {cameraNotice && !error ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.cameraNotice, {color: secondary}]}>
                  {cameraNotice}
                </Text>
              ) : null}
              {!error ? (
                <View style={styles.status}>
                  {!ready ? (
                    <ActivityIndicator size="small" color="#CAD7EC" />
                  ) : (
                    <Feather
                      name="maximize"
                      size={15}
                      color="#CAD7EC"
                      accessible={false}
                    />
                  )}
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[styles.statusText, {color: secondary}]}>
                    {message}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View
                style={styles.nfcIllustration}
                accessibilityRole="image"
                accessibilityLabel="Hold a contactless card against the back of your phone">
                <View
                  style={[styles.halo, {backgroundColor: colors.accentMuted}]}
                />
                <Feather
                  name="smartphone"
                  size={145}
                  color={colors.border}
                  accessible={false}
                />
                <View
                  style={[
                    styles.contactlessCard,
                    {
                      backgroundColor: colors.accentMuted,
                      borderColor: colors.accent,
                    },
                  ]}>
                  <Feather
                    name="credit-card"
                    size={75}
                    color={colors.accent}
                    accessible={false}
                  />
                </View>
                <View
                  style={[styles.nfcSignal, {backgroundColor: colors.accent}]}>
                  <Feather
                    name="wifi"
                    size={22}
                    color={colors.onAccent}
                    style={{transform: [{rotate: '90deg'}]}}
                    accessible={false}
                  />
                </View>
              </View>
              {!error ? (
                <View style={styles.status}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[styles.statusText, {color: secondary}]}>
                    {message}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.nfcHint, {color: secondary}]}>
                Supported cards only. A number, expiry, or name may be
                unavailable. CVV is never read.
              </Text>
            </>
          )}
          {error ? (
            <Text
              accessibilityRole="alert"
              style={[
                styles.error,
                {color: darkCamera ? '#FFB7C2' : colors.danger},
              ]}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
        <View
          style={[styles.footer, {paddingBottom: Math.max(insets.bottom, 16)}]}>
          {review || error ? (
            <Pressable
              accessibilityRole="button"
              onPress={review ? useDetails : onRetry}
              style={[
                styles.primary,
                {backgroundColor: darkCamera ? '#DCE7FF' : colors.accent},
              ]}>
              <Feather
                name={review ? 'check' : 'refresh-cw'}
                size={20}
                color={darkCamera ? '#142744' : colors.onAccent}
                accessible={false}
              />
              <Text
                style={[
                  styles.primaryText,
                  {color: darkCamera ? '#142744' : colors.onAccent},
                ]}>
                {review ? 'Use details' : 'Try again'}
              </Text>
            </Pressable>
          ) : null}
          {settings && error ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void openSettings()}
              style={styles.secondary}>
              <Text style={[styles.secondaryText, {color: secondary}]}>
                {settings === 'camera'
                  ? 'Open app settings'
                  : 'Open NFC settings'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={review ? onRetry : onClose}
            style={styles.secondary}>
            <Text style={[styles.secondaryText, {color: secondary}]}>
              {review
                ? camera
                  ? 'Scan again'
                  : 'Tap again'
                : 'Enter manually instead'}
            </Text>
          </Pressable>
          <Text style={[styles.privacy, {color: secondary}]}>
            {review
              ? 'Nothing is saved until you save the card.'
              : camera
                ? 'Images are processed on your phone, not saved or uploaded.'
                : 'Read only. No payment is made and no card data is uploaded.'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
  },
  toolbar: {
    paddingHorizontal: 20,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingRight: 12,
  },
  cancelText: {...typography.label},
  badge: {borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8},
  badgeText: {...typography.caption, fontWeight: '600', letterSpacing: 0.6},
  body: {flex: 1},
  content: {
    paddingHorizontal: 24,
    paddingTop: 25,
    paddingBottom: 20,
    flexGrow: 1,
  },
  heading: {alignItems: 'center', gap: 11},
  title: {...typography.title, textAlign: 'center'},
  subtitle: {...typography.small, maxWidth: 300, textAlign: 'center'},
  success: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  reviewFields: {marginTop: 27, gap: 19},
  note: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 1},
  noteText: {...typography.small, flex: 1},
  cameraFrame: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: 32,
    aspectRatio: 1.58,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#192536',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTools: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  cameraHint: {...typography.small, flex: 1},
  lightButton: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  lightLabel: {...typography.small, fontWeight: '600'},
  cameraNotice: {...typography.small, textAlign: 'center', marginTop: 12},
  frameCorners: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0},
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 27,
    height: 27,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 18,
    borderColor: '#DCE7FF',
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 27,
    height: 27,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 18,
    borderColor: '#DCE7FF',
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 27,
    height: 27,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 18,
    borderColor: '#DCE7FF',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 27,
    height: 27,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 18,
    borderColor: '#DCE7FF',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 21,
  },
  statusText: {...typography.small, flexShrink: 1, textAlign: 'center'},
  nfcIllustration: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 23,
  },
  halo: {position: 'absolute', width: 170, height: 170, borderRadius: 85},
  contactlessCard: {
    position: 'absolute',
    left: '12%',
    bottom: 22,
    width: 138,
    height: 90,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{rotate: '-13deg'}],
  },
  nfcSignal: {
    position: 'absolute',
    right: '16%',
    top: 28,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcHint: {
    ...typography.small,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 20,
  },
  error: {...typography.small, marginTop: 21, textAlign: 'center'},
  footer: {paddingHorizontal: 24, paddingTop: 12, gap: 5},
  primary: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: {...typography.button},
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryText: {...typography.label},
  privacy: {...typography.caption, textAlign: 'center', marginTop: 5},
});
