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
        min-width: 148px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        border: 0;
        padding: 0;
        background: transparent;
        cursor: pointer;
        user-select: none;
      }
      .parking-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        border: 2px solid #ffffff;
        border-radius: 999px;
        padding: 7px 10px;
        color: #ffffff;
        background: #078528;
        box-shadow: 0 7px 18px rgba(0, 0, 0, 0.24);
        font-size: 13px;
        font-weight: 800;
      }
      .parking-dot {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        color: #ffffff;
        background: #078528;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
        font-size: 20px;
        font-weight: 900;
      }
      .parking-tip {
        width: 0;
        height: 0;
        margin-top: -3px;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 11px solid #078528;
        filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.2));
      }
      .parking-marker.selected .parking-pill,
      .parking-marker.selected .parking-dot {
        background: #f97316;
      }
      .parking-marker.selected .parking-tip {
        border-top-color: #f97316;
      }
      .parking-available {
        border-radius: 999px;
        padding: 4px 8px;
        color: #078528;
        background: #ffffff;
        box-shadow: 0 5px 14px rgba(0, 0, 0, 0.16);
        font-size: 12px;
        font-weight: 800;
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
        marker.innerHTML =
          '<span class="parking-pill"><span>P</span><span>Parking Facility</span></span>' +
          '<span class="parking-available">' + facility.available_slots + ' / ' + facility.total_slots + ' available</span>' +
          '<span class="parking-dot">P</span>' +
          '<span class="parking-tip"></span>';
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
    height: 440,
    borderRadius: 0,
    borderWidth: 0
  },
  fullScreen: {
    flex: 1,
    height: undefined,
    borderRadius: 0,
    borderWidth: 0
  }
});
