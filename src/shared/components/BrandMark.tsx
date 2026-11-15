import { Image } from 'react-native';

export function BrandMark({ size }: { size: number }) {
  return <Image source={require('../../../assets/vault-mark.png')} accessible={false} resizeMode="contain" fadeDuration={0} style={{ width: size, height: size }} />;
}
