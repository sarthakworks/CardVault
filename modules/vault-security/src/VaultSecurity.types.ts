export interface WrappingKeySecurity {
  hardwareBacked: boolean;
  authenticationRequired: boolean;
  perUseAuthentication: boolean;
}

export interface BackupDocumentInfo {
  uri: string;
  name: string;
  location: string;
  size: number | null;
}

export interface VaultSecurityApi {
  addListener(event: 'onAppClosed', listener: () => void): {remove(): void};
  getActivitySessionId(): number;
  releasePrivacyShield(): Promise<void>;
  armClipboardExpiry(hash: string): Promise<void>;
  clearOwnedClipboard(): Promise<void>;
  inspectWrappingKey(service: string): Promise<WrappingKeySecurity>;
  isWindowFocused(): boolean;
  deriveRootKey(
    password: string,
    salt: string,
    iterations: number
  ): Promise<string>;
  createBackupDocument(name: string): Promise<string | null>;
  rememberBackupDocument(uri: string): Promise<BackupDocumentInfo>;
}
