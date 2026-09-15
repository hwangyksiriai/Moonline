import { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GlassSurface } from "./Glass";
export const sans = Platform.select({
  ios: "System",
  android: "sans-serif",
  default:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
});
export const colors = {
  bg: "#F0E6D2",
  card: "rgba(255,250,236,.58)",
  line: "rgba(255,255,245,.85)",
  text: "#354137",
  muted: "#626955",
  accent: "#5B7158",
};
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
}: {
  children: ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.text }]}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <GlassSurface>{children}</GlassSurface>;
}
export function Orb({
  letter = "✦",
  pulse = false,
}: {
  letter?: string;
  pulse?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, scale]);
  return (
    <Animated.View style={[s.orb, { transform: [{ scale }] }]}>
      <Text style={{ fontSize: 48, color: "#667559" }}>{letter}</Text>
    </Animated.View>
  );
}
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 24,
    gap: 20,
    paddingBottom: 36,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    color: colors.accent,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontFamily: sans,
    fontWeight: "400",
    lineHeight: 42,
    letterSpacing: -0.9,
  },
  body: { color: colors.muted, fontFamily: sans, fontSize: 14, lineHeight: 23 },
  label: {
    color: colors.text,
    fontFamily: sans,
    fontSize: 17,
    fontWeight: "600",
  },
  card: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  button: {
    padding: 19,
    backgroundColor: colors.accent,
    borderRadius: 12,
    alignItems: "center",
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: {
    fontFamily: sans,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF8E8",
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    color: colors.text,
    fontSize: 16,
    minHeight: 58,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  orb: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: "rgba(255,243,209,.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,242,.95)",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
  },
  time: {
    fontSize: 46,
    fontWeight: "300",
    fontVariant: ["tabular-nums"],
    color: colors.text,
    letterSpacing: 2,
  },
  divider: { height: 1, backgroundColor: colors.line },
  center: { textAlign: "center" },
  chip: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  selected: {
    borderColor: "#7C906A",
    backgroundColor: "rgba(215,231,189,.72)",
  },
});
