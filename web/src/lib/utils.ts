import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges conditional and conflicting utility class names */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
