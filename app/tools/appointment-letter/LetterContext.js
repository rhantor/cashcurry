"use client";
import { createContext, useContext } from "react";

/** The letter editor's state and handlers, shared by the panels, the preview and the signature pad. */
export const LetterContext = createContext(null);
export const useLetter = () => useContext(LetterContext);
