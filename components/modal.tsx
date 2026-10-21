"use client";

import { XIcon } from "lucide-react";
import { Dialog as D } from "radix-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  lead?: React.ReactNode;
  closeButton?: boolean;
  footer?: React.ReactNode;
  maxWidth?: number;
  onOpenAutoFocus?: (e: Event) => void;
  children?: React.ReactNode;
};

/** Centred dialog that becomes a bottom sheet at ≤640px (CSS: .scrim / .dialog). */
export function Modal({ open, onOpenChange, title, description, lead, closeButton, footer, maxWidth, onOpenAutoFocus, children }: Props) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="scrim">
          <D.Content className="dialog" style={maxWidth ? { maxWidth } : undefined} onOpenAutoFocus={onOpenAutoFocus}
            {...(!description && { "aria-describedby": undefined })}>
            <div className="dlg-head">
              {lead}
              <div className="grow">
                <D.Title asChild><h2>{title}</h2></D.Title>
                {description && <D.Description asChild><p>{description}</p></D.Description>}
              </div>
              {closeButton && (
                <D.Close className="icon-btn" aria-label="Close"><XIcon className="i" aria-hidden /></D.Close>
              )}
            </div>
            {children !== undefined && <div className="dlg-body">{children}</div>}
            {footer && <div className="dlg-foot">{footer}</div>}
          </D.Content>
        </D.Overlay>
      </D.Portal>
    </D.Root>
  );
}

export const ModalClose = D.Close;
