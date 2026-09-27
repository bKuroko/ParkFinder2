import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

function markerColor(facility) {
  if (!facility || facility.total_slots === 0) {
    return "#9ca3af";
  }
  if (facility.occupancy_percentage >= 80) {
    return "#dc2626";
  }
  if (facility.occupancy_percentage >= 50) {
    return "#f97316";
  }
  return "#078528";
}

function buildMapHtml(facilities, selectedFacilityId, zoom) {
  const safeFacilities = facilities.map((facility) => ({
    id: facility.id,
    name: facility.name,
    address: facility.address,
    latitude: facility.latitude,
    longitude: facility.longitude,
    available_slots: facility.available_slots,
    total_slots: facility.total_slots,
    occupied_slots: facility.occupied_slots,
    occupancy_percentage: facility.occupancy_percentage,
    color: markerColor(facility)
  }));
  const selectedFacility =
    safeFacilities.find((facility) => facility.id === selectedFacilityId) || safeFacilities[0];
  const center = selectedFacility
    ? [selectedFacility.longitude || 124.607614, selectedFacility.latitude || 8.459434]
    : [124.607614, 8.459434];

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@10.6.1/ol.css" />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        font-family: Arial, sans-serif;
        background: #eef1ed;
      }
      .ol-control {
        display: none;
      }
      .map-attribution {
        position: absolute;
        z-index: 2;
        top: 130px;
        right: 8px;
        border-radius: 4px;
        padding: 3px 5px;
        color: #334155;
        background: rgba(255, 255, 255, 0.9);
        font-size: 10px;
      }
      .parking-marker {
        min-width: 48px;
        min-height: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        border: 0;
        padding: 0;
        background: transparent;
        cursor: pointer;
        user-select: none;
      }
      .parking-label {
        display: block;
        max-width: 138px;
        box-sizing: border-box;
        overflow: hidden;
        border: 1px solid #dbe3e9;
        border-radius: 7px;
        padding: 5px 7px;
        color: #172033;
        background: #ffffff;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.16);
        text-align: center;
      }
      .parking-label strong {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
      }
      .parking-label small {
        display: none;
        color: #078528;
        font-size: 11px;
        font-weight: 800;
      }
      .parking-pin {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        color: #ffffff;
        background: var(--pin-color, #078528);
        border: 3px solid #ffffff;
        box-shadow: 0 5px 16px rgba(0, 0, 0, 0.25);
        font-size: 20px;
        font-weight: 900;
      }
      .parking-tip {
        width: 0;
        height: 0;
        margin-top: -4px;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 11px solid var(--pin-color, #078528);
        filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.2));
      }
      .parking-marker.selected .parking-label {
        border-color: rgba(7, 133, 40, 0.45);
      }
      .parking-marker.selected .parking-label small {
        display: block;
        margin-top: 3px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="map-attribution">© OpenStreetMap contributors</div>
    <script>
      function sendMapEvent(type) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type }));
      }
      window.addEventListener("error", function() { sendMapEvent("map-error"); });
    </script>
    <script src="https://cdn.jsdelivr.net/npm/ol@10.6.1/dist/ol.js" onerror="sendMapEvent('map-error')"></script>
    <script>
      const facilities = ${JSON.stringify(safeFacilities)};
      const selectedFacilityId = ${JSON.stringify(selectedFacilityId)};
      const initialCenter = ${JSON.stringify(center)};
      const tileSource = new ol.source.XYZ({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attributions: "&copy; OpenStreetMap contributors"
      });
      tileSource.on("tileloadend", function() { sendMapEvent("map-ready"); });
      const map = new ol.Map({
        target: "map",
        layers: [
          new ol.layer.Tile({
            source: tileSource
          })
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat(initialCenter),
          zoom: ${selectedFacilityId ? Math.max(zoom, 16) : zoom},
          minZoom: 12,
          maxZoom: 19
        })
      });

      const markerLabels = [];
      facilities.forEach((facility) => {
        const selected = facility.id === selectedFacilityId;
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "parking-marker" + (selected ? " selected" : "");
        marker.style.setProperty("--pin-color", facility.color);
        marker.setAttribute("aria-label", facility.name + ", " + facility.available_slots + " of " + facility.total_slots + " demo spaces available");

        const label = document.createElement("span");
        label.className = "parking-label";
        const name = document.createElement("strong");
        name.textContent = facility.name || "Parking Facility";
        const availability = document.createElement("small");
        availability.textContent = facility.available_slots + " of " + facility.total_slots + " available";
        label.appendChild(name);
        label.appendChild(availability);

        const pin = document.createElement("span");
        pin.className = "parking-pin";
        pin.textContent = "P";

        const tip = document.createElement("span");
        tip.className = "parking-tip";

        marker.appendChild(label);
        marker.appendChild(pin);
        marker.appendChild(tip);
        marker.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "facility-selected",
            facilityId: facility.id
          }));
        });

        const overlay = new ol.Overlay({
          element: marker,
          positioning: "bottom-center",
          offset: [0, -2],
          stopEvent: true,
          position: ol.proj.fromLonLat([facility.longitude, facility.latitude])
        });
        map.addOverlay(overlay);
        markerLabels.push({ label: label, selected: selected });
      });

      if (facilities.length > 1 && !selectedFacilityId) {
        const extent = ol.extent.createEmpty();
        facilities.forEach(function(facility) {
          ol.extent.extend(extent, ol.proj.transformExtent([
            facility.longitude,
            facility.latitude,
            facility.longitude,
            facility.latitude
          ], "EPSG:4326", "EPSG:3857"));
        });
        map.getView().fit(extent, {
          padding: [140, 55, 90, 55],
          maxZoom: ${zoom},
          duration: 0
        });
      }

      function updateMarkerLabels() {
        markerLabels.forEach(function(item) { item.label.style.visibility = "visible"; });
        const visibleRects = [];
        markerLabels.slice().sort(function(a, b) { return Number(b.selected) - Number(a.selected); })
          .forEach(function(item) {
            const rect = item.label.getBoundingClientRect();
            const overlaps = visibleRects.some(function(placed) {
              return rect.left < placed.right + 4 && rect.right + 4 > placed.left &&
                rect.top < placed.bottom + 4 && rect.bottom + 4 > placed.top;
            });
            if (overlaps) item.label.style.visibility = "hidden";
            else visibleRects.push(rect);
          });
      }
      map.on("moveend", function() { requestAnimationFrame(updateMarkerLabels); });
      map.once("postrender", function() { requestAnimationFrame(updateMarkerLabels); });
    </script>
  </body>
</html>`;
}

export default function OpenLayersMap({
  facilities = [],
  selectedFacilityId,
  onSelectFacility,
  compact = false,
  fullScreen = false,
  mapRevision = 0
}) {
  const [mapStatus, setMapStatus] = useState("loading");
  const [retryCount, setRetryCount] = useState(0);
  const mapZoom = compact ? 17 : fullScreen && facilities.length === 1 ? 17 : 14;
  const html = buildMapHtml(facilities, selectedFacilityId, mapZoom);
  const source = useMemo(() => ({ html }), [html]);
  const mapKey = `${selectedFacilityId || "none"}-${facilities
    .map((facility) => `${facility.id}:${facility.latitude}:${facility.longitude}`)
    .join("|")}-${mapRevision}-${retryCount}`;

  useEffect(() => {
    setMapStatus("loading");
    const timeout = setTimeout(() => setMapStatus((status) => status === "loading" ? "error" : status), 12000);
    return () => clearTimeout(timeout);
  }, [mapKey]);

  return (
    <View style={[styles.container, compact ? styles.compact : null, fullScreen ? styles.fullScreen : null]}>
      <WebView
        key={mapKey}
        originWhitelist={["*"]}
        source={source}
        applicationNameForUserAgent="ParkFinderDemo/0.1"
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        javaScriptEnabled
        domStorageEnabled
        onError={() => setMapStatus("error")}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "facility-selected") {
              onSelectFacility?.(data.facilityId);
            } else if (data.type === "map-ready") {
              setMapStatus("ready");
            } else if (data.type === "map-error") {
              setMapStatus("error");
            }
          } catch {
            // Ignore malformed WebView messages.
          }
        }}
      />
      {mapStatus !== "ready" ? (
        <View style={styles.statusOverlay}>
          {mapStatus === "loading" ? (
            <>
              <ActivityIndicator color="#078528" size="large" />
              <Text style={styles.statusText}>Loading map...</Text>
            </>
          ) : (
            <>
              <Text style={styles.errorTitle}>Map unavailable</Text>
              <Text style={styles.statusText}>Check your connection and try again.</Text>
              <Pressable style={styles.retryButton} onPress={() => setRetryCount((count) => count + 1)} accessibilityRole="button">
                <Text style={styles.retryText}>Retry map</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 335,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d8ded8",
    backgroundColor: "#eef1ed"
  },
  compact: {
    height: 285,
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 0
  },
  fullScreen: {
    flex: 1,
    height: undefined,
    borderRadius: 0,
    borderWidth: 0
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#eef1ed"
  },
  errorTitle: {
    color: "#172033",
    fontSize: 18,
    fontWeight: "900"
  },
  statusText: {
    marginTop: 10,
    color: "#596579",
    fontSize: 14,
    textAlign: "center"
  },
  retryButton: {
    marginTop: 16,
    minWidth: 120,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#078528"
  },
  retryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  }
});
