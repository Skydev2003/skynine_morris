"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Dialog({ children, title, close, className }: { children: ReactNode; title: string; close: () => void; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog className={className} ref={dialog} onClose={close} aria-label={title} onClick={(event) => {
      if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
      }
    }}>
      <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" type="button" onClick={() => dialog.current?.close()} aria-label="ปิด"><X /></button></div>
      {children}
    </dialog>
  );
}
