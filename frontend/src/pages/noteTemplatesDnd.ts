import type { Modifier } from "@dnd-kit/core";

// Keep dragged items moving only up/down (avoids pulling @dnd-kit/modifiers for one helper).
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });
