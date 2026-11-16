import {requireNativeView, requireOptionalNativeModule} from 'expo';
import type {ViewProps} from 'react-native';

export interface ReadCardDetails {
  number: string;
  expiry?: string;
  holder?: string;
}

export interface CameraTextRegion {
  text: string;
  line?: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface CardReaderApi {
  getNfcStatus(): Promise<'ready' | 'disabled' | 'unsupported'>;
  readNfcCard(): Promise<ReadCardDetails>;
  cancelNfcRead(): Promise<void>;
  openNfcSettings(): Promise<void>;
}

export interface CardCameraProps extends ViewProps {
  active: boolean;
  requestId: number;
  torch: boolean;
  focusPoint: {x: number; y: number; request: number};
  enhance: boolean;
  onText: (event: {
    nativeEvent: {
      requestId: number;
      lines: string[];
      regions?: CameraTextRegion[];
      enhanced?: boolean;
    };
  }) => void;
  onStatus: (event: {
    nativeEvent: {
      requestId: number;
      status: 'preparing' | 'ready' | 'hint' | 'error';
      message: string;
      torchAvailable?: boolean;
      torchEnabled?: boolean;
      enhancementAvailable?: boolean;
    };
  }) => void;
}

export const CardReader =
  requireOptionalNativeModule<CardReaderApi>('CardReader');
export const CardCameraView = CardReader
  ? requireNativeView<CardCameraProps>('CardReader')
  : null;
