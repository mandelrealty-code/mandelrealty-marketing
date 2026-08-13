import { useState } from "react";
import { PdfPages, fieldStyle } from "../../lib/pdfPages";
import {
  defaultFieldSize,
  newFieldId,
  type SignField,
  type SignFieldType,
} from "../../../shared/pm/signFields";

export function SignFieldPlacer({
  pdfUrl,
  fields,
  onChange,
}: {
  pdfUrl: string;
  fields: SignField[];
  onChange: (next: SignField[]) => void;
}) {
  const [tool, setTool] = useState<SignFieldType>("signature");
  const [selected, setSelected] = useState<string | null>(null);

  const place = (page: number, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = defaultFieldSize(tool);
    const x = (e.clientX - rect.left) / rect.width - size.w / 2;
    const y = (e.clientY - rect.top) / rect.height - size.h / 2;
    const field: SignField = {
      id: newFieldId(),
      type: tool,
      page,
      x: Math.min(1 - size.w, Math.max(0, x)),
      y: Math.min(1 - size.h, Math.max(0, y)),
      w: size.w,
      h: size.h,
    };
    onChange([...fields, field]);
    setSelected(field.id);
  };

  const label = (t: SignFieldType) =>
    t === "signature" ? "Sign here" : t === "name" ? "Printed name" : "Date";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["signature", "name", "date"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTool(t)}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold ${
              tool === t
                ? "bg-[#c4a35a] text-[#0a0a0a]"
                : "border border-white/12 text-[#9a9590]"
            }`}
          >
            {label(t)}
          </button>
        ))}
        <span className="text-[12px] text-[#6f6a65]">
          Click the PDF to drop a field · {fields.length} placed
        </span>
      </div>
      <PdfPages url={pdfUrl}>
        {(page) => (
          <div
            className="absolute inset-0 cursor-crosshair"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("[data-field]")) return;
              place(page, e);
            }}
          >
            {fields
              .filter((f) => f.page === page)
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-field
                  style={fieldStyle(f)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(f.id);
                  }}
                  className={`flex items-center justify-center rounded-[3px] border-2 text-[10px] font-semibold uppercase tracking-wide ${
                    selected === f.id
                      ? "border-[#c4a35a] bg-[#c4a35a]/25 text-[#1a1408]"
                      : "border-[#c4a35a]/80 bg-[#c4a35a]/15 text-[#5a4a28]"
                  }`}
                >
                  {label(f.type)}
                </button>
              ))}
          </div>
        )}
      </PdfPages>
      {selected ? (
        <button
          type="button"
          className="self-start text-[13px] font-semibold text-[#cf7f7b]"
          onClick={() => {
            onChange(fields.filter((f) => f.id !== selected));
            setSelected(null);
          }}
        >
          Remove selected field
        </button>
      ) : null}
    </div>
  );
}
