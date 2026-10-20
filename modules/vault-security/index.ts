import { requireNativeModule } from 'expo';
import type { VaultSecurityApi } from './src/VaultSecurity.types';

export default requireNativeModule<VaultSecurityApi>('VaultSecurity');
