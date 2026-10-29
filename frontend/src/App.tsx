import { useEffect, useState } from "react";

import MainLayout from "./components/layout/MainLayout";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import Workspace from "./components/layout/Workspace";

import { TwinProvider } from "./features/dhun/context/TwinContext";
import { AssetRegistryProvider } from "./features/dhun/registry/AssetRegistryContext";

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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  return (
    <AssetRegistryProvider>
      <TwinProvider>
        <MainLayout>
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() =>
            setMobileSidebarOpen(false)
          }
          onToggleCollapse={() =>
            setSidebarCollapsed((value) => !value)
          }
        />

        <div className="flex min-w-0 flex-1 flex-col h-full min-h-0 overflow-hidden">
          <Topbar
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() =>
              setSidebarCollapsed((value) => !value)
            }
            onOpenMobileSidebar={() =>
              setMobileSidebarOpen(true)
            }
          />

          <Workspace />
        </div>
      </MainLayout>
    </TwinProvider>
  </AssetRegistryProvider>
  );
}

export default App;
