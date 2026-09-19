import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
} from "@fluentui/react-components";

export interface DialogHostProps {
  isOpen: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export const DialogHost: React.FC<DialogHostProps> = ({
  isOpen,
  title,
  children,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  isDanger = false,
  onClose,
  onConfirm,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface aria-label={title}>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>{children}</DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" onClick={onClose}>
                {cancelLabel}
              </Button>
            </DialogTrigger>
            {onConfirm && (
              <Button
                appearance={isDanger ? "primary" : "primary"}
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
              >
                {confirmLabel}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
