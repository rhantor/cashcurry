"use client";
import { createContext, useContext } from "react";

/** The page's state and handlers, shared with the pieces moved out of it. */
export const ItemsContext = createContext(null);
export const useItemsContext = () => useContext(ItemsContext);
