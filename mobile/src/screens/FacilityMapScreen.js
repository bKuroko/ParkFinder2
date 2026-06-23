import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { searchFacilities } from "../api/client";
import OpenLayersMap from "../components/OpenLayersMap";

export default function FacilityMapScreen({ onSelectFacility }) {
  const [search, setSearch] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [loading, setLoading] = useState(true);
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
            setFacilities(data);
            setError("");
          }
        })
        .catch((err) => {
          if (isActive) {
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

  const showSearchResults = search.trim().length > 0;
  const mapFacilities = showSearchResults ? facilities : selectedFacility ? [selectedFacility] : [];

  function handleMarkerSelect(facilityId) {
    const facility = mapFacilities.find((item) => item.id === facilityId);
    if (facility) {
      setSelectedFacility(facility);
    }
  }

  return (
    <View style={styles.screen}>
      <OpenLayersMap
        facilities={mapFacilities}
        selectedFacilityId={selectedFacility?.id}
        onSelectFacility={handleMarkerSelect}
        fullScreen
      />

      <View style={styles.searchPanel}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={21} color="#596579" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search parking facility"
            style={styles.input}
            autoCapitalize="none"
          />
          {loading ? <ActivityIndicator size="small" /> : null}
          {search ? (
            <Pressable
              onPress={() => {
                setSearch("");
                setFacilities([]);
              }}
            >
              <Ionicons name="close-circle" size={21} color="#596579" />
            </Pressable>
          ) : null}
        </View>

        {showSearchResults ? (
          <View style={styles.resultsPanel}>
            {error ? <Text style={styles.error}>Unable to load facilities.</Text> : null}
            {!loading && facilities.length === 0 ? (
              <Text style={styles.empty}>No parking facility found.</Text>
            ) : null}
            {facilities.map((item) => (
              <Pressable
                key={item.id}
                style={styles.resultRow}
                onPress={() => {
                  setSelectedFacility(item);
                  setSearch("");
                  setFacilities([]);
                }}
              >
                <View style={styles.facilityIcon}>
                  <Text style={styles.facilityIconText}>P</Text>
                </View>
                <View style={styles.facilityCopy}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.address}>{item.address}</Text>
                  <Text style={styles.available}>
                    {item.available_slots} / {item.total_slots} available
                  </Text>
                </View>
                <Ionicons name="navigate" size={19} color="#078528" />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {selectedFacility ? (
        <View style={styles.bottomCard}>
          <View style={styles.cardTop}>
            <View style={styles.facilityIcon}>
              <Text style={styles.facilityIconText}>P</Text>
            </View>
            <View style={styles.facilityCopy}>
              <Text style={styles.cardName}>{selectedFacility.name}</Text>
              <Text style={styles.address}>{selectedFacility.address}</Text>
              <Text style={styles.available}>
                {selectedFacility.available_slots} / {selectedFacility.total_slots} available
              </Text>
            </View>
          </View>
          <Pressable style={styles.detailsButton} onPress={() => onSelectFacility(selectedFacility.id)}>
            <Ionicons name="information-circle-outline" size={20} color="#ffffff" />
            <Text style={styles.detailsButtonText}>View Facility Details</Text>
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
    zIndex: 5
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    backgroundColor: "#ffffff",
    borderRadius: 26,
    paddingHorizontal: 14,
    shadowColor: "#172033",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: "#172033"
  },
  error: {
    padding: 12,
    color: "#b42318"
  },
  resultsPanel: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2ec",
    overflow: "hidden",
    shadowColor: "#172033",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#e7edf3"
  },
  facilityIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#078528"
  },
  facilityIconText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900"
  },
  facilityCopy: {
    flex: 1
  },
  name: {
    fontSize: 14,
    fontWeight: "900",
    color: "#172033"
  },
  address: {
    marginTop: 3,
    color: "#596579",
    fontSize: 12
  },
  available: {
    marginTop: 5,
    color: "#078528",
    fontWeight: "900",
    fontSize: 13
  },
  bottomCard: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 18,
    borderRadius: 8,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2ec",
    shadowColor: "#172033",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  cardName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#172033"
  },
  detailsButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#078528",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  detailsButtonText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  empty: {
    padding: 14,
    textAlign: "center",
    color: "#596579"
  }
});
