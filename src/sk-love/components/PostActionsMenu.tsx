// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

type PostActionsMenuProps = {
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onDefault?: () => void;
};

export default function PostActionsMenu({ canEdit, onEdit, onDelete, onDefault }: PostActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (canEdit) setOpen((v) => !v);
          else onDefault?.();
        }}
        className="p-1 hover:bg-slate-900 rounded-lg text-slate-400"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && canEdit && (
        <div className="absolute right-0 top-full mt-1 z-30 w-32 rounded-xl border border-slate-800 bg-[#0b0914] shadow-2xl overflow-hidden">
          <button
            onClick={() => {
              setOpen(false);
              onEdit?.();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10.5px] font-bold text-slate-200 hover:bg-slate-900"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={() => {
              setOpen(false);
              if (confirm("এই post টা delete করতে চাও?")) onDelete?.();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10.5px] font-bold text-red-400 hover:bg-slate-900"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
