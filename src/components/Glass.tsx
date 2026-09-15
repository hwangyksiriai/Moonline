import { memo, useState, type ReactNode } from "react";
import {
  Image,
  useWindowDimensions,
  Platform,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

const film = require("../../assets/waiting-film.png");

/** Edge-to-edge moon and stars; top anchoring keeps the moon visible on wide screens. */
export const NightBackdrop = memo(function NightBackdrop({ subdued = false }: { subdued?: boolean }) {
  const window = useWindowDimensions();
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const imageHeight = Math.max(size.height, size.width / 1.5);
  const imageWidth = imageHeight * 1.5;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={({ nativeEvent }) => setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })}
      style={[StyleSheet.absoluteFill, { overflow: "hidden", backgroundColor: "#06111D" }]}
    >
      <Image
        source={require("../../assets/moon-night-background.png")}
        resizeMode="cover"
        style={{ position: "absolute", width: imageWidth, height: imageHeight, left: (size.width - imageWidth) / 2, top: 0 }}
      />
      <LinearGradient
        colors={["rgba(3,10,18,.08)", "rgba(3,10,18,.08)", "rgba(3,10,18,.7)", "rgba(3,10,18,.84)"]}
        locations={[0, 0.32, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />
      {subdued ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4,11,19,.68)" }]} /> : null}
    </View>
  );
});

/** Open space for the background moon, without a framed hero or duplicate image. */
export function MoonSpace() {
  const { width, height } = useWindowDimensions();
  return <View pointerEvents="none" style={{ height: Math.min(310, Math.max(170, Math.max(height, width / 1.5) * 0.44 - 110)) }} />;
}

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
        tint="dark"
        intensity={dark ? 48 : 32}
        experimentalBlurMethod="none"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={
          dark
            ? ["rgba(182,210,231,.13)", "rgba(10,14,28,.3)"]
            : ["rgba(212,232,247,.14)", "rgba(91,132,161,.03)"]
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
                  "rgba(212,207,255,.22)",
                  "rgba(148,139,196,.03)",
                  "rgba(9,13,28,.4)",
                  "rgba(191,197,245,.16)",
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
    borderColor: "rgba(203,225,242,.28)",
    backgroundColor: "rgba(60,86,109,.24)",
    padding: 22,
    gap: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  dark: {
    backgroundColor: "rgba(9,13,26,.62)",
    borderColor: "rgba(205,226,243,.24)",
  },
});
