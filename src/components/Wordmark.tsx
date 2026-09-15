import { Text, View, type TextStyle } from "react-native";
import { sans } from "./ui";

const letters: { letter: string; weight: TextStyle["fontWeight"]; color: string }[] = [
  { letter: "M", weight: "200", color: "#B48BA4" },
  { letter: "O", weight: "300", color: "#BE8EA9" },
  { letter: "O", weight: "300", color: "#C592AE" },
  { letter: "N", weight: "400", color: "#CD96B2" },
  { letter: "L", weight: "500", color: "#D59AB7" },
  { letter: "I", weight: "600", color: "#DD9FBC" },
  { letter: "N", weight: "700", color: "#E2A2BF" },
  { letter: "E", weight: "800", color: "#E8A7C5" },
];

export function Wordmark() {
  return (
    <View accessible accessibilityLabel="Moonline" style={{ flexDirection: "row", alignItems: "center", gap: 1.5 }}>
      {letters.map(({ letter, weight, color }, index) => (
        <Text key={index} accessible={false} style={{ fontFamily: sans, fontSize: 24, lineHeight: 32, fontWeight: weight, color }}>
          {letter}
        </Text>
      ))}
    </View>
  );
}
