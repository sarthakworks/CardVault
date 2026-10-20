export class VaultError extends Error {
  constructor(
    readonly code: 'locked' | 'password' | 'format' | 'storage' | 'conflict' | 'authorization' | 'biometric' | 'limit',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'VaultError';
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The operation could not be completed. Please try again.';
}
