import { Info, Package, Tag, CheckCircle2 } from "lucide-react";

const ATTR_LABELS: Record<string, string> = {
  balance_type:        "Balance Type",
  series:              "Series",
  length:              "Length",
  length_inches:       "Length (inches)",
  weight_code:         "Stamping / Weight Code",
  shoe_type:           "Terminal Shoe Type",
  top_guide:           "Top Guide / Bracket",
  configuration:       "Configuration",
  brand_compatibility: "Brand Compatibility",
  compatibility:       "Compatible With",
  diameter:            "Diameter",
  tip_color:           "Tip Color",
  terminal_color:      "Terminal Color",
  sash_position:       "Sash Position",
  jamb_liner_type:     "Jamb Liner Type",
  coil_weight:         "Coil Weight",
  oem_family:          "OEM Family",
  operator_type:       "Operator Type",
  arm_length_inches:   "Arm Length (inches)",
  mount_type:          "Mount Type",
  hand:                "Hand",
  colors:              "Available Colors",
  color:               "Color",
  material:            "Material",
  part_type:           "Part Type",
  wheel_material:      "Wheel Material",
  wheel_diameter_inches: "Wheel Diameter (inches)",
  housing_material:    "Housing Material",
  adjustment:          "Adjustment",
  door_type:           "Door Type",
  profile_width:       "Profile Width",
  sold_by:             "Sold By",
  dimension:           "Dimension",
  brand:               "Brand",
  keyed:               "Keyed",
};

const HIDDEN_KEYS = new Set(["subcategory", "original_sku"]);

const ATTR_ORDER = [
  "balance_type", "operator_type", "part_type",
  "series", "length", "length_inches", "diameter", "arm_length_inches",
  "weight_code", "tip_color", "terminal_color", "color", "colors",
  "shoe_type", "top_guide", "mount_type", "hand",
  "configuration", "adjustment", "door_type",
  "material", "wheel_material", "wheel_diameter_inches", "housing_material",
  "profile_width", "dimension", "sold_by",
  "coil_weight", "sash_position", "jamb_liner_type", "keyed",
  "oem_family", "brand", "brand_compatibility", "compatibility",
];

const BALANCE_TYPE_COLORS: Record<string, string> = {
  "Channel":         "bg-blue-100 text-blue-800 border-blue-200",
  "Spiral":          "bg-violet-100 text-violet-800 border-violet-200",
  "Coil":            "bg-amber-100 text-amber-800 border-amber-200",
  "Tilt":            "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Constant Force":  "bg-orange-100 text-orange-800 border-orange-200",
  "Tilt Tube":       "bg-teal-100 text-teal-800 border-teal-200",
  "Devac Overhead":  "bg-pink-100 text-pink-800 border-pink-200",
  "Plastic Tube":    "bg-sky-100 text-sky-800 border-sky-200",
  "OEM":             "bg-rose-100 text-rose-800 border-rose-200",
};

function normalizeToArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "boolean") return [value ? "Yes" : "No"];
  const s = String(value).trim();
  return s ? [s] : [];
}

interface AttributeConfiguratorProps {
  attributes: Record<string, unknown> | null | undefined;
  soldAs?: string | null;
  notes?: string[];
}

export function AttributeConfigurator({ attributes, soldAs, notes }: AttributeConfiguratorProps) {
  if (!attributes || Object.keys(attributes).length === 0) return null;

  const visibleKeys = Object.keys(attributes).filter(
    (k) => !HIDDEN_KEYS.has(k) && normalizeToArray(attributes[k]).length > 0
  );

  const orderedKeys = ATTR_ORDER.filter((k) => visibleKeys.includes(k));
  const extraKeys = visibleKeys.filter((k) => !ATTR_ORDER.includes(k));
  const allKeys = [...orderedKeys, ...extraKeys];

  if (allKeys.length === 0) return null;

  const isBrandCompat = (key: string) => key === "brand_compatibility" || key === "compatibility";

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-slate-800">Product Specifications</span>
        </div>
        {soldAs && (
          <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
            <Package className="w-3 h-3" />
            Sold as: {soldAs}
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {allKeys.map((key) => {
          const values = normalizeToArray(attributes[key]);
          const label = ATTR_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const isCompat = isBrandCompat(key);

          return (
            <div key={key} className="flex items-start gap-3 px-4 py-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-40 shrink-0 pt-0.5">
                {label}
              </span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {values.map((val) => {
                  const btColor = key === "balance_type"
                    ? (BALANCE_TYPE_COLORS[val] ?? "bg-slate-100 text-slate-700 border-slate-200")
                    : null;
                  return (
                    <span
                      key={val}
                      className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md border ${
                        btColor ?? (isCompat
                          ? "bg-slate-50 text-slate-600 border-slate-200"
                          : "bg-white text-slate-800 border-slate-300")
                      }`}
                    >
                      {val}
                    </span>
                  );
                })}
              </div>
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
                {notes.map((note, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-amber-700">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    {note}
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
