import React from "react";
import { makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  workspace: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0, // Critical for preventing flex items from overflowing horizontally
    height: "100%",
    overflowX: "hidden",
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    boxSizing: "border-box",
  },
});

interface WorkspaceHostProps {
  children?: React.ReactNode;
}

export const WorkspaceHost: React.FC<WorkspaceHostProps> = ({ children }) => {
  const styles = useStyles();

  return (
    <main className={styles.workspace} id="main-workspace" aria-label="Main Workspace">
      {children}
    </main>
  );
};
