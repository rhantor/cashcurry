"use client";
import { createContext, useContext } from "react";

/** The page's state and handlers, shared with the pieces moved out of it. */
export const StaffFormContext = createContext(null);
export const useStaffFormContext = () => useContext(StaffFormContext);
