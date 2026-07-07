import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, Package, Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ATTR_LABELS: Record<string, string> = {
  balance_type: "Balance Type",
  series: "Series",
  length: "Length",
  length_inches: "Length (inches)",
  weight_code: "Stamping / Weight Code",
  shoe_type: "Terminal Shoe Type",
  top_guide: "Top Guide / Bracket",
  configuration: "Configuration",
  brand_compatibility: "Brand Compatibility",
  compatibility: "Compatible With",
  diameter: "Diameter",
  tip_color: "Tip Color",
  terminal_color: "Terminal Color",
  sash_position: "Sash Position",
  jamb_liner_type: "Jamb Liner Type",
  coil_weight: "Coil Weight",
  oem_family: "OEM Family",
  operator_type: "Operator Type",
  arm_length_inches: "Arm Length (inches)",
  mount_type: "Mount Type",
  hand: "Handing / Location",
  colors: "Available Colors",
  color: "Color / Finish",
  fastener_color: "Fastener Color",
  coastal_stainless: "Coastal Stainless Steel",
  material: "Material",
  part_type: "Part Type",
  wheel_material: "Wheel Material",
  wheel_diameter_inches: "Wheel Diameter (inches)",
  housing_material: "Housing Material",
  adjustment: "Adjustment",
  door_type: "Door Type",
  profile_width: "Profile Width",
  sold_by: "Sold By",
  dimension: "Dimension",
  brand: "Brand",
  keyed: "Keyed",
};

const HIDDEN_KEYS = new Set(["subcategory", "original_sku"]);
const ATTR_ORDER = [
  "balance_type", "operator_type", "part_type", "series", "length",
  "length_inches", "diameter", "arm_length_inches", "weight_code",
  "tip_color", "terminal_color", "color", "colors", "fastener_color",
  "shoe_type", "top_guide", "mount_type", "hand", "coastal_stainless",
  "configuration", "adjustment", "door_type", "material", "wheel_material",
  "wheel_diameter_inches", "housing_material", "profile_width", "dimension",
  "sold_by", "coil_weight", "sash_position", "jamb_liner_type", "keyed",
  "oem_family", "brand", "brand_compatibility", "compatibility",
];

const BALANCE_TYPE_COLORS: Record<string, string> = {
  Channel: "bg-blue-100 text-blue-800 border-blue-200",
  Spiral: "bg-violet-100 text-violet-800 border-violet-200",
  Coil: "bg-amber-100 text-amber-800 border-amber-200",
  Tilt: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Constant Force": "bg-orange-100 text-orange-800 border-orange-200",
  "Tilt Tube": "bg-teal-100 text-teal-800 border-teal-200",
  "Devac Overhead": "bg-pink-100 text-pink-800 border-pink-200",
  "Plastic Tube": "bg-sky-100 text-sky-800 border-sky-200",
  OEM: "bg-rose-100 text-rose-800 border-rose-200",
};

type SelectionWindow = Window & {
  __awdpSelectedAttributes?: Record<string, string>;
};

function publishSelection(selection: Record<string, string>) {
  if (typeof window !== "undefined") {
    (window as SelectionWindow).__awdpSelectedAttributes = selection;
  }
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function normalizeToArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return uniqueValues(value.map(String));
  }
  if (typeof value === "boolean") return [value ? "Yes" : "No"];

  const text = String(value).trim();
  if (!text) return [];

  // Marvin import rows store dropdown choices in specifications as pipe-delimited
  // JSON strings, e.g. {"Color":"White ($68.88)|Bronze ($68.88)"}.
  // Split those into one selectable option per value while leaving ordinary
  // single-value specifications untouched.
  if (text.includes("|")) {
    return uniqueValues(text.split("|"));
  }

  return [text];
}

interface AttributeConfiguratorProps {
  attributes: Record<string, unknown> | null | undefined;
  soldAs?: string | null;
  notes?: string[];
  onSelectionChange?: (selection: Record<string, string>) => void;
}

export function AttributeConfigurator({
  attributes,
  soldAs,
  notes,
  onSelectionChange,
}: AttributeConfiguratorProps) {
  const allKeys = useMemo(() => {
    if (!attributes) return [];
    const visibleKeys = Object.keys(attributes).filter(
      (key) => !HIDDEN_KEYS.has(key) && normalizeToArray(attributes[key]).length > 0,
    );
    return [
      ...ATTR_ORDER.filter((key) => visibleKeys.includes(key)),
      ...visibleKeys.filter((key) => !ATTR_ORDER.includes(key)),
    ];
  }, [attributes]);

  const initialSelection = useMemo(() => {
    const next: Record<string, string> = {};
    if (!attributes) return next;
    for (const key of allKeys) {
      const values = normalizeToArray(attributes[key]);
      if (values.length > 0) next[key] = values[0];
    }
    return next;
  }, [allKeys, attributes]);

  const [selection, setSelection] = useState<Record<string, string>>(initialSelection);

  useEffect(() => {
    setSelection(initialSelection);
    publishSelection(initialSelection);
    onSelectionChange?.(initialSelection);
    return () => publishSelection({});
  }, [initialSelection, onSelectionChange]);

  if (!attributes || allKeys.length === 0) return null;

  const updateSelection = (key: string, value: string) => {
    setSelection((current) => {
      const next = { ...current, [key]: value };
      publishSelection(next);
      onSelectionChange?.(next);
      return next;
    });
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-slate-800">Select Product Options</span>
        </div>
        {soldAs && (
          <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
            <Package className="w-3 h-3" /> Sold as: {soldAs}
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {allKeys.map((key) => {
          const values = normalizeToArray(attributes[key]);
          const label = ATTR_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const isCompat = key === "brand_compatibility" || key === "compatibility";
          return (
            <div key={key} className="grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)] gap-2 sm:gap-4 px-4 py-3 items-center">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
              {values.length > 1 ? (
                <Select value={selection[key] ?? values[0]} onValueChange={(value) => updateSelection(key, value)}>
                  <SelectTrigger className="w-full bg-white" aria-label={`Select ${label}`}>
                    <SelectValue placeholder={`Select ${label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {values.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {values.map((value) => {
                    const balanceTypeColor = key === "balance_type"
                      ? (BALANCE_TYPE_COLORS[value] ?? "bg-slate-100 text-slate-700 border-slate-200")
                      : null;
                    return (
                      <span key={value} className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md border ${
                        balanceTypeColor ?? (isCompat
                          ? "bg-slate-50 text-slate-600 border-slate-200"
                          : "bg-white text-slate-800 border-slate-300")
                      }`}>{value}</span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notes && notes.length > 0 && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800 mb-1">Before Ordering</p>
              <ul className="space-y-0.5">
                {notes.map((note) => (
                  <li key={note} className="flex items-center gap-1.5 text-xs text-amber-700">
                    <CheckCircle2 className="w-3 h-3 shrink-0" /> {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
