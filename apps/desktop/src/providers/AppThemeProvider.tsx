import React from "react";
import { FluentProvider, makeStyles } from "@fluentui/react-components";
import { ThemeProviderContext, useThemeController } from "../theme/ThemeContext";
import { createAppTheme } from "../theme/createAppTheme";
import "@prime-shell/design-tokens/forced-colors.css";

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
});

const FluentThemeProviderInner: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const styles = useStyles();
  const { effectiveTheme, tokens, brandRamp } = useThemeController();

  const theme = React.useMemo(() => {
    return createAppTheme(effectiveTheme, tokens, brandRamp);
  }, [effectiveTheme, tokens, brandRamp]);

  return (
    <FluentProvider theme={theme} className={styles.root}>
      {children}
    </FluentProvider>
  );
};

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <ThemeProviderContext>
      <FluentThemeProviderInner>{children}</FluentThemeProviderInner>
    </ThemeProviderContext>
  );
};
