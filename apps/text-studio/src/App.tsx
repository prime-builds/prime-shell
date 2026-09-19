import { RouterProvider } from "react-router-dom";
import { AppThemeProvider } from "./providers/AppThemeProvider";
import { router } from "./shell/routes";
import "./app.css";

export default function App() {
  return (
    <AppThemeProvider>
      <RouterProvider router={router} />
    </AppThemeProvider>
  );
}
