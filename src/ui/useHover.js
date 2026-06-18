import { useState } from "react";

// Tracks hover state and returns the props to spread onto the target element.
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return [hovered, { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }];
}
