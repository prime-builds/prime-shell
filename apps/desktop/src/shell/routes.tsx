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

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
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
