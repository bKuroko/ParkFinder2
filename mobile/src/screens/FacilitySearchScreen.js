import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getCachedFacilities, searchFacilities } from "../api/client";

export default function FacilitySearchScreen({ onSelectFacility }) {
  const [search, setSearch] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
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

    const timeout = setTimeout(() => {
      setLoading(true);
      searchFacilities(query)
        .then((data) => {
          if (isActive) {
            setFacilities(data);
            setError("");
          }
        })
        .catch((err) => {
          if (isActive) {
            const cachedFacilities = getCachedFacilities(query);
            setFacilities(cachedFacilities);
            setError(cachedFacilities.length ? "Showing saved parking data while the server is unreachable." : err.message);
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

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>ParkFinder</Text>
      <Text style={styles.subtitle}>Find available parking before you arrive.</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#596579" />
        <TextInput
          value={search}
          onChangeText={setSearch}
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
              setError("");
            }}
            hitSlop={10}
          >
            <Ionicons name="close-circle" size={21} color="#596579" />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.refreshRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.refreshText}>Updating availability...</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="cloud-offline-outline" size={17} color="#b42318" />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={facilities}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          search.trim() && !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={28} color="#078528" />
              <Text style={styles.emptyTitle}>No parking facility found</Text>
              <Text style={styles.emptyText}>Try searching for Montero Parking Lot.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onSelectFacility(item.id)} android_ripple={{ color: "#e8f5eb" }}>
            <View style={styles.cardTop}>
              <View style={styles.parkingIcon}>
                <Text style={styles.parkingIconText}>P</Text>
              </View>
              <View style={styles.cardCopy}>
                <View style={styles.cardHeader}>
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                <Text style={styles.address}>{item.address}</Text>
              </View>
              <Ionicons name="chevron-forward" size={21} color="#172033" />
            </View>
            <View style={styles.row}>
              <Text style={styles.metric}>{item.available_slots} available</Text>
              <Text style={styles.metric}>{item.occupied_slots} occupied</Text>
              <Text style={styles.metric}>{item.occupancy_percentage}% full</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f6f8fb"
  },
  title: {
    marginTop: 18,
    fontSize: 34,
    fontWeight: "900",
    color: "#172033"
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: "#596579"
  },
  searchBox: {
    marginTop: 20,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#ccd6e3",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 14
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#172033"
  },
  loader: {
    marginTop: 16
  },
  refreshRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  refreshText: {
    color: "#596579",
    fontWeight: "700"
  },
  errorBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff0ee"
  },
  error: {
    flex: 1,
    color: "#b42318",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  list: {
    paddingVertical: 16,
    gap: 12,
    flexGrow: 1
  },
  card: {
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2ec",
    padding: 14,
    shadowColor: "#172033",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  parkingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#078528"
  },
  parkingIconText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900"
  },
  cardCopy: {
    flex: 1
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#172033"
  },
  address: {
    marginTop: 6,
    color: "#596579",
    fontSize: 13,
    fontWeight: "700"
  },
  row: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metric: {
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    color: "#172033",
    backgroundColor: "#f1f5f3",
    fontSize: 12,
    fontWeight: "800"
  },
  emptyState: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  emptyTitle: {
    marginTop: 10,
    color: "#172033",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  emptyText: {
    marginTop: 5,
    textAlign: "center",
    color: "#596579",
    fontWeight: "700",
    lineHeight: 20
  }
});
