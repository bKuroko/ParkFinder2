import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const roads = [
  { top: "17%", left: "-8%", width: "120%", rotation: "-18deg", main: true },
  { top: "36%", left: "-5%", width: "115%", rotation: "12deg" },
  { top: "55%", left: "-7%", width: "120%", rotation: "-8deg" },
  { top: "73%", left: "-5%", width: "115%", rotation: "18deg" },
  { top: "-4%", left: "20%", width: "110%", rotation: "82deg" },
  { top: "-2%", left: "50%", width: "105%", rotation: "96deg" },
  { top: "4%", left: "74%", width: "95%", rotation: "74deg" }
];

const waterways = [
  { top: "19%", left: "-10%", width: "120%", rotation: "32deg" },
  { top: "64%", left: "-10%", width: "130%", rotation: "-24deg" }
];

function statusColor(facility) {
  if (!facility || facility.total_slots === 0) {
    return "#9ca3af";
  }
  if (facility.occupancy_percentage >= 80) {
    return "#dc2626";
  }
  if (facility.occupancy_percentage >= 50) {
    return "#f97316";
  }
  return "#078528";
}

export default function CityMap({ facilities = [], onSelectFacility, selectedFacilityId, compact = false }) {
  return (
    <View style={[styles.map, compact ? styles.compact : null]}>
      {waterways.map((waterway, index) => (
        <View
          key={`water-${index}`}
          style={[
            styles.waterway,
            {
              top: waterway.top,
              left: waterway.left,
              width: waterway.width,
              transform: [{ rotate: waterway.rotation }]
            }
          ]}
        />
      ))}
      {roads.map((road, index) => (
        <View
          key={`road-${index}`}
          style={[
            styles.road,
            road.main ? styles.mainRoad : null,
            {
              top: road.top,
              left: road.left,
              width: road.width,
              transform: [{ rotate: road.rotation }]
            }
          ]}
        />
      ))}

      <Text style={[styles.roadLabel, styles.labelOne]}>Claro M. Recto Ave.</Text>
      <Text style={[styles.roadLabel, styles.labelTwo]}>Corrales Ave.</Text>
      <Text style={[styles.roadLabel, styles.labelThree]}>Tiano Bros St.</Text>

      {facilities.map((facility, index) => {
        const isSelected = selectedFacilityId === facility.id;
        const top = facility.map_top ?? 38 + index * 9;
        const left = facility.map_left ?? 50 + index * 6;

        return (
          <Pressable
            key={facility.id}
            style={[
              styles.pin,
              { top: `${top}%`, left: `${left}%` },
              isSelected ? styles.selectedPin : null
            ]}
            onPress={() => onSelectFacility?.(facility.id)}
          >
            <Ionicons name="location" size={compact ? 48 : 42} color={statusColor(facility)} />
            <Text style={styles.pinLetter}>P</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 335,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#eef1ed",
    borderWidth: 1,
    borderColor: "#d8ded8",
    position: "relative"
  },
  compact: {
    height: 440,
    borderRadius: 0,
    borderWidth: 0
  },
  road: {
    position: "absolute",
    height: 15,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d5d9dc"
  },
  mainRoad: {
    height: 30,
    backgroundColor: "#ffe08a",
    borderColor: "#efc95d"
  },
  waterway: {
    position: "absolute",
    height: 46,
    borderRadius: 28,
    backgroundColor: "rgba(120, 190, 236, 0.32)"
  },
  roadLabel: {
    position: "absolute",
    color: "#666f7c",
    fontSize: 10,
    fontWeight: "700"
  },
  labelOne: {
    top: "30%",
    left: "45%",
    transform: [{ rotate: "-18deg" }]
  },
  labelTwo: {
    top: "62%",
    left: "23%",
    transform: [{ rotate: "16deg" }]
  },
  labelThree: {
    top: "48%",
    left: "63%",
    transform: [{ rotate: "78deg" }]
  },
  pin: {
    position: "absolute",
    width: 50,
    height: 50,
    marginLeft: -25,
    marginTop: -45,
    alignItems: "center",
    justifyContent: "center"
  },
  selectedPin: {
    transform: [{ scale: 1.16 }]
  },
  pinLetter: {
    position: "absolute",
    top: 11,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  }
});
