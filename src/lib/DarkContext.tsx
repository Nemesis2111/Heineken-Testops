import React, { createContext, useContext } from "react";

export const DarkContext = createContext(false);

export function useDark() {
  return useContext(DarkContext);
}
