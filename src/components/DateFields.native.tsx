import { useState } from "react";
import { Platform, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button } from "./ui";
import type { DateFieldsProps } from "./DateFields";
export default function DateFields(p: DateFieldsProps) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const value = new Date(p.date + "T" + p.time + ":00");
  return (
    <View style={{ gap: 12 }}>
      <Button secondary onPress={() => setMode("date")}>
        {p.date} · 날짜 선택
      </Button>
      <Button secondary onPress={() => setMode("time")}>
        {p.time} · 시간 선택
      </Button>
      {mode ? (
        <DateTimePicker
          themeVariant="dark"
          value={isNaN(value.getTime()) ? new Date() : value}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={mode === "date" ? new Date() : undefined}
          is24Hour
          onChange={(_, d) => {
            if (Platform.OS !== "ios") setMode(null);
            if (!d) return;
            if (mode === "date")
              p.onDate(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
              );
            else
              p.onTime(
                `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
              );
          }}
        />
      ) : null}
      {mode && Platform.OS === "ios" ? (
        <Button onPress={() => setMode(null)}>선택 완료</Button>
      ) : null}
    </View>
  );
}
