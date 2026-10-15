/** Join class names, skipping falsy ones: cn("a", ok && "b"). */
export const cn = (...parts) => parts.flat().filter(Boolean).join(" ");
