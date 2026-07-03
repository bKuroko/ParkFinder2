import { ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function WelcomeScreen({ onViewMap }) {
  const { height, width } = useWindowDimensions();
  const isCompact = height < 720 || width < 360;

  return (
    <ImageBackground
      source={{
        uri: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=85"
      }}
      style={styles.background}
    >
      <View style={[styles.overlay, isCompact ? styles.overlayCompact : null]}>
        <View style={styles.centerContent}>
          <View style={[styles.logoMark, isCompact ? styles.logoMarkCompact : null]}>
            <Ionicons name="location" size={isCompact ? 98 : 120} color="#08a637" />
            <Text style={[styles.logoLetter, isCompact ? styles.logoLetterCompact : null]}>P</Text>
          </View>

          <Text style={[styles.title, isCompact ? styles.titleCompact : null]} numberOfLines={1} adjustsFontSizeToFit>
            Park<Text style={styles.green}>Finder</Text>
          </Text>
          <Text style={styles.city}>Cagayan de Oro City</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            Find available parking spaces in real time.
          </Text>
        </View>

        <Pressable style={styles.button} onPress={onViewMap}>
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={24} color="#ffffff" />
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 92,
    paddingBottom: 58,
    backgroundColor: "rgba(0, 18, 24, 0.74)"
  },
  overlayCompact: {
    paddingTop: 58,
    paddingBottom: 34
  },
  centerContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  logoMark: {
    width: 152,
    height: 152,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  logoMarkCompact: {
    width: 124,
    height: 124
  },
  logoLetter: {
    position: "absolute",
    top: 35,
    color: "#ffffff",
    fontSize: 54,
    fontWeight: "900"
  },
  logoLetterCompact: {
    top: 30,
    fontSize: 44
  },
  title: {
    width: "100%",
    marginTop: 8,
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center"
  },
  titleCompact: {
    fontSize: 36
  },
  green: {
    color: "#08a637"
  },
  city: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900"
  },
  subtitle: {
    width: "92%",
    maxWidth: 310,
    marginTop: 24,
    color: "#ffffff",
    textAlign: "center",
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "700"
  },
  button: {
    width: "100%",
    maxWidth: 330,
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: "#07942f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900"
  }
});
