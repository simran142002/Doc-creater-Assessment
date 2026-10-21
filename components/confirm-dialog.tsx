"use client";

import { Trash2Icon } from "lucide-react";
import { Modal, ModalClose } from "@/components/modal";
import { Button } from "@/components/ui/button";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; title: string; body: string; confirm: string; onConfirm: () => void };

export function ConfirmDialog({ open, onOpenChange, title, body, confirm, onConfirm }: Props) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      maxWidth={440}
      lead={<span className="confirm-ico"><Trash2Icon className="i" aria-hidden /></span>}
      title={title}
      description={body}
      footer={
        <>
          <ModalClose asChild><Button variant="ghost">Cancel</Button></ModalClose>
          <Button variant="danger" autoFocus onClick={() => { onConfirm(); onOpenChange(false); }}>{confirm}</Button>
        </>
      }
    />
  );
}
