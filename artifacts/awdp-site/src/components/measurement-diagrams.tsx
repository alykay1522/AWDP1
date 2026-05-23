/* Measurement diagrams — simple labeled SVG line drawings for each part category */

function Label({ x, y, text, anchor = "middle", small = false }: {
  x: number; y: number; text: string; anchor?: string; small?: boolean;
}) {
  return (
    <text
      x={x} y={y}
      textAnchor={anchor as "middle" | "start" | "end"}
      fontSize={small ? 9 : 10.5}
      fontFamily="system-ui, sans-serif"
      fontWeight="600"
      fill="#1e3a5f"
    >{text}</text>
  );
}

function DimArrow({ x1, y1, x2, y2, label, labelOffset = [0, -5] }: {
  x1: number; y1: number; x2: number; y2: number;
  label?: string; labelOffset?: [number, number];
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const aw = 6;
  const ah = 3.5;

  function arrowHead(tx: number, ty: number, ang: number) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return `${tx},${ty} ${tx - aw * c + ah * s},${ty - aw * s - ah * c} ${tx - aw * c - ah * s},${ty - aw * s + ah * c}`;
  }

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2563eb" strokeWidth="1.4" />
      <polygon points={arrowHead(x2, y2, angle)} fill="#2563eb" />
      <polygon points={arrowHead(x1, y1, angle + Math.PI)} fill="#2563eb" />
      {label && (
        <text
          x={mx + labelOffset[0]} y={my + labelOffset[1]}
          textAnchor="middle"
          fontSize={9}
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
          fill="#2563eb"
          letterSpacing="0.02em"
        >{label}</text>
      )}
    </g>
  );
}

function Callout({ x, y, label, subLabel }: { x: number; y: number; label: string; subLabel?: string }) {
  return (
    <g>
      <rect x={x - 2} y={y - 13} width={label.length * 6.2 + 12} height={subLabel ? 26 : 16} rx={3}
        fill="#eff6ff" stroke="#93c5fd" strokeWidth="1" />
      <text x={x + 4} y={y - 2} fontSize={9} fontFamily="system-ui, sans-serif" fontWeight="700" fill="#1d4ed8">{label}</text>
      {subLabel && (
        <text x={x + 4} y={y + 10} fontSize={8} fontFamily="system-ui, sans-serif" fill="#3b82f6">{subLabel}</text>
      )}
    </g>
  );
}

/* ───────────────────────────── WINDOW BALANCE ───────────────────────────── */
export function BalanceDiagram() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full max-w-md">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Measurement Reference — Window Balance</p>
      <svg viewBox="0 0 320 390" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[320px] mx-auto block">

        {/* Balance tube body */}
        <rect x="130" y="28" width="44" height="310" rx="5"
          fill="#e2e8f0" stroke="#475569" strokeWidth="2" />

        {/* Top cap */}
        <rect x="124" y="22" width="56" height="14" rx="3"
          fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
        {/* Bottom cap / shoe */}
        <rect x="124" y="338" width="56" height="14" rx="3"
          fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />

        {/* Tension stamp zone */}
        <rect x="130" y="145" width="44" height="28" rx="2"
          fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,2" />
        <text x="152" y="161" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fontWeight="700" fill="#92400e">
          TENSION STAMP
        </text>
        <line x1="174" y1="159" x2="208" y2="159" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3,2" />
        <Callout x={208} y={165} label="e.g. 2840-16" subLabel="Write this number down" />

        {/* Length dimension arrow — left side */}
        <DimArrow x1={110} y1={22} x2={110} y2={352} label="TOTAL LENGTH" labelOffset={[-42, 0]} />
        <line x1={110} y1={22} x2={130} y2={22} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
        <line x1={110} y1={352} x2={130} y2={352} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />

        {/* Right side callout */}
        <line x1={174} y1={29} x2={210} y2={29} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3,2" />
        <Label x={212} y={32} text="Top end" anchor="start" small />
        <line x1={174} y1={345} x2={210} y2={345} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3,2" />
        <Label x={212} y={348} text="Bottom shoe" anchor="start" small />

        {/* Instruction note at top */}
        <Label x={160} y={14} text="Measure end-to-end, including caps" />
      </svg>
    </div>
  );
}

/* ───────────────────────────── CASEMENT OPERATOR ───────────────────────── */
export function OperatorDiagram() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full max-w-xl">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Measurement Reference — Casement Window Operator</p>
      <svg viewBox="0 0 480 340" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[480px] mx-auto block">

        {/* ── LEFT OPERATOR ── */}
        <text x="110" y="18" textAnchor="middle" fontSize={10} fontFamily="system-ui" fontWeight="700" fill="#334155">LEFT HAND</text>
        <text x="110" y="29" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fill="#64748b">(crank on left)</text>

        {/* Operator body */}
        <rect x="60" y="38" width="68" height="42" rx="4"
          fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
        {/* Crank nub — left */}
        <circle cx="64" cy="59" r="7" fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
        <text x="64" y="62.5" textAnchor="middle" fontSize={8} fontFamily="system-ui" fontWeight="700" fill="#1e293b">C</text>

        {/* Mounting screws — left operator */}
        <circle cx="75" cy="44" r="3.5" fill="none" stroke="#475569" strokeWidth="1.5" />
        <circle cx="75" cy="74" r="3.5" fill="none" stroke="#475569" strokeWidth="1.5" />
        <DimArrow x1={55} y1={44} x2={55} y2={74} label="HOLE SPACING" labelOffset={[-38, 0]} />
        <line x1={55} y1={44} x2={71} y2={44} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
        <line x1={55} y1={74} x2={71} y2={74} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />

        {/* Single arm — pointing left */}
        <line x1="60" y1="67" x2="18" y2="67" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
        <circle cx="18" cy="67" r="4" fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
        <text x="14" y="83" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fill="#64748b">arm pivot</text>

        {/* Sill track */}
        <rect x="18" y="88" width="110" height="8" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1.2" />
        <text x="73" y="111" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fill="#64748b">sill / frame</text>

        {/* ── DUAL ARM VARIANT ── */}
        <line x1={220} y1={0} x2={220} y2={340} stroke="#cbd5e1" strokeWidth="1" />

        <text x="358" y="18" textAnchor="middle" fontSize={10} fontFamily="system-ui" fontWeight="700" fill="#334155">RIGHT HAND</text>
        <text x="358" y="29" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fill="#64748b">(crank on right)</text>

        {/* Operator body — right */}
        <rect x="328" y="38" width="68" height="42" rx="4"
          fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
        {/* Crank nub — right */}
        <circle cx="392" cy="59" r="7" fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
        <text x="392" y="62.5" textAnchor="middle" fontSize={8} fontFamily="system-ui" fontWeight="700" fill="#1e293b">C</text>

        {/* Mounting screws — right */}
        <circle cx="352" cy="44" r="3.5" fill="none" stroke="#475569" strokeWidth="1.5" />
        <circle cx="352" cy="74" r="3.5" fill="none" stroke="#475569" strokeWidth="1.5" />
        <DimArrow x1={317} y1={44} x2={317} y2={74} label="HOLE SPACING" labelOffset={[-38, 0]} />
        <line x1={317} y1={44} x2={348} y2={44} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
        <line x1={317} y1={74} x2={348} y2={74} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />

        {/* Arm — pointing right */}
        <line x1="396" y1="67" x2="440" y2="67" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
        <circle cx="440" cy="67" r="4" fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
        <text x="444" y="83" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fill="#64748b">arm pivot</text>

        {/* Sill track — right */}
        <rect x="328" y="88" width="120" height="8" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1.2" />
        <text x="388" y="111" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fill="#64748b">sill / frame</text>

        {/* ARM STYLES section */}
        <text x="240" y="140" textAnchor="middle" fontSize={11} fontFamily="system-ui" fontWeight="700" fill="#1e3a5f">ARM STYLES</text>

        {/* Single arm */}
        <text x="75" y="165" textAnchor="middle" fontSize={9} fontFamily="system-ui" fontWeight="700" fill="#334155">SINGLE ARM</text>
        <rect x="40" y="175" width="50" height="28" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <line x1="90" y1="189" x2="128" y2="189" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="128" cy="189" r="3.5" fill="#94a3b8" stroke="#334155" strokeWidth="1.2" />

        {/* Dual arm */}
        <text x="240" y="165" textAnchor="middle" fontSize={9} fontFamily="system-ui" fontWeight="700" fill="#334155">DUAL ARM (PARALLEL)</text>
        <rect x="205" y="175" width="50" height="28" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <line x1="255" y1="183" x2="300" y2="176" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="255" y1="196" x2="300" y2="203" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="300" cy="176" r="3.5" fill="#94a3b8" stroke="#334155" strokeWidth="1.2" />
        <circle cx="300" cy="203" r="3.5" fill="#94a3b8" stroke="#334155" strokeWidth="1.2" />
        <line x1="300" y1="176" x2="300" y2="203" stroke="#475569" strokeWidth="2" />

        {/* Split arm */}
        <text x="405" y="165" textAnchor="middle" fontSize={9} fontFamily="system-ui" fontWeight="700" fill="#334155">SPLIT ARM</text>
        <rect x="370" y="175" width="50" height="28" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <line x1="420" y1="189" x2="445" y2="180" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="445" y1="180" x2="455" y2="189" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
        <line x1="455" y1="189" x2="445" y2="198" stroke="#475569" strokeWidth="2" strokeLinecap="round" />

        {/* Tip box */}
        <rect x="20" y="240" width="440" height="84" rx="5" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1.2" />
        <text x="35" y="258" fontSize={9.5} fontFamily="system-ui" fontWeight="700" fill="#1d4ed8">HOW TO DETERMINE HANDING:</text>
        <text x="35" y="273" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">1. Stand inside your home, facing the window.</text>
        <text x="35" y="287" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">2. If the crank handle is on the LEFT side of the frame → LEFT HAND operator.</text>
        <text x="35" y="301" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">3. If the crank handle is on the RIGHT side of the frame → RIGHT HAND operator.</text>
        <text x="35" y="315" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">4. Photograph the old operator from the front before removing it.</text>
      </svg>
    </div>
  );
}

/* ─────────────────────────── PATIO DOOR ROLLER ─────────────────────────── */
export function RollerDiagram() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full max-w-xl">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Measurement Reference — Patio Door Roller</p>
      <svg viewBox="0 0 460 360" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[460px] mx-auto block">

        {/* Housing body */}
        <rect x="110" y="70" width="180" height="100" rx="6"
          fill="#e2e8f0" stroke="#475569" strokeWidth="2.5" />

        {/* Wheel circle */}
        <circle cx="200" cy="148" r="38" fill="white" stroke="#475569" strokeWidth="2" />
        <circle cx="200" cy="148" r="6" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
        <line x1="200" y1="148" x2="237" y2="148" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" />

        {/* Wheel diameter arrow */}
        <DimArrow x1={162} y1={148} x2={238} y2={148} label="WHEEL DIA." labelOffset={[0, -10]} />

        {/* Housing HEIGHT arrow (left side) */}
        <DimArrow x1={92} y1={70} x2={92} y2={170} label="HOUSING HEIGHT" labelOffset={[-44, 0]} />
        <line x1={92} y1={70} x2={110} y2={70} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
        <line x1={92} y1={170} x2={110} y2={170} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />

        {/* Housing WIDTH arrow (top) */}
        <DimArrow x1={110} y1={52} x2={290} y2={52} label="HOUSING WIDTH" labelOffset={[0, -8]} />
        <line x1={110} y1={52} x2={110} y2={70} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
        <line x1={290} y1={52} x2={290} y2={70} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />

        {/* Mounting screw holes */}
        <circle cx="130" cy="85" r="5" fill="white" stroke="#334155" strokeWidth="1.5" />
        <line x1="127" y1="82" x2="133" y2="88" stroke="#334155" strokeWidth="1" />
        <line x1="133" y1="82" x2="127" y2="88" stroke="#334155" strokeWidth="1" />
        <circle cx="270" cy="85" r="5" fill="white" stroke="#334155" strokeWidth="1.5" />
        <line x1="267" y1="82" x2="273" y2="88" stroke="#334155" strokeWidth="1" />
        <line x1="273" y1="82" x2="267" y2="88" stroke="#334155" strokeWidth="1" />

        {/* Hole spacing dimension */}
        <DimArrow x1={130} y1={100} x2={270} y2={100} label="MOUNTING HOLE SPACING" labelOffset={[0, 12]} />
        <line x1={130} y1={86} x2={130} y2={103} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
        <line x1={270} y1={86} x2={270} y2={103} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />

        {/* Housing DEPTH (3D suggestion) */}
        <line x1="290" y1="70" x2="315" y2="50" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,2" />
        <line x1="290" y1="170" x2="315" y2="150" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,2" />
        <rect x="315" y="50" width="30" height="100" rx="3"
          fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <DimArrow x1={355} y1={50} x2={355} y2={150} label="HOUSING LENGTH" labelOffset={[44, 0]} />
        <line x1={345} y1={50} x2={356} y2={50} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
        <line x1={345} y1={150} x2={356} y2={150} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />

        {/* Wheel material labels */}
        <text x="230" y="225" textAnchor="start" fontSize={10} fontFamily="system-ui" fontWeight="700" fill="#1e3a5f">WHEEL MATERIAL</text>
        <g transform="translate(60, 230)">
          <circle cx="0" cy="0" r="14" fill="white" stroke="#475569" strokeWidth="1.5" />
          <text x="0" y="4" textAnchor="middle" fontSize={7} fontFamily="system-ui" fill="#64748b">NYLON</text>
          <text x="0" y="22" textAnchor="middle" fontSize={8} fontFamily="system-ui" fontWeight="600" fill="#334155">Nylon</text>
        </g>
        <g transform="translate(130, 230)">
          <circle cx="0" cy="0" r="14" fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
          <text x="0" y="4" textAnchor="middle" fontSize={7} fontFamily="system-ui" fill="white">STEEL</text>
          <text x="0" y="22" textAnchor="middle" fontSize={8} fontFamily="system-ui" fontWeight="600" fill="#334155">Steel</text>
        </g>
        <g transform="translate(205, 230)">
          <circle cx="-14" cy="0" r="11" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
          <circle cx="14" cy="0" r="11" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
          <text x="0" y="22" textAnchor="middle" fontSize={8} fontFamily="system-ui" fontWeight="600" fill="#334155">Tandem</text>
        </g>

        {/* Tip box */}
        <rect x="20" y="275" width="420" height="72" rx="5" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1.2" />
        <text x="35" y="292" fontSize={9.5} fontFamily="system-ui" fontWeight="700" fill="#1d4ed8">IMPORTANT: Measure ALL five dimensions before ordering.</text>
        <text x="35" y="307" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">Two rollers can share the same wheel diameter but have different housing sizes.</text>
        <text x="35" y="321" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">They are not interchangeable. Photograph the removed roller next to a coin for scale.</text>
        <text x="35" y="337" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">Check the door frame header or stile for the manufacturer label.</text>
      </svg>
    </div>
  );
}

/* ─────────────────────────── WEATHERSTRIPPING ───────────────────────────── */
export function WeatherstripDiagram() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full max-w-xl">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Measurement Reference — Weatherstripping Profiles</p>
      <svg viewBox="0 0 460 360" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[460px] mx-auto block">

        {/* ── KERF-IN T-BARB ── */}
        <text x="80" y="22" textAnchor="middle" fontSize={10} fontFamily="system-ui" fontWeight="700" fill="#1e3a5f">KERF-IN (T-BARB)</text>
        <text x="80" y="33" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fill="#64748b">most common type</text>

        {/* Sash frame with kerf slot */}
        <rect x="30" y="42" width="100" height="60" rx="3" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
        <rect x="72" y="42" width="16" height="30" rx="1" fill="white" stroke="#475569" strokeWidth="1" />

        {/* T-barb profile */}
        <rect x="76" y="50" width="8" height="22" rx="1" fill="#4ade80" stroke="#16a34a" strokeWidth="1.2" />
        <rect x="68" y="47" width="24" height="8" rx="1.5" fill="#4ade80" stroke="#16a34a" strokeWidth="1.2" />

        {/* Kerf width dim */}
        <DimArrow x1={72} y1={38} x2={88} y2={38} label="KERF WIDTH" labelOffset={[0, -8]} />
        <line x1={72} y1={38} x2={72} y2={44} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="2,2" />
        <line x1={88} y1={38} x2={88} y2={44} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="2,2" />

        {/* Overall height dim */}
        <DimArrow x1={20} y1={47} x2={20} y2={72} label="HEIGHT" labelOffset={[-28, 0]} />
        <line x1={20} y1={47} x2={68} y2={47} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="2,2" />
        <line x1={20} y1={72} x2={68} y2={72} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="2,2" />

        <Callout x={20} y={118} label="1/8″ or 3/16″" subLabel="NOT interchangeable" />

        {/* ── BULB SEAL ── */}
        <line x1={180} y1={0} x2={180} y2={200} stroke="#cbd5e1" strokeWidth="1" />
        <text x="270" y="22" textAnchor="middle" fontSize={10} fontFamily="system-ui" fontWeight="700" fill="#1e3a5f">BULB SEAL</text>
        <text x="270" y="33" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fill="#64748b">press-fit into groove</text>

        {/* Sash */}
        <rect x="220" y="42" width="100" height="60" rx="3" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
        {/* Narrow groove */}
        <rect x="258" y="42" width="8" height="20" rx="1" fill="white" stroke="#475569" strokeWidth="1" />
        {/* Bulb stem */}
        <rect x="260" y="44" width="4" height="18" rx="1" fill="#60a5fa" stroke="#2563eb" strokeWidth="1" />
        {/* Bulb circle */}
        <ellipse cx="262" cy="67" rx="11" ry="10" fill="#60a5fa" stroke="#2563eb" strokeWidth="1.2" />

        {/* Overall width dim */}
        <DimArrow x1={243} y1={85} x2={281} y2={85} label="WIDTH" labelOffset={[0, 10]} />
        <line x1={243} y1={77} x2={243} y2={88} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="2,2" />
        <line x1={281} y1={77} x2={281} y2={88} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="2,2" />

        {/* ── PILE / FIN SEAL ── */}
        <line x1={370} y1={0} x2={370} y2={200} stroke="#cbd5e1" strokeWidth="1" />
        <text x="415" y="22" textAnchor="middle" fontSize={10} fontFamily="system-ui" fontWeight="700" fill="#1e3a5f">PILE SEAL</text>
        <text x="415" y="33" textAnchor="middle" fontSize={8.5} fontFamily="system-ui" fill="#64748b">sliding contact</text>

        {/* Sash */}
        <rect x="385" y="42" width="60" height="60" rx="3" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
        {/* Pile backing */}
        <rect x="405" y="42" width="10" height="26" rx="1" fill="#fde68a" stroke="#d97706" strokeWidth="1.2" />
        {/* Pile fibers */}
        {[0, 2, 4, 6, 8, 10].map((i) => (
          <line key={i} x1={406 + i} y1={68} x2={407 + i} y2={82}
            stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
        ))}

        {/* Measurement section */}
        <rect x="20" y="200" width="420" height="42" rx="4" fill="#fef9c3" stroke="#fde047" strokeWidth="1.2" />
        <text x="35" y="217" fontSize={9.5} fontFamily="system-ui" fontWeight="700" fill="#713f12">ALWAYS MEASURE FROM AN UNDAMAGED SECTION</text>
        <text x="35" y="231" fontSize={9} fontFamily="system-ui" fill="#78350f">Worn or compressed weatherstrip gives false readings. Cut a 1–2″ sample for comparison.</text>

        {/* Tip box */}
        <rect x="20" y="255" width="420" height="90" rx="5" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1.2" />
        <text x="35" y="272" fontSize={9.5} fontFamily="system-ui" fontWeight="700" fill="#1d4ed8">FOUR MEASUREMENTS REQUIRED:</text>
        <text x="35" y="287" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">1. Profile type — kerf-in, bulb, pile, or foam tape</text>
        <text x="35" y="301" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">2. Kerf width (kerf-in only) — 1/8″ and 3/16″ are NOT interchangeable</text>
        <text x="35" y="315" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">3. Overall height and overall width of the profile</text>
        <text x="35" y="329" fontSize={9} fontFamily="system-ui" fill="#1e3a5f">4. Linear feet needed — measure all four sides of the opening</text>
      </svg>
    </div>
  );
}
