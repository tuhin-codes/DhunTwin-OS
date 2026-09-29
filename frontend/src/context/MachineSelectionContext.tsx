import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type MachineScope =
  | "factory"
  | "machine";

interface MachineSelectionContextValue {
  scope: MachineScope;
  selectedMachineId: string | null;

  selectMachine: (
    machineId: string
  ) => void;

  selectFactory: () => void;
}

interface MachineSelectionProviderProps {
  children: ReactNode;
}

const STORAGE_KEY =
  "carbontwin:selectedMachineId";

const EVENT_NAME =
  "carbontwin-machine-selection";

const MachineSelectionContext =
  createContext<
    MachineSelectionContextValue | undefined
  >(undefined);


/* ============================================================
   READ INITIAL SELECTION
============================================================ */

function getStoredMachineId(): string | null {
  try {
    return window.localStorage.getItem(
      STORAGE_KEY
    );
  } catch {
    return null;
  }
}


/* ============================================================
   PROVIDER
============================================================ */

export function MachineSelectionProvider({
  children,
}: MachineSelectionProviderProps) {

  const [
    selectedMachineId,
    setSelectedMachineId,
  ] = useState<string | null>(
    getStoredMachineId
  );


  const [
    scope,
    setScope,
  ] = useState<MachineScope>(
    getStoredMachineId()
      ? "machine"
      : "factory"
  );


  /* ==========================================================
     LISTEN FOR SELECTION CHANGES
  ========================================================== */

  useEffect(() => {

    const handleMachineSelection = (
      event: Event
    ) => {

      const customEvent =
        event as CustomEvent<{
          machineId: string | null;
          scope: MachineScope;
        }>;


      const machineId =
        customEvent.detail?.machineId;


      const nextScope =
        customEvent.detail?.scope;


      setSelectedMachineId(
        machineId
      );


      setScope(
        nextScope ||
        (
          machineId
            ? "machine"
            : "factory"
        )
      );

    };


    const handleStorage = (
      event: StorageEvent
    ) => {

      if (
        event.key !==
        STORAGE_KEY
      ) {
        return;
      }


      const machineId =
        event.newValue;


      setSelectedMachineId(
        machineId
      );


      setScope(
        machineId
          ? "machine"
          : "factory"
      );

    };


    window.addEventListener(
      EVENT_NAME,
      handleMachineSelection
    );


    window.addEventListener(
      "storage",
      handleStorage
    );


    return () => {

      window.removeEventListener(
        EVENT_NAME,
        handleMachineSelection
      );


      window.removeEventListener(
        "storage",
        handleStorage
      );

    };

  }, []);


  /* ==========================================================
     SELECT MACHINE
  ========================================================== */

  const selectMachine = (
    machineId: string
  ) => {

    setSelectedMachineId(
      machineId
    );


    setScope(
      "machine"
    );


    try {

      window.localStorage.setItem(
        STORAGE_KEY,
        machineId
      );


      window.dispatchEvent(
        new CustomEvent(
          EVENT_NAME,
          {
            detail: {
              machineId,
              scope: "machine",
            },
          }
        )
      );

    } catch {
      /*
       * React state has already been updated.
       *
       * If browser storage/events are unavailable,
       * the current page still works normally.
       */
    }

  };


  /* ==========================================================
     SELECT FACTORY
  ========================================================== */

  const selectFactory = () => {

    setSelectedMachineId(
      null
    );


    setScope(
      "factory"
    );


    try {

      window.localStorage.removeItem(
        STORAGE_KEY
      );


      window.dispatchEvent(
        new CustomEvent(
          EVENT_NAME,
          {
            detail: {
              machineId: null,
              scope: "factory",
            },
          }
        )
      );

    } catch {
      /*
       * React state has already been updated.
       */
    }

  };


  /* ==========================================================
     CONTEXT VALUE
  ========================================================== */

  const value =
    useMemo(
      () => ({
        scope,
        selectedMachineId,
        selectMachine,
        selectFactory,
      }),
      [
        scope,
        selectedMachineId,
      ]
    );


  return (
    <MachineSelectionContext.Provider
      value={value}
    >
      {children}
    </MachineSelectionContext.Provider>
  );

}


/* ============================================================
   HOOK
============================================================ */

export function useMachineSelection() {

  const context =
    useContext(
      MachineSelectionContext
    );


  if (!context) {

    throw new Error(
      "useMachineSelection must be used inside MachineSelectionProvider"
    );

  }


  return context;

}