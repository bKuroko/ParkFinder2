import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import FacilityDetailsScreen from "./src/screens/FacilityDetailsScreen";
import FacilityMapScreen from "./src/screens/FacilityMapScreen";
import FacilityLocationScreen from "./src/screens/FacilityLocationScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";

export default function App() {
  const [screen, setScreen] = useState(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem("parkfinder_welcome_seen")
      .then((seen) => {
        if (active) setScreen(seen ? "map" : "welcome");
      })
      .catch(() => {
        if (active) setScreen("map");
      });
    return () => { active = false; };
  }, []);

  function finishWelcome() {
    setScreen("map");
    AsyncStorage.setItem("parkfinder_welcome_seen", "1").catch(() => {});
  }

  function openFacility(facilityId) {
    setSelectedFacilityId(facilityId);
    setScreen("details");
  }

  return (
    <SafeAreaView style={styles.container}>
      {screen === null ? <View style={styles.loading}><ActivityIndicator color="#078528" /></View> : null}
      {screen === "welcome" ? (
        <WelcomeScreen onViewMap={finishWelcome} />
      ) : null}
      {screen === "map" ? (
        <FacilityMapScreen onSelectFacility={openFacility} />
      ) : null}
      {screen === "details" && selectedFacilityId ? (
        <FacilityDetailsScreen
          facilityId={selectedFacilityId}
          onBack={() => setScreen("map")}
          onViewMap={() => setScreen("location")}
        />
      ) : null}
      {screen === "location" && selectedFacilityId ? (
        <FacilityLocationScreen
          facilityId={selectedFacilityId}
          onBack={() => setScreen("details")}
        />
      ) : null}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f8fb"
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
