"use client";
import { createContext, useContext } from "react";

/** The page's state and handlers, shared with the pieces moved out of it. */
export const OrdersContext = createContext(null);
export const useOrdersContext = () => useContext(OrdersContext);
