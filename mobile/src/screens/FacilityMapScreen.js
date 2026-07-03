import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getCachedFacilities, getFacility, searchFacilities } from "../api/client";
import OpenLayersMap from "../components/OpenLayersMap";

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

function facilityAddress(facility) {
  if (typeof facility?.address === "string" && facility.address.trim()) {
    return facility.address;
  }
  if (typeof facility?.location === "string" && facility.location.trim()) {
    return facility.location;
  }
  return "Cagayan de Oro City";
}

function availableSlotText(facility) {
  if (typeof facility?.available_slots === "number" && typeof facility?.total_slots === "number") {
    return `${facility.available_slots} / ${facility.total_slots} available`;
  }
  if (typeof facility?.available_slots === "number") {
    return `${facility.available_slots} available`;
  }
  return "Live slot count unavailable";
}

function OfflineNotice({ message }) {
  if (!message) {
    return null;
  }
  return (
    <View style={styles.offlineNotice}>
      <Ionicons name="cloud-offline-outline" size={17} color="#b42318" />
      <Text style={styles.offlineText}>{message}</Text>
    </View>
  );
}

export default function FacilityMapScreen({ onSelectFacility }) {
  const [search, setSearch] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;
    const query = search.trim();

    if (!query) {
      setFacilities([]);
      setLoading(false);
      setError("");
      return () => {
        isActive = false;
      };
    }

    setLoading(true);
    const timeout = setTimeout(() => {
      searchFacilities(query)
        .then((data) => {
          if (isActive) {
            setFacilities(data.slice(0, 1));
            setError("");
          }
        })
        .catch((err) => {
          if (isActive) {
            setFacilities(getCachedFacilities(query).slice(0, 1));
            setError(err.message);
          }
        })
        .finally(() => {
          if (isActive) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [search]);

  useEffect(() => {
    if (!selectedFacility?.id) {
      return undefined;
    }

    let isActive = true;

    async function refreshSelectedFacility(showStatus = false) {
      if (showStatus) {
        setRefreshing(true);
      }
      try {
        const data = await getFacility(selectedFacility.id);
        if (isActive) {
          setSelectedFacility(data);
          setError("");
        }
      } catch (err) {
        if (isActive) {
          setError(err.message);
        }
      } finally {
        if (isActive && showStatus) {
          setRefreshing(false);
        }
      }
    }

    refreshSelectedFacility(true);
    const interval = setInterval(() => refreshSelectedFacility(false), LIVE_REFRESH_MS);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [selectedFacility?.id]);

  const isSearching = search.trim().length > 0;
  const searchFacility = facilities[0] || null;
  const displayFacility = selectedFacility || searchFacility;
  const mapFacilities = displayFacility ? [displayFacility] : [];
  const showSearchResultCard = isSearching && !selectedFacility && Boolean(searchFacility);

  function selectFacility(facility) {
    setSelectedFacility(facility);
    setSearch("");
    setFacilities([]);
    setError("");
  }

  return (
    <View style={styles.screen}>
      <OpenLayersMap
        facilities={mapFacilities}
        selectedFacilityId={displayFacility?.id}
        onSelectFacility={(facilityId) => {
          const facility = mapFacilities.find((item) => item.id === facilityId);
          if (facility) {
            selectFacility(facility);
          }
        }}
        fullScreen
      />

      <View style={styles.searchPanel}>
        <View style={styles.logoRow}>
          <Text style={styles.logo}>
            Park<Text style={styles.logoGreen}>Finder</Text>
          </Text>
          <View style={styles.logoCaptionRow}>
            <Ionicons name="location-outline" size={13} color="#078528" />
            <Text style={styles.logoCaption}>Cagayan de Oro City</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={21} color="#596579" />
          <TextInput
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              if (selectedFacility) {
                setSelectedFacility(null);
              }
            }}
            placeholder="Search for parking"
            placeholderTextColor="#7a8790"
            style={styles.input}
            autoCapitalize="none"
          />
          {search ? (
            <Pressable
              onPress={() => {
                setSearch("");
                setFacilities([]);
              }}
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={21} color="#596579" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {showSearchResultCard ? (
        <View style={styles.resultSheet}>
          <View style={styles.handle} />
          <View style={styles.resultHeader}>
            <Text style={styles.sheetTitle}>Parking Facility</Text>
            <Text style={styles.liveText}>{loading ? "Updating..." : "Live data"}</Text>
          </View>

          <OfflineNotice message={error} />

          <Pressable style={styles.resultRow} onPress={() => selectFacility(searchFacility)}>
            <View style={styles.facilityIcon}>
              <Text style={styles.facilityIconText}>P</Text>
            </View>
            <View style={styles.facilityCopy}>
              <Text style={styles.facilityName}>{searchFacility.name}</Text>
              <Text style={styles.facilityAddress}>{facilityAddress(searchFacility)}</Text>
              <Text style={styles.availableText}>{availableSlotText(searchFacility)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#172033" />
          </Pressable>

          <Pressable style={styles.detailsButton} onPress={() => onSelectFacility(searchFacility.id)}>
            <Ionicons name="information-circle-outline" size={20} color="#ffffff" />
            <Text style={styles.detailsButtonText}>View Details</Text>
          </Pressable>
        </View>
      ) : null}

      {selectedFacility ? (
        <View style={styles.resultSheet}>
          <View style={styles.handle} />
          <View style={styles.selectedHeader}>
            <View style={styles.facilityIcon}>
              <Text style={styles.facilityIconText}>P</Text>
            </View>
            <View style={styles.facilityCopy}>
              <Text style={styles.facilityName}>{selectedFacility.name}</Text>
              <Text style={styles.facilityAddress}>{facilityAddress(selectedFacility)}</Text>
              <Text style={styles.openChip}>Open 24 Hours</Text>
            </View>
          </View>

          <OfflineNotice message={error} />

          <View style={styles.metricRow}>
            <View>
              <Text style={styles.availableValue}>
                {selectedFacility.available_slots}
                <Text style={styles.totalValue}> / {selectedFacility.total_slots}</Text>
              </Text>
              <Text style={styles.metricLabel}>Available Slots</Text>
            </View>
            <View style={styles.circle}>
              <Text style={styles.circleText}>{selectedFacility.occupancy_percentage}%</Text>
              <Text style={styles.metricLabel}>Occupied</Text>
            </View>
          </View>

          <View style={styles.updateRow}>
            <View style={styles.liveDot} />
            <Text style={styles.updatedText}>
              {refreshing ? "Refreshing live availability..." : `Last updated ${formatUpdatedAt(selectedFacility.updated_at)}`}
            </Text>
          </View>

          <Pressable style={styles.detailsButton} onPress={() => onSelectFacility(selectedFacility.id)}>
            <Ionicons name="information-circle-outline" size={20} color="#ffffff" />
            <Text style={styles.detailsButtonText}>View Details</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  searchPanel: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    zIndex: 5,
    borderRadius: 14,
    padding: 13,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe6ed",
    shadowColor: "#172033",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 7
  },
  logoRow: {
    marginBottom: 11,
    paddingHorizontal: 2
  },
  logo: {
    color: "#0b1623",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0
  },
  logoGreen: {
    color: "#078528"
  },
  logoCaptionRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  logoCaption: {
    color: "#5f6b75",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  searchBox: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: "#f8fbf9",
    borderWidth: 1,
    borderColor: "#dfe6ed"
  },
  input: {
    flex: 1,
    color: "#172033",
    fontSize: 14
  },
  resultSheet: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 16,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e7ef",
    shadowColor: "#172033",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8
  },
  handle: {
    alignSelf: "center",
    width: 58,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#d8dee8",
    marginBottom: 12
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8
  },
  sheetTitle: {
    color: "#172033",
    fontSize: 17,
    fontWeight: "900"
  },
  liveText: {
    color: "#078528",
    fontSize: 12,
    fontWeight: "900"
  },
  resultRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  selectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  facilityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f97316"
  },
  facilityIconText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900"
  },
  facilityCopy: {
    flex: 1
  },
  facilityName: {
    color: "#172033",
    fontSize: 16,
    fontWeight: "900"
  },
  facilityAddress: {
    marginTop: 4,
    color: "#596579",
    fontSize: 12,
    fontWeight: "700"
  },
  availableText: {
    marginTop: 6,
    color: "#078528",
    fontSize: 13,
    fontWeight: "900"
  },
  openChip: {
    alignSelf: "flex-start",
    overflow: "hidden",
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: "#0b6b2c",
    backgroundColor: "#d8f5df",
    fontSize: 12,
    fontWeight: "900"
  },
  metricRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  availableValue: {
    color: "#078528",
    fontSize: 28,
    fontWeight: "900"
  },
  totalValue: {
    color: "#172033",
    fontSize: 20
  },
  metricLabel: {
    marginTop: 5,
    color: "#172033",
    fontSize: 13,
    fontWeight: "700"
  },
  circle: {
    alignItems: "center"
  },
  circleText: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 8,
    borderColor: "#078528",
    color: "#172033",
    fontWeight: "900",
    textAlign: "center",
    textAlignVertical: "center"
  },
  updateRow: {
    marginTop: 13,
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
  updatedText: {
    flex: 1,
    color: "#596579",
    fontSize: 12,
    fontWeight: "800"
  },
  detailsButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#07942f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  detailsButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  offlineNotice: {
    marginTop: 10,
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
  }
});
