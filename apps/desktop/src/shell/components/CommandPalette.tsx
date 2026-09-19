import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Input,
  makeStyles,
  mergeClasses,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Search20Regular } from "@fluentui/react-icons";
import { type CommandContribution, featureRegistry } from "../../features";
import { normalizeShortcut } from "../../features/validation";

const useStyles = makeStyles({
  backdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: "12vh",
    zIndex: 1000,
    boxSizing: "border-box",
  },
  dialog: {
    width: "560px",
    maxWidth: "90vw",
    maxHeight: "60vh",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow64,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: "12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  searchInput: {
    width: "100%",
  },
  list: {
    overflowY: "auto",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxHeight: "360px",
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground1,
    userSelect: "none",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  itemHighlighted: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    color: tokens.colorCompoundBrandForeground1,
    outline: `1px solid ${tokens.colorCompoundBrandStroke}`,
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    ":hover": {
      backgroundColor: "transparent",
    },
  },
  itemContent: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    overflow: "hidden",
  },
  itemMeta: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  empty: {
    padding: "24px",
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
  shortcutBadge: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    padding: "2px 6px",
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground2,
  },
});

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useMemo(() => featureRegistry.getCommands(), []);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.category?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Reset highlight and query when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Adjust highlight index when filtered list changes
  useEffect(() => {
    setHighlightedIndex((prev) => {
      if (filteredCommands.length === 0) return 0;
      if (prev >= filteredCommands.length) return filteredCommands.length - 1;
      return prev;
    });
  }, [filteredCommands.length]);

  const executeCommand = useCallback(
    async (cmd: CommandContribution) => {
      if (cmd.isEnabled && !cmd.isEnabled()) return;
      onClose();
      try {
        await cmd.execute();
      } catch (err) {
        console.error(`[CommandPalette] Failed to execute command ${cmd.id}:`, err);
      }
    },
    [onClose],
  );

  // Keyboard navigation inside palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev + 1 < filteredCommands.length ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev - 1 >= 0 ? prev - 1 : Math.max(0, filteredCommands.length - 1),
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredCommands[highlightedIndex];
        if (selected) {
          void executeCommand(selected);
        }
      }
    },
    [executeCommand, filteredCommands, highlightedIndex, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      data-testid="command-palette-backdrop"
      role="presentation"
    >
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        data-testid="command-palette-dialog"
      >
        <div className={styles.header}>
          <Input
            ref={inputRef}
            className={styles.searchInput}
            contentBefore={<Search20Regular />}
            placeholder="Type a command or search..."
            value={query}
            onChange={(_, d) => setQuery(d.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search commands"
            data-testid="command-palette-input"
          />
        </div>

        <div
          className={styles.list}
          role="listbox"
          aria-label="Commands"
          data-testid="command-palette-list"
        >
          {filteredCommands.length === 0 ? (
            <div className={styles.empty}>No matching commands found.</div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const isHighlighted = index === highlightedIndex;
              const isEnabled = !cmd.isEnabled || cmd.isEnabled();

              return (
                <div
                  key={cmd.id}
                  role="option"
                  aria-selected={isHighlighted}
                  aria-disabled={!isEnabled}
                  className={mergeClasses(
                    styles.item,
                    isHighlighted && styles.itemHighlighted,
                    !isEnabled && styles.itemDisabled,
                  )}
                  onClick={() => void executeCommand(cmd)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  data-testid={`command-item-${cmd.id}`}
                >
                  <div className={styles.itemContent}>
                    <Text weight={isHighlighted ? "semibold" : "regular"} size={300}>
                      {cmd.title}
                    </Text>
                    {cmd.description && (
                      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                        {cmd.description}
                      </Text>
                    )}
                  </div>

                  <div className={styles.itemMeta}>
                    {cmd.category && (
                      <Badge appearance="tint" color="brand">
                        {cmd.category}
                      </Badge>
                    )}
                    {cmd.shortcut && (
                      <span className={styles.shortcutBadge}>{cmd.shortcut}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to set up global shortcut listening for commands registered in the feature registry.
 */
export function useCommandShortcuts(onOpenPalette: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when inside input/textarea/editable
      const target = e.target as HTMLElement;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Ctrl+K or Ctrl+Shift+P: Toggle Command Palette (allowed everywhere)
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        (e.key.toLowerCase() === "k" || (e.shiftKey && e.key.toLowerCase() === "p"))
      ) {
        e.preventDefault();
        onOpenPalette();
        return;
      }

      if (isEditable) return;

      // Check registered command shortcuts
      const commands = featureRegistry.getCommands();
      const pressedParts: string[] = [];
      if (e.ctrlKey) pressedParts.push("ctrl");
      if (e.altKey) pressedParts.push("alt");
      if (e.shiftKey) pressedParts.push("shift");
      if (e.metaKey) pressedParts.push("meta");
      pressedParts.push(e.key.toLowerCase());

      const pressedNormalized = normalizeShortcut(pressedParts.join("+"));

      for (const cmd of commands) {
        if (!cmd.shortcut) continue;
        const cmdNormalized = normalizeShortcut(cmd.shortcut);
        if (cmdNormalized === pressedNormalized) {
          if (!cmd.isEnabled || cmd.isEnabled()) {
            e.preventDefault();
            void cmd.execute();
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenPalette]);
}
