export const cryptoPolicy = {
  minimumPasswordLength: 5,
  iterations: 600_000,
  maximumIterations: 2_000_000,
  saltBytes: 32,
  keyBytes: 32,
  nonceBytes: 12,
  tagBytes: 16,
  maximumPayloadBytes: 8 * 1024 * 1024,
  maximumFileBytes: 12 * 1024 * 1024,
} as const;
