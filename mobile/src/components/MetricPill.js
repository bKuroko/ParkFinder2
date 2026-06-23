import { StyleSheet, Text, View } from "react-native";

export default function MetricPill({ label, value, tone = "neutral" }) {
  return (
    <View style={[styles.container, styles[tone]]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2ec"
  },
  available: {
    borderColor: "#9fd8bd",
    backgroundColor: "#effaf4"
  },
  occupied: {
    borderColor: "#f2b8b5",
    backgroundColor: "#fff4f2"
  },
  neutral: {
    borderColor: "#d9e2ec",
    backgroundColor: "#ffffff"
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    color: "#172033"
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    color: "#596579"
  }
});
