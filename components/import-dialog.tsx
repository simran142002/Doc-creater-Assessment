"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleAlertIcon, FileUpIcon } from "lucide-react";
import { Modal, ModalClose } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/client/api";
import { wordCount } from "@/lib/client/format";
import { importReports } from "@/lib/client/import-reports";
import type { JSONNode } from "@/lib/client/types";
import { IMPORT_ACCEPT, importErrorMessage, useImport } from "@/lib/client/use-import";
import { cn } from "@/lib/utils";

const textOf = (n: JSONNode): string => n.text ?? (n.content ?? []).map(textOf).join(" ");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Drop or pick a file → the doc is created at once → opens with a fidelity report (Undo lives there). */
export function ImportDialog({ open, onOpenChange, file }: { open: boolean; onOpenChange: (o: boolean) => void; file?: File | null }) {
  const router = useRouter();
  const { upload } = useImport();
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const started = useRef<File | null>(null);

  const handle = async (f: File) => {
    setReading(f.name);
    setError(null);
    try {
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const [res] = await Promise.all([upload(f), sleep(reduce ? 0 : 450)]);
      importReports.set(res.doc.id, { file: f.name, report: res.report, words: wordCount(textOf(res.doc.content)) });
      onOpenChange(false);
      router.push(`/d/${res.doc.id}`);
    } catch (e) {
      setReading(null);
      setError(e instanceof ApiError ? importErrorMessage(e, f) : "Something went wrong reading that file.");
      setShakeKey((k) => k + 1);
    }
  };

  useEffect(() => {
    if (open && file && started.current !== file) {
      started.current = file;
      void handle(file);
    }
    if (!open) started.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  const change = (o: boolean) => {
    if (!o) {
      setError(null);
      setReading(null);
    }
    onOpenChange(o);
  };

  return (
    <Modal
      open={open}
      onOpenChange={change}
      maxWidth={580}
      closeButton
      title="Import a document"
      description="We'll turn it into an editable doc and open it, with a report of what was kept. You can undo straight away."
      footer={
        <>
          <span className="grow">Supported: .txt, .md, .docx · up to 2 MB</span>
          <ModalClose asChild><Button variant="ghost">Cancel</Button></ModalClose>
        </>
      }
    >
      {reading ? (
        <div className="import-loading" role="status"><div className="bar" /><span>Reading {reading}…</span></div>
      ) : (
        <label
          key={shakeKey}
          className={cn("dropzone", error && "is-error shake", over && "is-over")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void handle(f);
          }}
        >
          <span className="big">{error ? <CircleAlertIcon className="i i--lg" aria-hidden /> : <FileUpIcon className="i i--lg" aria-hidden />}</span>
          <h3>{error ? "That file didn't work" : "Drop a file here"}</h3>
          <p role={error ? "alert" : undefined}>{error ?? <>or <u>browse your computer</u></>}</p>
          <div className="types"><span className="chip">.txt</span><span className="chip">.md</span><span className="chip">.docx</span><span className="chip">≤ 2 MB</span></div>
          <input type="file" accept={IMPORT_ACCEPT} aria-label="Choose a file to import" onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void handle(f);
          }} />
        </label>
      )}
    </Modal>
  );
}
