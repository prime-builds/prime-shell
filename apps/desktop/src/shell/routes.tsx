import { createHashRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { HomeWorkspaceView } from "./views/HomeWorkspaceView";
import { SettingsShellView } from "./views/SettingsShellView";

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
        path: "settings",
        element: <SettingsShellView />,
      },
    ],
  },
]);
