import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, StyleSheet, View } from 'react-native';

// Fixed coordinates keep the star field stable during navigation and renders.
const stars = Array.from({ length: 65 }, (_, index) => ({
  x: ((index * 37 + 11) % 97) + 1,
  y: ((index * 53 + 7) % 97) + 1,
  size: index % 11 === 0 ? 4 : index % 3 === 0 ? 2.5 : 1.5,
}));

export function StarryBackground() {
  const phases = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const [flashes, setFlashes] = useState([{ x: 12, y: 18 }, { x: 86, y: 45 }, { x: 22, y: 80 }]);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    let stopped = false;
    const animations: Animated.CompositeAnimation[] = [];
    phases.forEach((phase, index) => {
      phase.setValue(0);
      if (reduceMotion || !active) return;
      function burst() {
        if (stopped) return;
        setFlashes(previous => previous.map((point, i) => i === index ? { x: 4 + Math.random() * 92, y: 5 + Math.random() * 90 } : point));
        const shots = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => Animated.sequence([
          Animated.timing(phase, { toValue: 1, duration: 35, useNativeDriver: true, isInteraction: false }),
          Animated.timing(phase, { toValue: 0, duration: 85, useNativeDriver: true, isInteraction: false }),
          Animated.delay(180 + Math.random() * 100),
        ]));
        const animation = Animated.sequence([Animated.delay(1000 + index * 450 + Math.random() * 1800), ...shots]);
        animations[index] = animation;
        animation.start(({ finished }) => { if (finished && !stopped) burst(); });
      }
      burst();
    });
    return () => { stopped = true; animations.forEach(animation => animation.stop()); };
  }, [active, reduceMotion, phases]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.root}>
    {stars.map((star, index) => <Animated.View key={index} style={{
      position: 'absolute', left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size,
      borderRadius: star.size / 2, backgroundColor: index % 5 === 0 ? '#e5cf93' : '#e3edff',
      opacity: 0.22,
    }} />)}
    {flashes.map((flash, index) => <Animated.View key={`flash-${index}`} style={{
      position: 'absolute', left: `${flash.x}%`, top: `${flash.y}%`, width: 24, height: 24,
      opacity: phases[index], transform: [{ scale: phases[index].interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.15] }) }, { rotate: `${index * 25}deg` }],
    }}>
      <View style={s.glow} />
      <View style={s.horizontal} />
      <View style={s.vertical} />
      <View style={[s.diagonal, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[s.diagonal, { transform: [{ rotate: '-45deg' }] }]} />
      <View style={s.core} />
    </Animated.View>)}
  </View>;
}
const s = StyleSheet.create({
  glow: { position: 'absolute', left: 3, top: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(240, 190, 90, 0.12)' },
  horizontal: { position: 'absolute', left: 0, top: 11, width: 24, height: 2, backgroundColor: '#e5c47f' },
  vertical: { position: 'absolute', left: 11, top: 0, width: 2, height: 24, backgroundColor: '#e5c47f' },
  diagonal: { position: 'absolute', left: 5, top: 11, width: 14, height: 1, backgroundColor: '#ffe5ae' },
  core: { position: 'absolute', left: 10, top: 10, width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff7dc' },
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#080f1d', overflow: 'hidden' } });
