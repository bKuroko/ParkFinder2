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

import { getCachedFacility, getFacility } from "../api/client";

const LIVE_REFRESH_MS = 5000;

function formatUpdatedAt(value) {
  if (!value) {
    return "No AI updates yet";
  }
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function OfflineNotice({ message }) {
  if (!message) {
    return null;
  }
  return (
    <View style={styles.offlineNotice}>
      <Ionicons name="cloud-offline-outline" size={18} color="#b42318" />
      <Text style={styles.offlineText}>{message}</Text>
    </View>
  );
}

export default function FacilityDetailsScreen({ facilityId, onBack, onViewMap }) {
  const [facility, setFacility] = useState(() => getCachedFacility(facilityId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;
    setFacility(getCachedFacility(facilityId));

    async function refreshFacility(showStatus = false) {
      if (showStatus) {
        setLoading(true);
      }
      try {
        const data = await getFacility(facilityId);
        if (isActive) {
          setFacility(data);
          setError("");
        }
      } catch (err) {
        if (isActive) {
          setError(
            getCachedFacility(facilityId)
              ? "Live updates are unavailable. Showing the last known parking information."
              : err.message
          );
        }
      } finally {
        if (isActive && showStatus) {
          setLoading(false);
        }
      }
    }

    refreshFacility(true);
    const interval = setInterval(() => refreshFacility(false), LIVE_REFRESH_MS);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [facilityId]);

  if (!facility && loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#078528" />
        <Text style={styles.loadingText}>Loading parking availability...</Text>
      </View>
    );
  }

  if (!facility) {
    return (
      <View style={styles.centered}>
        <OfflineNotice message={error || "Live parking information is unavailable right now."} />
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroImage}>
        <View style={styles.heroTop}>
          <Pressable style={styles.circleButton} onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={23} color="#ffffff" />
          </Pressable>
          <Text style={styles.heroBadge}>Live Parking</Text>
        </View>
        <View style={styles.heroBrand}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>P</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Parking availability</Text>
          </View>
        </View>
        <View style={styles.parkingDeck}>
          <View style={styles.deckLane} />
          <View style={styles.slotRow}>
            {Array.from({ length: 5 }).map((_, index) => (
              <View key={`top-${index}`} style={[styles.slotLine, index === 1 ? styles.slotAvailable : null]} />
            ))}
          </View>
          <View style={styles.slotRow}>
            {Array.from({ length: 5 }).map((_, index) => (
              <View key={`bottom-${index}`} style={[styles.slotLine, index === 3 ? styles.slotAvailable : null]} />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.name}>{facility.name}</Text>
        <Text style={styles.address}>{facility.address}</Text>

        <View style={styles.chipRow}>
          <Text style={styles.openChip}>Open 24 Hours</Text>
        </View>

        <View style={styles.liveStatus}>
          <View style={[styles.liveDot, error ? styles.staleDot : null]} />
          <Text style={styles.liveText}>
            {loading
              ? "Refreshing live availability..."
              : `${error ? "Last known update" : "Last updated"} ${formatUpdatedAt(facility.updated_at)}`}
          </Text>
        </View>

        <OfflineNotice message={error} />

        <View style={styles.availabilityCard}>
          <View>
            <Text style={styles.availableValue}>
              {facility.available_slots}
              <Text style={styles.totalValue}> / {facility.total_slots}</Text>
            </Text>
            <Text style={styles.metricLabel}>Available Slots</Text>
          </View>

          <View style={styles.occupancyCircle}>
            <Text style={styles.circleValue}>{facility.occupancy_percentage}%</Text>
            <Text style={styles.metricLabel}>Occupied</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="business-outline" size={22} color="#172033" />
            <Text style={styles.infoText}>Parking Facility</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <Ionicons name="analytics-outline" size={22} color="#172033" />
            <Text style={styles.infoText}>Live Slot Count</Text>
          </View>
        </View>

        <Pressable style={styles.mapButton} onPress={onViewMap}>
          <Ionicons name="navigate" size={22} color="#ffffff" />
          <Text style={styles.mapButtonText}>View on Map</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  content: {
    paddingBottom: 26
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#ffffff"
  },
  loadingText: {
    marginTop: 12,
    color: "#596579",
    fontSize: 14,
    fontWeight: "800"
  },
  heroImage: {
    height: 260,
    padding: 18,
    paddingTop: 24,
    backgroundColor: "#071824",
    overflow: "hidden"
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)"
  },
  heroBadge: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    color: "#d8f5df",
    backgroundColor: "rgba(7, 148, 47, 0.2)",
    fontSize: 12,
    fontWeight: "900"
  },
  heroBrand: {
    marginTop: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    zIndex: 2
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07942f",
    shadowColor: "#07942f",
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 8
  },
  heroIconText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900"
  },
  heroCopy: {
    flex: 1
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900"
  },
  parkingDeck: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 22,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)"
  },
  deckLane: {
    position: "absolute",
    top: 47,
    left: 14,
    right: 14,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.18)"
  },
  slotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 5
  },
  slotLine: {
    width: "17%",
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    backgroundColor: "rgba(255, 255, 255, 0.07)"
  },
  slotAvailable: {
    borderColor: "#40d267",
    backgroundColor: "rgba(64, 210, 103, 0.24)"
  },
  panel: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    backgroundColor: "#ffffff"
  },
  name: {
    color: "#101820",
    fontSize: 23,
    fontWeight: "900"
  },
  address: {
    marginTop: 8,
    color: "#596579",
    fontSize: 14,
    fontWeight: "700"
  },
  chipRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  openChip: {
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#0b6b2c",
    backgroundColor: "#d8f5df",
    fontSize: 12,
    fontWeight: "900"
  },
  liveStatus: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#078528"
  },
  staleDot: {
    backgroundColor: "#7a8790"
  },
  liveText: {
    flex: 1,
    color: "#596579",
    fontSize: 12,
    fontWeight: "800"
  },
  availabilityCard: {
    marginTop: 24,
    borderRadius: 14,
    padding: 18,
    backgroundColor: "#f4fbf6",
    borderWidth: 1,
    borderColor: "#bfe9cc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  availableValue: {
    color: "#078528",
    fontSize: 42,
    fontWeight: "900"
  },
  totalValue: {
    color: "#101820",
    fontSize: 24
  },
  metricLabel: {
    marginTop: 5,
    color: "#101820",
    fontSize: 13,
    fontWeight: "700"
  },
  occupancyCircle: {
    alignItems: "center"
  },
  circleValue: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 8,
    borderColor: "#078528",
    color: "#101820",
    fontWeight: "900",
    textAlign: "center",
    textAlignVertical: "center"
  },
  infoRow: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "#fbfcfb",
    borderWidth: 1,
    borderColor: "#eef2f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around"
  },
  infoItem: {
    flex: 1,
    alignItems: "center",
    gap: 6
  },
  infoText: {
    color: "#101820",
    fontSize: 12,
    fontWeight: "800"
  },
  infoDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#e1e7ec"
  },
  mapButton: {
    marginTop: 22,
    minHeight: 54,
    borderRadius: 12,
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
  offlineNotice: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff0ee"
  },
  offlineText: {
    flex: 1,
    color: "#b42318",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
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
