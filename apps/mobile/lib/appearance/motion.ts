import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

let cached = false;
let loaded = false;
const listeners = new Set<(value: boolean) => void>();
let subscription: { remove: () => void } | null = null;

function ensureSubscribed() {
  if (subscription) return;
  subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
    cached = value;
    for (const listener of listeners) listener(value);
  });
  if (!loaded)
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        loaded = true;
        cached = value;
        for (const listener of listeners) listener(value);
      })
      .catch(() => {});
}

/** Whether the system asks for reduced motion; the glass animations hold still when it does. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(cached);
  useEffect(() => {
    ensureSubscribed();
    listeners.add(setReduce);
    setReduce(cached);
    return () => {
      listeners.delete(setReduce);
    };
  }, []);
  return reduce;
}
