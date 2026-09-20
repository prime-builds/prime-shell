import { createHashRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { HomeWorkspaceView } from "./views/HomeWorkspaceView";
import { SettingsShellView } from "./views/SettingsShellView";
import { featureRegistry } from "../features";

// Map registered feature routes dynamically
const featureRoutes = featureRegistry.getRoutes().map((route) => ({
  path: route.path.startsWith("/") ? route.path.slice(1) : route.path,
  element: route.element,
}));

import { useRouteError } from "react-router-dom";

function RootError() {
  const error = useRouteError();
  const errorMessage =
    error instanceof Error
      ? error.stack || error.message
      : typeof error === "object" && error !== null && "statusText" in error
        ? String((error as { statusText: unknown }).statusText)
        : String(error);
  return (
    <div style={{ padding: "32px", color: "#FF6B6B", background: "#1F1F1F", height: "100vh", boxSizing: "border-box", fontFamily: "sans-serif" }}>
      <h2>Router Caught Error</h2>
      <pre style={{ whiteSpace: "pre-wrap", background: "#2A2A2A", padding: "16px", borderRadius: "6px" }}>
        {errorMessage}
      </pre>
    </div>
  );
}

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RootError />,
    children: [
      {
        index: true,
        element: <HomeWorkspaceView />,
      },
      {
        path: "workspace",
        element: <HomeWorkspaceView />,
      },
      {
        path: "settings",
        element: <SettingsShellView />,
      },
      ...featureRoutes,
    ],
  },
]);
