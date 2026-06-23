import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getFacility } from "../api/client";
import MetricPill from "../components/MetricPill";

export default function FacilityDetailsScreen({ facilityId, onBack, onViewMap }) {
  const [facility, setFacility] = useState(null);
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
        <Text style={styles.error}>Unable to load facility details.</Text>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.backRow} onPress={onBack}>
        <Ionicons name="chevron-back" size={22} color="#172033" />
        <Text style={styles.backLabel}>Facilities</Text>
      </Pressable>

      <View style={styles.image}>
        <Text style={styles.imageText}>Montero Parking Lot</Text>
      </View>

      <Text style={styles.name}>{facility.name}</Text>
      <Text style={styles.address}>{facility.address}</Text>
      <Text style={styles.badge}>Open 24 Hours</Text>
      <Text style={styles.code}>Facility ID: {facility.facility_code}</Text>

      <View style={styles.metrics}>
        <MetricPill label="Available" value={facility.available_slots} tone="available" />
        <MetricPill label="Occupied" value={facility.occupied_slots} tone="occupied" />
      </View>
      <View style={styles.metrics}>
        <MetricPill label="Total Slots" value={facility.total_slots} />
        <MetricPill label="Occupancy" value={`${facility.occupancy_percentage}%`} />
      </View>

      <Text style={styles.sectionTitle}>Location</Text>
      <View style={styles.locationCard}>
        <Ionicons name="location" size={24} color="#078528" />
        <View style={styles.locationCopy}>
          <Text style={styles.locationTitle}>{facility.name}</Text>
          <Text style={styles.locationText}>{facility.address}</Text>
          <Text style={styles.locationText}>
            {facility.latitude}, {facility.longitude}
          </Text>
        </View>
      </View>

      <Pressable style={styles.mapButton} onPress={onViewMap}>
        <Ionicons name="location-outline" size={23} color="#ffffff" />
        <Text style={styles.mapButtonText}>Show Location on Map</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    padding: 20,
    paddingBottom: 36
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  backRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center"
  },
  backLabel: {
    color: "#172033",
    fontWeight: "700"
  },
  image: {
    height: 175,
    marginTop: 18,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 16,
    backgroundColor: "#2f3f35"
  },
  imageText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900"
  },
  name: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "900",
    color: "#172033"
  },
  address: {
    marginTop: 6,
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
  code: {
    marginTop: 8,
    color: "#276749",
    fontWeight: "800"
  },
  metrics: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "900",
    color: "#172033"
  },
  locationCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    backgroundColor: "#ffffff",
    padding: 14
  },
  locationCopy: {
    flex: 1
  },
  locationTitle: {
    color: "#172033",
    fontWeight: "900"
  },
  locationText: {
    marginTop: 4,
    color: "#596579"
  },
  mapButton: {
    marginTop: 18,
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#07942f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  mapButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900"
  },
  error: {
    color: "#b42318"
  },
  backButton: {
    marginTop: 16,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#172033"
  },
  backText: {
    color: "#ffffff",
    fontWeight: "800"
  }
});
