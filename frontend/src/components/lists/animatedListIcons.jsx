import { List, ListPlus, LayoutGrid, ChevronUp, ArrowUp } from "lucide-react";
import {
  ListIcon as AnimatedList,
  LayoutGridIcon as AnimatedLayoutGrid,
  ChevronUpIcon as AnimatedChevronUp,
  ArrowUpIcon as AnimatedArrowUp,
} from "lucide-animated";
import { createAnimatedLucideIcon } from "@/icons/createAnimatedLucideIcon";

/** List / ListPlus / LayoutGrid / ChevronUp — lucide-animated con fallback. */
export const AnimatedListIcon = createAnimatedLucideIcon(AnimatedList, List, "AnimatedListIcon");
export const AnimatedListPlusIcon = createAnimatedLucideIcon(null, ListPlus, "AnimatedListPlusIcon");
export const AnimatedLayoutGridIcon = createAnimatedLucideIcon(
  AnimatedLayoutGrid,
  LayoutGrid,
  "AnimatedLayoutGridIcon"
);
export const AnimatedChevronUpIcon = createAnimatedLucideIcon(
  AnimatedChevronUp,
  ChevronUp,
  "AnimatedChevronUpIcon"
);
export const AnimatedArrowUpIcon = createAnimatedLucideIcon(
  AnimatedArrowUp,
  ArrowUp,
  "AnimatedArrowUpIcon"
);
