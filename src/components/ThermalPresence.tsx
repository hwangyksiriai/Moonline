import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Image, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GlassSurface } from "./Glass";

export const presenceImage = require("../../assets/thermal-presence.png");

/** A symbolic presence, not a camera image or a body-temperature reading. */
export function ThermalPresence({ height = 330, pulse = false, children, caption = false }: {
  height?: number;
  pulse?: boolean;
  children?: ReactNode;
  caption?: boolean;
}) {
  const glow = useRef(new Animated.Value(0.12)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) setReduceMotion(value);
    });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (!pulse || reduceMotion) { glow.setValue(0.12); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.45, duration: 1800, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.12, duration: 1800, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion, glow]);
  return (
    <View style={[styles.frame, { height }]}>
      <Image
        source={presenceImage}
        accessibilityLabel="왼쪽은 굴절되는 세로 유리, 오른쪽은 빈티지 필름 질감인 긴 머리의 중성적인 옆모습"
        resizeMode="contain"
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
      />
      <BlurView pointerEvents="none" tint="dark" intensity={3} experimentalBlurMethod="none" style={[StyleSheet.absoluteFill, { right: undefined, width: "50%" }]} />
      <LinearGradient pointerEvents="none" colors={["rgba(114,159,191,.09)", "transparent", "rgba(6,14,25,.48)"]} style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, { opacity: glow }]} />
      <View pointerEvents="none" style={styles.topline}>
        <Text style={styles.eyebrow}>A PRESENCE, JUST FOR YOU</Text>
        <View style={styles.dot} />
      </View>
      {children || caption ? (
        <GlassSurface dark style={styles.caption}>
          {children ?? <>
            <Text style={styles.title}>목소리 너머의 온기</Text>
            <Text style={styles.body}>당신의 밤에, 누군가의 다정함이 닿도록.</Text>
          </>}
        </GlassSurface>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { width: "100%", overflow: "hidden", borderRadius: 26, backgroundColor: "#081321", borderWidth: 1, borderColor: "rgba(194,219,239,.3)" },
  glow: { borderWidth: 1, borderColor: "#B5DCF6", borderRadius: 26 },
  topline: { position: "absolute", left: 18, right: 18, top: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: "#BCD0E1", fontSize: 8, letterSpacing: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#EFBE97" },
  caption: { position: "absolute", left: 12, right: 12, bottom: 12, padding: 15, borderRadius: 18, gap: 6 },
  title: { color: "#EEF4FA", fontSize: 19, fontWeight: "500" },
  body: { color: "#B7C7D7", fontSize: 12, lineHeight: 19 },
});
