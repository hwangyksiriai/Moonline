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
        backgroundColor: "#7B8060",
        borderWidth: 1,
        borderColor: "rgba(255,253,235,.85)",
        shadowColor: "#6B5435",
        shadowOpacity: 0.15,
        shadowRadius: 20,
      }}
    >
      <ReededPhoto height={height} />
      <LinearGradient
        colors={[
          "rgba(34,43,26,.22)",
          "rgba(82,60,27,0)",
          "rgba(34,43,26,.28)",
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
              color: "#FFE79F",
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
