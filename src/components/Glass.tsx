import { memo, useState, type ReactNode } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

const film = require("../../assets/waiting-film.png");

/** A still background keeps the glass warm without animating or obscuring controls. */
export const WarmBackdrop = memo(function WarmBackdrop() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <LinearGradient
        colors={["#F5E7CE", "#E2E7D7", "#EECDAE"]}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={film}
        blurRadius={45}
        resizeMode="cover"
        style={[
          StyleSheet.absoluteFill,
          { width: "100%", height: "100%", opacity: 0.19 },
        ]}
      />
      <LinearGradient
        colors={[
          "rgba(255,249,234,.65)",
          "rgba(255,243,221,.12)",
          "rgba(245,231,207,.55)",
        ]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

export function GlassSurface({
  children,
  style,
  dark = false,
  ...props
}: ViewProps & { children: ReactNode; dark?: boolean }) {
  return (
    <View {...props} style={[glass.surface, dark && glass.dark, style]}>
      <BlurView
        pointerEvents="none"
        tint={dark ? "dark" : "light"}
        intensity={dark ? 28 : 38}
        experimentalBlurMethod="none"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={
          dark
            ? ["rgba(255,232,178,.13)", "rgba(57,54,34,.18)"]
            : ["rgba(255,253,243,.5)", "rgba(255,238,207,.16)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/** Repeated narrow crops shift the photograph like fluted glass; all text is rendered above it. */
export const ReededPhoto = memo(function ReededPhoto({
  height,
}: {
  height: number;
}) {
  const [width, setWidth] = useState(0);
  const count = 20,
    strip = width / count;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={StyleSheet.absoluteFill}
    >
      <Image
        source={film}
        resizeMode="cover"
        style={{ width: "100%", height: "100%" }}
      />
      {width > 0 ? (
        <View style={StyleSheet.absoluteFill}>
          {Array.from({ length: count }, (_, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: i * strip,
                top: 0,
                width: strip + 0.5,
                height,
                overflow: "hidden",
                opacity: i < 5 ? 0.14 : i < 8 ? 0.58 : 0.94,
              }}
            >
              <Image
                source={film}
                resizeMode="cover"
                blurRadius={Platform.OS === "web" ? 0 : 1}
                style={{
                  position: "absolute",
                  width: width * 1.14,
                  height: height * 1.03,
                  left: -i * strip * 1.14 + strip * 0.42,
                  top: -height * 0.015,
                }}
              />
              <LinearGradient
                colors={[
                  "rgba(255,249,220,.38)",
                  "rgba(255,237,190,.04)",
                  "rgba(31,46,32,.25)",
                  "rgba(255,248,218,.28)",
                ]}
                locations={[0, 0.24, 0.8, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});
const glass = StyleSheet.create({
  surface: {
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,246,.8)",
    backgroundColor: "rgba(255,247,225,.34)",
    padding: 22,
    gap: 12,
    shadowColor: "#675531",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  dark: {
    backgroundColor: "rgba(39,49,31,.36)",
    borderColor: "rgba(255,240,201,.42)",
  },
});
