import { StyleSheet, Text, View } from "react-native";

function getBounds(slots) {
  const points = slots.flatMap((slot) => slot.polygon);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

export default function ParkingMap({ slots }) {
  if (!slots?.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No parking map available.</Text>
      </View>
    );
  }

  const bounds = getBounds(slots);
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);

  return (
    <View style={styles.map}>
      {slots.map((slot) => {
        const xs = slot.polygon.map((point) => point.x);
        const ys = slot.polygon.map((point) => point.y);
        const left = ((Math.min(...xs) - bounds.minX) / width) * 100;
        const top = ((Math.min(...ys) - bounds.minY) / height) * 100;
        const slotWidth = ((Math.max(...xs) - Math.min(...xs)) / width) * 100;
        const slotHeight = ((Math.max(...ys) - Math.min(...ys)) / height) * 100;

        return (
          <View
            key={slot.slot_number}
            style={[
              styles.slot,
              {
                left: `${left}%`,
                top: `${top}%`,
                width: `${slotWidth}%`,
                height: `${slotHeight}%`
              },
              slot.is_occupied ? styles.occupied : styles.available
            ]}
          >
            <Text style={styles.slotText}>{slot.slot_number}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 260,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccd6e3",
    backgroundColor: "#e9eef5",
    position: "relative",
    overflow: "hidden"
  },
  slot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1
  },
  available: {
    backgroundColor: "#c9f2d8",
    borderColor: "#48a868"
  },
  occupied: {
    backgroundColor: "#ffd0cc",
    borderColor: "#d64545"
  },
  slotText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#172033"
  },
  empty: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#eef2f7"
  },
  emptyText: {
    color: "#596579"
  }
});
