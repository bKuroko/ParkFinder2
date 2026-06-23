import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getFacility } from "../api/client";
import OpenLayersMap from "../components/OpenLayersMap";

export default function FacilityLocationScreen({ facilityId, onBack }) {
  const [facility, setFacility] = useState(null);
  const [mapRevision, setMapRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getFacility(facilityId)
      .then((data) => {
        setFacility(data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [facilityId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !facility) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Unable to load map.</Text>
        <Pressable style={styles.smallButton} onPress={onBack}>
          <Text style={styles.smallButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <OpenLayersMap
        facilities={[facility]}
        selectedFacilityId={facility.id}
        fullScreen
        mapRevision={mapRevision}
      />

      <View style={styles.topbar}>
        <Pressable onPress={onBack} style={styles.backCircle}>
          <Ionicons name="chevron-back" size={24} color="#172033" />
        </Pressable>
        <View style={styles.topbarCopy}>
          <Text style={styles.title}>Parking Location</Text>
          <Text style={styles.subtitle}>{facility.name}</Text>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.sheetContent}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>P</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.name}>{facility.name}</Text>
            <Text style={styles.address}>{facility.address}</Text>
            <Text style={styles.badge}>Open 24 Hours</Text>
            <Text style={styles.coordinates}>
              Marker at {facility.latitude}, {facility.longitude}
            </Text>
          </View>
        </View>
        <View style={styles.metrics}>
          <View>
            <Text style={styles.metricValue}>
              {facility.available_slots}
              <Text style={styles.metricTotal}> / {facility.total_slots}</Text>
            </Text>
            <Text style={styles.metricLabel}>Available Slots</Text>
          </View>
          <View style={styles.circle}>
            <Text style={styles.circleText}>{facility.occupancy_percentage}%</Text>
            <Text style={styles.metricLabel}>Occupied</Text>
          </View>
        </View>
        <Pressable style={styles.recenterButton} onPress={() => setMapRevision((value) => value + 1)}>
          <Ionicons name="locate-outline" size={20} color="#ffffff" />
          <Text style={styles.recenterText}>Re-center Parking Marker</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  topbar: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2ec",
    shadowColor: "#172033",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef5f0",
    alignItems: "center",
    justifyContent: "center"
  },
  topbarCopy: {
    flex: 1
  },
  title: {
    color: "#172033",
    fontSize: 17,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 2,
    color: "#596579",
    fontSize: 12,
    fontWeight: "700"
  },
  sheet: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 18,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e7ef"
  },
  handle: {
    alignSelf: "center",
    width: 64,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#d8dee8",
    marginBottom: 16
  },
  sheetContent: {
    flexDirection: "row",
    gap: 12
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f97316"
  },
  iconText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900"
  },
  copy: {
    flex: 1
  },
  name: {
    fontSize: 18,
    fontWeight: "900",
    color: "#172033"
  },
  address: {
    marginTop: 4,
    color: "#596579"
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: "hidden",
    color: "#0b6b2c",
    backgroundColor: "#d8f5df",
    fontWeight: "800"
  },
  coordinates: {
    marginTop: 8,
    color: "#596579",
    fontSize: 12,
    fontWeight: "700"
  },
  metrics: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  metricValue: {
    color: "#078528",
    fontSize: 26,
    fontWeight: "900"
  },
  metricTotal: {
    color: "#172033",
    fontSize: 21
  },
  metricLabel: {
    marginTop: 5,
    color: "#172033",
    fontSize: 13
  },
  circle: {
    alignItems: "center"
  },
  circleText: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 8,
    borderColor: "#078528",
    textAlign: "center",
    textAlignVertical: "center",
    color: "#172033",
    fontWeight: "900"
  },
  recenterButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#078528",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  recenterText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  error: {
    color: "#b42318"
  },
  smallButton: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#172033",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  smallButtonText: {
    color: "#ffffff",
    fontWeight: "900"
  }
});
