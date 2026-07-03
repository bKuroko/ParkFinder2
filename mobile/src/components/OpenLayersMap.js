import { StyleSheet, View } from "react-native";
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
      .parking-marker {
        min-width: 132px;
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
        max-width: 168px;
        display: grid;
        gap: 2px;
        border: 1px solid rgba(7, 133, 40, 0.22);
        border-radius: 8px;
        padding: 8px 10px;
        color: #172033;
        background: #ffffff;
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.2);
        text-align: center;
      }
      .parking-label strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
      }
      .parking-label small {
        color: #078528;
        font-size: 11px;
        font-weight: 800;
      }
      .parking-pin {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        color: #ffffff;
        background: #078528;
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
        border-top: 11px solid #078528;
        filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.2));
      }
      .parking-marker.selected .parking-label {
        border-color: rgba(7, 133, 40, 0.45);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://cdn.jsdelivr.net/npm/ol@10.6.1/dist/ol.js"></script>
    <script>
      const facilities = ${JSON.stringify(safeFacilities)};
      const selectedFacilityId = ${JSON.stringify(selectedFacilityId)};
      const initialCenter = ${JSON.stringify(center)};
      const map = new ol.Map({
        target: "map",
        layers: [
          new ol.layer.Tile({
            source: new ol.source.XYZ({
              url: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
              attributions: "&copy; OpenStreetMap contributors &copy; CARTO"
            })
          })
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat(initialCenter),
          zoom: ${zoom},
          minZoom: 12,
          maxZoom: 19
        })
      });

      const markerOverlays = facilities.map((facility, index) => {
        const selected =
          facility.id === selectedFacilityId ||
          (!selectedFacilityId && index === 0);
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "parking-marker" + (selected ? " selected" : "");

        const label = document.createElement("span");
        label.className = "parking-label";
        const name = document.createElement("strong");
        name.textContent = facility.name || "Parking Facility";
        const availability = document.createElement("small");
        availability.textContent = facility.available_slots + " / " + facility.total_slots + " available";
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
        return overlay;
      });

      if (facilities.length > 1) {
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
          padding: [90, 60, 160, 60],
          maxZoom: ${zoom},
          duration: 0
        });
      }

      map.on("singleclick", function(event) {
        return;
      });
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
  const mapZoom = compact ? 17 : fullScreen && facilities.length === 1 ? 17 : 14;
  const html = buildMapHtml(facilities, selectedFacilityId, mapZoom);
  const mapKey = `${selectedFacilityId || "none"}-${facilities
    .map((facility) => `${facility.id}:${facility.latitude}:${facility.longitude}`)
    .join("|")}-${mapRevision}`;

  return (
    <View style={[styles.container, compact ? styles.compact : null, fullScreen ? styles.fullScreen : null]}>
      <WebView
        key={mapKey}
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "facility-selected") {
              onSelectFacility?.(data.facilityId);
            }
          } catch {
            // Ignore malformed WebView messages.
          }
        }}
      />
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
  }
});
