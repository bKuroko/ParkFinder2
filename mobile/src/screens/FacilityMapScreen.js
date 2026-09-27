import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getCachedFacilities, getFacility, searchFacilities } from "../api/client";
import OpenLayersMap from "../components/OpenLayersMap";

const REFRESH_MS = 5000;

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
    return `${facility.available_slots} of ${facility.total_slots} spaces available`;
  }
  if (typeof facility?.available_slots === "number") {
    return `${facility.available_slots} available`;
  }
  return "Space count unavailable";
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
  const { height } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState("");
  const [selectedError, setSelectedError] = useState("");
  const error = selectedFacility ? selectedError : listError;

  useEffect(() => {
    let isActive = true;
    const query = search.trim();
    setLoading(true);
    setFacilities(getCachedFacilities(query));
    setListError("");

    function loadFacilities(showLoading = false) {
      if (showLoading) {
        setLoading(true);
      }
      searchFacilities(query)
        .then((data) => {
          if (isActive) {
            setFacilities(data);
            setListError("");
          }
        })
        .catch((err) => {
          if (isActive) {
            const cached = getCachedFacilities(query);
            setFacilities(cached);
            setListError(
              cached.length
                ? "Connection unavailable. Showing saved demo information."
                : err.message
            );
          }
        })
        .finally(() => {
          if (isActive && showLoading) {
            setLoading(false);
          }
        });
    }

    const timeout = setTimeout(() => loadFacilities(true), query ? 250 : 0);
    const interval = setInterval(() => loadFacilities(), REFRESH_MS);

    return () => {
      isActive = false;
      clearTimeout(timeout);
      clearInterval(interval);
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
          setSelectedError("");
        }
      } catch (err) {
        if (isActive) {
          setSelectedError("Connection unavailable. Showing saved demo information.");
        }
      } finally {
        if (isActive && showStatus) {
          setRefreshing(false);
        }
      }
    }

    refreshSelectedFacility(true);
    const interval = setInterval(() => refreshSelectedFacility(false), REFRESH_MS);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [selectedFacility?.id]);

  const isSearching = search.trim().length > 0;
  const mapFacilities = facilities.map((facility) =>
    facility.id === selectedFacility?.id ? selectedFacility : facility
  );
  if (selectedFacility && !mapFacilities.some((facility) => facility.id === selectedFacility.id)) {
    mapFacilities.push(selectedFacility);
  }

  function selectFacility(facility) {
    setSelectedFacility(facility);
    setSearch("");
    setSelectedError("");
  }

  function updateSearch(value) {
    setSearch(value);
    setSelectedFacility(null);
  }

  return (
    <View style={styles.screen}>
      <OpenLayersMap
        facilities={mapFacilities}
        selectedFacilityId={selectedFacility?.id}
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
            onChangeText={updateSearch}
            placeholder="Search for parking"
            placeholderTextColor="#7a8790"
            style={styles.input}
            autoCapitalize="none"
          />
          {search ? (
            <Pressable
              onPress={() => setSearch("")}
              hitSlop={14}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={21} color="#596579" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {!selectedFacility && !isSearching && listError ? (
        <View style={styles.mapNotice}><OfflineNotice message={listError} /></View>
      ) : null}

      {isSearching && !selectedFacility ? (
        <View style={styles.resultSheet}>
          <View style={styles.handle} />
          <View style={styles.resultHeader}>
            <View style={styles.headerCopy}>
              <Text style={styles.sheetTitle}>
                {loading && !facilities.length ? "Searching parking lots..." : `${facilities.length} matching lots`}
              </Text>
              <Text style={styles.sheetSubtitle}>Demo availability · Cagayan de Oro</Text>
            </View>
          </View>

          <OfflineNotice message={error} />

          <ScrollView style={[styles.resultsList, { maxHeight: Math.min(300, height * 0.37) }]} keyboardShouldPersistTaps="handled">
            {facilities.map((facility) => (
              <Pressable style={styles.resultRow} key={facility.id} onPress={() => selectFacility(facility)}>
                <View style={styles.facilityIcon}>
                  <Text style={styles.facilityIconText}>P</Text>
                </View>
                <View style={styles.facilityCopy}>
                  <Text style={styles.facilityName} numberOfLines={1}>{facility.name}</Text>
                  <Text style={styles.facilityAddress} numberOfLines={1}>{facilityAddress(facility)}</Text>
                  <Text style={styles.availableText}>{availableSlotText(facility)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#172033" />
              </Pressable>
            ))}
            {!loading && !facilities.length ? (
              <Text style={styles.emptyText}>No parking lot matches this search.</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {selectedFacility ? (
        <View style={styles.resultSheet}>
          <View style={styles.handle} />
          <View style={styles.selectedTopLine}>
            <Text style={styles.demoLabel}>DEMO AVAILABILITY</Text>
            <Pressable style={styles.closeButton} onPress={() => setSelectedFacility(null)} accessibilityLabel="Close parking lot details">
              <Ionicons name="close" size={22} color="#172033" />
            </Pressable>
          </View>
          <Text style={styles.availableValue}>{availableSlotText(selectedFacility)}</Text>
          <View style={styles.selectedHeader}>
            <View style={styles.facilityIcon}>
              <Text style={styles.facilityIconText}>P</Text>
            </View>
            <View style={styles.facilityCopy}>
              <Text style={styles.facilityName} numberOfLines={2}>{selectedFacility.name}</Text>
              <Text style={styles.facilityAddress} numberOfLines={2}>{facilityAddress(selectedFacility)}</Text>
            </View>
          </View>

          <OfflineNotice message={error} />
          <View style={styles.updateRow}>
            <Ionicons name="time-outline" size={15} color="#64748b" />
            <Text style={styles.updatedText}>
              {refreshing
                ? "Refreshing demo data..."
                : `${error ? "Saved demo data" : "Demo data"} · ${formatUpdatedAt(selectedFacility.updated_at)}`}
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
  mapNotice: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 16,
    zIndex: 5
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
    minHeight: 48,
    marginBottom: 4
  },
  headerCopy: {
    flex: 1
  },
  sheetTitle: {
    color: "#172033",
    fontSize: 17,
    fontWeight: "900"
  },
  sheetSubtitle: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700"
  },
  resultRow: {
    minHeight: 72,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  resultsList: {
    maxHeight: 280
  },
  emptyText: {
    marginVertical: 12,
    color: "#596579",
    fontSize: 13
  },
  selectedTopLine: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  demoLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1
  },
  closeButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -6,
    marginRight: -6
  },
  selectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12
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
  availableValue: {
    color: "#078528",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30
  },
  updateRow: {
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  updatedText: {
    flex: 1,
    color: "#596579",
    fontSize: 12,
    fontWeight: "800"
  },
  detailsButton: {
    marginTop: 14,
    minHeight: 50,
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
