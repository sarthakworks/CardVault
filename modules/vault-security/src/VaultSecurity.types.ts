export interface WrappingKeySecurity {
  hardwareBacked: boolean;
  authenticationRequired: boolean;
  perUseAuthentication: boolean;
}

export interface VaultSecurityApi {
  releasePrivacyShield(): Promise<void>;
  showPrivacyShield(): Promise<void>;
  armClipboardExpiry(hash: string): Promise<void>;
  clearOwnedClipboard(): Promise<void>;
  inspectWrappingKey(service: string): Promise<WrappingKeySecurity>;
  isWindowFocused(): boolean;
  deriveRootKey(password: string, salt: string, iterations: number): Promise<string>;
}
