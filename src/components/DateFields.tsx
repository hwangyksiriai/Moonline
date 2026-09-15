import { View } from "react-native";
import { Field } from "./fields";
export type DateFieldsProps = {
  date: string;
  time: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
};
export default function DateFields(p: DateFieldsProps) {
  return (
    <View style={{ gap: 12 }}>
      <Field
        label="날짜 · YYYY-MM-DD"
        value={p.date}
        onChangeText={p.onDate}
        placeholder="2026-09-15"
        maxLength={10}
      />
      <Field
        label="시간 · HH:mm"
        value={p.time}
        onChangeText={p.onTime}
        placeholder="22:00"
        maxLength={5}
      />
    </View>
  );
}
