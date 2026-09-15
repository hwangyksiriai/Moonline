import { Pressable, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { colors, s } from "./ui";
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 9 }}>
      <Text style={s.body}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[s.input, props.style]}
      />
    </View>
  );
}
export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[s.chip, selected && s.selected]}
    >
      <Text
        style={{ color: selected ? colors.text : colors.muted, fontSize: 15 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.title}>{title.replace(/\\n/g, "\n")}</Text>
      {description ? <Text style={s.body}>{description}</Text> : null}
    </View>
  );
}
