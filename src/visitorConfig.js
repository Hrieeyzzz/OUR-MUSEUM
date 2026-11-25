export const VISITOR_OUTFITS = [
  { color: "#a0ad87", name: "Sage" },
  { color: "#d5a28c", name: "Rose" },
  { color: "#a4b6c2", name: "Sky" },
  { color: "#c6afd0", name: "Lilac" },
];
export const GESTURE_DURATION = Object.freeze({
  hands: 6500,
  kiss: 6500,
  propose: 9000,
});
export function visitorAppearance(value, fallback = VISITOR_OUTFITS[0].color) {
  return {
    color: VISITOR_OUTFITS.some((o) => o.color === value?.color)
      ? value.color
      : fallback,
    hair: value?.hair === "long" ? "long" : "short",
  };
}
export function activeVisitorGesture(action, id, now) {
  return !!(
    action &&
    GESTURE_DURATION[action.type] &&
    now - action.started < GESTURE_DURATION[action.type] &&
    (action.actor === id || action.target === id)
  );
}
