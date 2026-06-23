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

import { searchFacilities } from "../api/client";

export default function FacilitySearchScreen({ onSelectFacility }) {
  const [search, setSearch] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    const timeout = setTimeout(() => {
      searchFacilities(search)
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

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>ParkFinder</Text>
      <Text style={styles.subtitle}>Find available parking before you arrive.</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#596579" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search parking facility"
          style={styles.input}
          autoCapitalize="none"
        />
      </View>

      {loading ? <ActivityIndicator style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>Unable to load facilities.</Text> : null}

      <FlatList
        data={facilities}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No matching facilities found.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onSelectFacility(item.id)}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.code}>{item.facility_code}</Text>
            </View>
            <Text style={styles.address}>{item.address}</Text>
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
    padding: 20
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#ccd6e3",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 12
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 16,
    color: "#172033"
  },
  loader: {
    marginTop: 16
  },
  error: {
    marginTop: 12,
    color: "#b42318"
  },
  list: {
    paddingVertical: 16,
    gap: 12
  },
  card: {
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2ec",
    padding: 16
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
  code: {
    color: "#276749",
    fontWeight: "800"
  },
  address: {
    marginTop: 6,
    color: "#596579"
  },
  row: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metric: {
    color: "#172033",
    fontWeight: "700"
  },
  empty: {
    marginTop: 24,
    textAlign: "center",
    color: "#596579"
  }
});
