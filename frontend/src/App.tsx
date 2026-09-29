import { useEffect, useState } from "react";

import MainLayout from "./components/layout/MainLayout";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import Workspace from "./components/layout/Workspace";
import {
  MachineSelectionProvider,
} from "./context/MachineSelectionContext";

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);

  return (
    <MachineSelectionProvider>
      <MainLayout>
        {/* ================================
            SIDEBAR
        ================================= */}

        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() =>
            setMobileSidebarOpen(false)
          }
          onToggleCollapse={() =>
            setSidebarCollapsed(
              (value) => !value
            )
          }
        />

        {/* ================================
            MAIN APPLICATION AREA
        ================================= */}

        <div className="flex min-w-0 flex-1 flex-col">

          {/* Topbar */}

          <Topbar
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() =>
              setSidebarCollapsed(
                (value) => !value
              )
            }
            onOpenMobileSidebar={() =>
              setMobileSidebarOpen(true)
            }
          />

          {/* Page Workspace */}

          <Workspace />

        </div>
      </MainLayout>
    </MachineSelectionProvider>
  );
}

export default App;