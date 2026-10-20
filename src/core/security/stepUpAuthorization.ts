import { randomUUID } from 'expo-crypto';
import { verifiedKeys } from './passwordVerification';
import { destroyKeys } from '../crypto/deriveKeys';
import { activeSession, assertGeneration } from './sessionStore';
import { VaultError } from '../errors/VaultError';
import { readBiometricKey } from './biometricCredentials';
import { sessionKeyring } from './sessionKeyring';

export type ProtectedOperation = 'card:create' | 'note:create' | `card:update:${string}` | `card:delete:${string}` | `note:update:${string}` | `note:delete:${string}` | 'backup:import' | 'biometrics:toggle';
export interface Authorization { readonly token: string }

interface Grant {
  operation: ProtectedOperation;
  generation: number;
  revision: number;
  expiresAt: number;
}

const grants = new Map<string, Grant>();

function issueAuthorization(operation: ProtectedOperation, generation: number, revision: number): Authorization {
  assertGeneration(generation);
  if (activeSession().revision !== revision) {
    throw new VaultError('authorization', 'Your vault changed. Confirm this action again.');
  }
  const token = randomUUID();
  grants.set(token, {
    operation,
    generation,
    revision,
    expiresAt: Date.now() + 60_000,
  });
  return { token };
}

export async function authorizeWithPassword(password: string, operation: ProtectedOperation): Promise<Authorization> {
  const { generation, revision } = activeSession();
  const keys = await verifiedKeys(password);
  destroyKeys(keys);
  return issueAuthorization(operation, generation, revision);
}

export async function authorizeWithBiometrics(operation: ProtectedOperation): Promise<Authorization> {
  const { generation, revision, header } = activeSession();
  const key = await readBiometricKey(header.vaultId, 'Confirm this vault action with your fingerprint');
  try {
    assertGeneration(generation);
    const expected = sessionKeyring.get();
    let difference = key.length ^ expected.length;
    for (const [index, byte] of key.entries()) difference |= byte ^ (expected[index] ?? 0);
    if (difference !== 0) {
      throw new VaultError('biometric', 'The fingerprint key does not match this session. Use your master password and enable fingerprints again.');
    }
    return issueAuthorization(operation, generation, revision);
  } finally {
    key.fill(0);
  }
}

export function consumeAuthorization(authorization: Authorization, operation: ProtectedOperation): void {
  const grant = grants.get(authorization.token);
  grants.delete(authorization.token);
  const session = activeSession();
  if (!grant || grant.operation !== operation || grant.generation !== session.generation
    || grant.revision !== session.revision || grant.expiresAt < Date.now()) {
    throw new VaultError('authorization', 'Confirm this action again with your fingerprint or master password.');
  }
}

export function clearAuthorizations(): void {
  grants.clear();
}
