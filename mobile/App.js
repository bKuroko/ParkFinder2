import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";
import { useState } from "react";

import FacilityDetailsScreen from "./src/screens/FacilityDetailsScreen";
import FacilityMapScreen from "./src/screens/FacilityMapScreen";
import FacilityLocationScreen from "./src/screens/FacilityLocationScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";

export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);

  function openFacility(facilityId) {
    setSelectedFacilityId(facilityId);
    setScreen("details");
  }

  return (
    <SafeAreaView style={styles.container}>
      {screen === "welcome" ? (
        <WelcomeScreen onViewMap={() => setScreen("map")} />
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
  }
});
