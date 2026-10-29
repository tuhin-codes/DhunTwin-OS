import { useContext } from "react";

import {
  TwinContext,
  type TwinContextValue,
} from "./twinContextStore";

export function useTwin(): TwinContextValue {
  const context = useContext(TwinContext);

  if (!context) {
    throw new Error(
      "useTwin must be used inside TwinProvider"
    );
  }

  return context;
}
