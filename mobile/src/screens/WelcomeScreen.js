import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function WelcomeScreen({ onViewMap }) {
  return (
    <ImageBackground
      source={{
        uri: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"
      }}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <View style={styles.logoMark}>
          <Ionicons name="location" size={92} color="#078528" />
          <Text style={styles.logoLetter}>P</Text>
        </View>
        <Text style={styles.title}>
          Park<Text style={styles.green}>Finder</Text>
        </Text>
        <Text style={styles.city}>Cagayan de Oro City</Text>
        <Text style={styles.subtitle}>Find available parking spaces in real-time.</Text>

        <Pressable style={styles.button} onPress={onViewMap}>
          <Ionicons name="map-outline" size={25} color="#ffffff" />
          <Text style={styles.buttonText}>View Map</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "rgba(0, 20, 30, 0.68)"
  },
  logoMark: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  logoLetter: {
    position: "absolute",
    top: 34,
    fontSize: 52,
    fontWeight: "900",
    color: "#ffffff"
  },
  title: {
    marginTop: 6,
    fontSize: 42,
    fontWeight: "900",
    color: "#ffffff"
  },
  green: {
    color: "#08a637"
  },
  city: {
    marginTop: 4,
    fontSize: 19,
    fontWeight: "800",
    color: "#ffffff"
  },
  subtitle: {
    width: "80%",
    marginTop: 26,
    textAlign: "center",
    fontSize: 19,
    lineHeight: 29,
    fontWeight: "700",
    color: "#ffffff"
  },
  button: {
    width: "82%",
    marginTop: 90,
    minHeight: 68,
    borderRadius: 8,
    backgroundColor: "#07942f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900"
  }
});
