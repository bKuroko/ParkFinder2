import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getCachedFacility, getFacility } from "../api/client";

const LIVE_REFRESH_MS = 5000;

function satelliteTileUrl(latitude, longitude) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  const zoom = 18;
  const scale = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * scale);
  const latitudeRadians = (latitude * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * scale);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
}

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
        <OfflineNotice message={error || "Parking information is unavailable right now."} />
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ImageBackground
        source={satelliteTileUrl(facility.latitude, facility.longitude)
          ? { uri: satelliteTileUrl(facility.latitude, facility.longitude) }
          : undefined}
        resizeMode="cover"
        style={styles.heroImage}
      >
        <View style={styles.heroShade} />
        <View style={styles.heroTop}>
          <Pressable style={styles.circleButton} onPress={onBack} accessibilityLabel="Back to parking map">
            <Ionicons name="chevron-back" size={23} color="#ffffff" />
          </Pressable>
          <Text style={styles.heroBadge}>Parking</Text>
        </View>
        <View style={styles.heroBrand}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{facility.name}</Text>
            <Text style={styles.heroSubtitle}>Satellite view</Text>
          </View>
        </View>
        <Text style={styles.imageryAttribution}>Imagery © Esri, Maxar, Earthstar Geographics</Text>
      </ImageBackground>

      <View style={styles.panel}>
        <Text style={styles.name}>{facility.name}</Text>
        <Text style={styles.address}>{facility.address}</Text>

        <View style={styles.chipRow}>
          <Text style={styles.openChip}>Parking Facility</Text>
        </View>

        <View style={styles.liveStatus}>
          <View style={[styles.liveDot, error ? styles.staleDot : null]} />
          <Text style={styles.liveText}>
            {loading
              ? "Refreshing parking information..."
              : `${error ? "Saved parking information" : "Parking information"} · ${formatUpdatedAt(facility.updated_at)}`}
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
            <Text style={styles.infoText}>Total Slots</Text>
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
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 12, 18, 0.32)"
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    zIndex: 2
  },
  heroCopy: {
    flex: 1
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 8
  },
  heroSubtitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6
  },
  imageryAttribution: {
    position: "absolute",
    right: 12,
    bottom: 8,
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 3
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
    backgroundColor: "#64748b"
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
