import { Image, StyleSheet } from 'react-native';

export function GirlWaving() {
  return (
    <Image
      accessibilityLabel="A girl waving hello"
      resizeMode="contain"
      source={require('../assets/girl-waving.gif')}
      style={styles.animation}
    />
  );
}

const styles = StyleSheet.create({
  animation: { height: 178, width: '100%' },
});
