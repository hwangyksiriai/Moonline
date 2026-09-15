import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { GlassSurface, ReededPhoto } from "./Glass";
export function FilmPoster({
  script,
  children,
  height = 470,
}: {
  script: string;
  children?: ReactNode;
  height?: number;
}) {
  return (
    <View
      style={{
        height,
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: "#151B30",
        borderWidth: 1,
        borderColor: "rgba(210,215,255,.22)",
        shadowColor: "#000000",
        shadowOpacity: 0.15,
        shadowRadius: 20,
      }}
    >
      <ReededPhoto height={height} />
      <LinearGradient
        colors={[
          "rgba(12,16,35,.66)",
          "rgba(22,19,43,.4)",
          "rgba(9,13,27,.82)",
        ]}
        locations={[0, 0.5, 1]}
        style={[
          StyleSheet.absoluteFill,
          { padding: 20, justifyContent: "space-between" },
        ]}
      >
        <View>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 3,
              color: "#FFF5D9",
              marginBottom: 14,
            }}
          >
            A LITTLE CLOSER, A LITTLE WARMER
          </Text>
          <Text
            style={{
              fontSize: 53,
              lineHeight: 51,
              fontWeight: "300",
              letterSpacing: -2.5,
              color: "#E6DDFB",
            }}
          >
            {script}
          </Text>
        </View>
        {children ? (
          <GlassSurface dark style={{ padding: 18, borderRadius: 20, gap: 8 }}>
            {children}
          </GlassSurface>
        ) : null}
      </LinearGradient>
    </View>
  );
}
