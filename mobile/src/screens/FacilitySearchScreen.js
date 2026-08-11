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

function formatUpdatedAt(value) {
  if (!value) {
    return "Waiting for parking update";
  }

  return `Updated ${new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })}`;
}

function EmptyState({ hasQuery, hasError, query }) {
  if (!hasQuery) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconSoft}>
          <Ionicons name="location-outline" size={30} color="#078528" />
        </View>
        <Text style={styles.emptyTitle}>Find parking before you arrive</Text>
        <Text style={styles.emptyText}>
          Search a parking facility to check its latest available spaces.
        </Text>
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIconSoft, styles.errorIconSoft]}>
          <Ionicons name="cloud-offline-outline" size={29} color="#b42318" />
        </View>
        <Text style={styles.emptyTitle}>Search is unavailable</Text>
        <Text style={styles.emptyText}>Check your connection, then try again.</Text>
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconSoft}>
        <Ionicons name="search-outline" size={30} color="#078528" />
      </View>
      <Text style={styles.emptyTitle}>No parking found</Text>
      <Text style={styles.emptyText}>
        We could not find a parking facility matching "{query.trim()}".
      </Text>
      <Text style={styles.emptyHint}>Check the spelling or try Montero Parking Lot.</Text>
    </View>
  );
}

export default function FacilitySearchScreen({ onSelectFacility }) {
  const [search, setSearch] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
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
    setFacilities([]);
    setError("");

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
            const cachedFacilities = getCachedFacilities(query);
            setFacilities(cachedFacilities);
            setError(
              cachedFacilities.length
                ? "Live updates are unavailable. These are the last known parking details."
                : err.message
            );
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

  const hasQuery = search.trim().length > 0;

  function clearSearch() {
    setSearch("");
    setFacilities([]);
    setError("");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.title}>
              Park<Text style={styles.titleGreen}>Finder</Text>
            </Text>
            <View style={styles.cityRow}>
              <Ionicons name="location" size={13} color="#078528" />
              <Text style={styles.city}>Cagayan de Oro City</Text>
            </View>
          </View>
          <View style={styles.parkingMark}>
            <Text style={styles.parkingMarkText}>P</Text>
          </View>
        </View>

        <Text style={styles.heading}>Where do you want to park?</Text>
        <Text style={styles.subtitle}>Search and check availability before you drive.</Text>

        <View style={[styles.searchBox, focused ? styles.searchBoxFocused : null]}>
          <View style={styles.searchIcon}>
            <Ionicons name="search" size={20} color="#ffffff" />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search for parking"
            placeholderTextColor="#7a8790"
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {loading ? <ActivityIndicator size="small" color="#078528" /> : null}
          {search && !loading ? (
            <Pressable
              style={styles.clearButton}
              onPress={clearSearch}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear parking search"
            >
              <Ionicons name="close" size={18} color="#596579" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {error && facilities.length ? (
        <View style={styles.notice}>
          <Ionicons name="time-outline" size={18} color="#8a5a00" />
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={facilities}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          facilities.length ? (
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Parking facilities</Text>
              <Text style={styles.resultsCount}>
                {facilities.length} {facilities.length === 1 ? "result" : "results"}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              hasQuery={hasQuery}
              hasError={Boolean(error)}
              query={search}
            />
          ) : (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#078528" />
              <Text style={styles.loadingText}>Checking parking availability...</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
            onPress={() => onSelectFacility(item.id)}
            android_ripple={{ color: "#e7f5eb" }}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.name}`}
          >
            <View style={styles.cardTop}>
              <View style={styles.parkingIcon}>
                <Text style={styles.parkingIconText}>P</Text>
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color="#6b7785" />
                  <Text style={styles.address} numberOfLines={2}>
                    {item.address || item.location || "Cagayan de Oro City"}
                  </Text>
                </View>
              </View>
              <View style={styles.arrowButton}>
                <Ionicons name="chevron-forward" size={20} color="#172033" />
              </View>
            </View>

            <View style={styles.availabilityRow}>
              <View style={styles.availabilityMain}>
                <Text style={styles.availableValue}>{item.available_slots ?? "--"}</Text>
                <View>
                  <Text style={styles.availableLabel}>spaces available</Text>
                  <Text style={styles.updatedText}>{formatUpdatedAt(item.updated_at)}</Text>
                </View>
              </View>
              <View style={styles.totalBlock}>
                <Text style={styles.totalValue}>{item.total_slots ?? "--"}</Text>
                <Text style={styles.totalLabel}>total</Text>
              </View>
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
    backgroundColor: "#f3f7f4"
  },
  header: {
    paddingTop: 36,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4ebe6"
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: "#0b1623",
    fontSize: 27,
    fontWeight: "900"
  },
  titleGreen: {
    color: "#078528"
  },
  cityRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  city: {
    color: "#66727e",
    fontSize: 12,
    fontWeight: "700"
  },
  parkingMark: {
    width: 43,
    height: 43,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#078528"
  },
  parkingMarkText: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900"
  },
  heading: {
    marginTop: 26,
    color: "#101820",
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 29
  },
  subtitle: {
    marginTop: 5,
    color: "#66727e",
    fontSize: 14,
    lineHeight: 20
  },
  searchBox: {
    marginTop: 18,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1.5,
    borderColor: "#d7e1da",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 8
  },
  searchBoxFocused: {
    borderColor: "#078528",
    backgroundColor: "#fbfffc"
  },
  searchIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#078528"
  },
  input: {
    flex: 1,
    minHeight: 52,
    color: "#172033",
    fontSize: 15,
    fontWeight: "600"
  },
  clearButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef3ef"
  },
  notice: {
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff7e6",
    borderWidth: 1,
    borderColor: "#f4dfad"
  },
  noticeText: {
    flex: 1,
    color: "#76510b",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12
  },
  resultsHeader: {
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  resultsTitle: {
    color: "#172033",
    fontSize: 15,
    fontWeight: "900"
  },
  resultsCount: {
    color: "#66727e",
    fontSize: 12,
    fontWeight: "700"
  },
  card: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dde6df",
    padding: 15
  },
  cardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }]
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  parkingIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e4f5e9"
  },
  parkingIconText: {
    color: "#078528",
    fontSize: 25,
    fontWeight: "900"
  },
  cardCopy: {
    flex: 1
  },
  name: {
    color: "#172033",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21
  },
  addressRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4
  },
  address: {
    flex: 1,
    color: "#66727e",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  arrowButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f2"
  },
  availabilityRow: {
    marginTop: 15,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#edf1ee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  availabilityMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  availableValue: {
    color: "#078528",
    fontSize: 31,
    fontWeight: "900",
    fontVariant: ["tabular-nums"]
  },
  availableLabel: {
    color: "#172033",
    fontSize: 12,
    fontWeight: "900"
  },
  updatedText: {
    marginTop: 3,
    color: "#7a8790",
    fontSize: 10,
    fontWeight: "700"
  },
  totalBlock: {
    minWidth: 52,
    alignItems: "flex-end"
  },
  totalValue: {
    color: "#172033",
    fontSize: 18,
    fontWeight: "900",
    fontVariant: ["tabular-nums"]
  },
  totalLabel: {
    marginTop: 2,
    color: "#7a8790",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  emptyState: {
    flex: 1,
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 28
  },
  emptyIconSoft: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e4f5e9"
  },
  errorIconSoft: {
    backgroundColor: "#fff0ee"
  },
  emptyTitle: {
    marginTop: 16,
    color: "#172033",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  emptyText: {
    marginTop: 7,
    maxWidth: 290,
    textAlign: "center",
    color: "#66727e",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20
  },
  emptyHint: {
    marginTop: 8,
    color: "#078528",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  loadingState: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: {
    marginTop: 12,
    color: "#66727e",
    fontSize: 13,
    fontWeight: "700"
  }
});
