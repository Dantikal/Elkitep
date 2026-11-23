import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

const bubbles = [
  { size: 280, color: 'rgba(92, 135, 104, 0.12)', x: 0.8, y: 0.1 },
  { size: 230, color: 'rgba(183, 161, 104, 0.14)', x: 0.1, y: 0.85 },
  { size: 170, color: 'rgba(92, 135, 104, 0.08)', x: 0.1, y: 0.4 },
  { size: 110, color: 'rgba(183, 161, 104, 0.12)', x: 0.9, y: 0.65 },
  { size: 90, color: 'rgba(92, 135, 104, 0.10)', x: 0.25, y: 0.15 },
  { size: 140, color: 'rgba(183, 161, 104, 0.10)', x: 0.65, y: 0.3 },
  { size: 65, color: 'rgba(92, 135, 104, 0.14)', x: 0.45, y: 0.75 },
  { size: 100, color: 'rgba(183, 161, 104, 0.12)', x: 0.15, y: 0.6 },
  { size: 75, color: 'rgba(92, 135, 104, 0.11)', x: 0.8, y: 0.9 },
  { size: 155, color: 'rgba(92, 135, 104, 0.07)', x: 0.55, y: 0.5 },
  { size: 55, color: 'rgba(183, 161, 104, 0.16)', x: 0.35, y: 0.35 },
  { size: 85, color: 'rgba(92, 135, 104, 0.10)', x: 0.7, y: 0.7 },
];

export function AnimatedBackground() {
  const { width, height } = useWindowDimensions();
  const positions = useRef(bubbles.map(() => new Animated.ValueXY())).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => {});
    const motionListener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const appListener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { mounted = false; motionListener.remove(); appListener.remove(); };
  }, []);

  useEffect(() => {
    let stopped = false;
    const animations: Animated.CompositeAnimation[] = [];
    bubbles.forEach((bubble, index) => {
      const position = positions[index];
      let current = { x: width * bubble.x, y: height * bubble.y };
      position.setValue({ x: current.x - bubble.size / 2, y: current.y - bubble.size / 2 });
      if (reduceMotion || !active) return;
      const move = () => {
        if (stopped) return;
        // Travel to a different part of the screen, rather than wobbling around one spot.
        const next = {
          x: width * (current.x < width / 2 ? 0.55 + Math.random() * 0.4 : 0.05 + Math.random() * 0.4),
          y: height * (current.y < height / 2 ? 0.55 + Math.random() * 0.4 : 0.05 + Math.random() * 0.4),
        };
        current = next;
        const animation = Animated.timing(position, {
          toValue: { x: next.x - bubble.size / 2, y: next.y - bubble.size / 2 },
          duration: 6500 + Math.random() * 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        });
        animations[index] = animation;
        animation.start(({ finished }) => { if (finished && !stopped) move(); });
      };
      move();
    });
    return () => { stopped = true; animations.forEach(animation => animation.stop()); };
  }, [active, reduceMotion, positions, width, height]);

  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.background}>
    {bubbles.map((bubble, index) => <Animated.View key={index} style={{
      position: 'absolute', width: bubble.size, height: bubble.size,
      borderRadius: bubble.size / 2, backgroundColor: bubble.color,
      transform: positions[index].getTranslateTransform(),
    }} />)}

  </View>;
}

const s = StyleSheet.create({
  background: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
