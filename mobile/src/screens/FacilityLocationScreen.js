import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getCachedFacility, getFacility } from "../api/client";
import OpenLayersMap from "../components/OpenLayersMap";

const LIVE_REFRESH_MS = 5000;

function formatUpdatedAt(value) {
  if (!value) {
    return "no sensor update";
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

function MapSkeleton() {
  return (
    <View style={styles.centered}>
      <View style={styles.skeletonMap} />
      <View style={styles.skeletonSheet} />
    </View>
  );
}

export default function FacilityLocationScreen({ facilityId, onBack }) {
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
              ? "Connection unavailable. Showing saved parking information."
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
    return <MapSkeleton />;
  }

  if (!facility) {
    return (
      <View style={styles.centered}>
        <OfflineNotice message={error || "Parking information is unavailable right now."} />
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
      />

      <View style={styles.topbar}>
        <Pressable onPress={onBack} style={styles.backCircle} accessibilityLabel="Back to parking details">
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
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>Parking Facility</Text>
            </View>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, error ? styles.staleDot : null]} />
              <Text style={styles.liveText}>
                {loading
                  ? "Refreshing parking information..."
                  : `${error ? "Saved parking information" : "Parking information"} · ${formatUpdatedAt(facility.updated_at)}`}
              </Text>
            </View>
          </View>
        </View>

        <OfflineNotice message={error} />

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
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#eef1ed"
  },
  skeletonMap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#e5ece7"
  },
  skeletonSheet: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 18,
    height: 260,
    borderRadius: 14,
    backgroundColor: "#ffffff"
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    borderWidth: 1,
    borderColor: "#e0e7ef",
    shadowColor: "#172033",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 7
  },
  handle: {
    alignSelf: "center",
    width: 64,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#d8dee8",
    marginBottom: 14
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
    backgroundColor: "#078528"
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
    color: "#596579",
    fontSize: 13,
    fontWeight: "700"
  },
  badgeRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    overflow: "hidden",
    color: "#0b6b2c",
    backgroundColor: "#d8f5df",
    fontSize: 12,
    fontWeight: "900"
  },
  liveRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#64748b"
  },
  staleDot: {
    backgroundColor: "#7a8790"
  },
  liveText: {
    color: "#596579",
    fontSize: 12,
    fontWeight: "800"
  },
  metrics: {
    marginTop: 18,
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
