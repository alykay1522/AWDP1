import logo from "@assets/CopilotHEADER_1774977472463.png";
import { FaCcVisa, FaCcMastercard, FaCcAmex, FaCcDiscover, FaCcPaypal, FaCcStripe } from "react-icons/fa6";

export function SiteBanner() {
  return (
    <div className="w-full relative select-none">
      {/* Background: existing flag image as the top portion */}
      <div
        className="w-full bg-cover bg-center bg-no-repeat relative"
        style={{ backgroundImage: `url(${logo})`, paddingBottom: "24.6%" }}
        aria-label="All Window Door Parts — Veteran Owned and Operated"
      />

      {/* Bottom info bar */}
      <div className="w-full bg-[#1a1a1a] border-t-4 border-red-600">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">

          {/* Left: Veteran badge */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white font-bold text-sm md:text-base uppercase tracking-wider whitespace-nowrap">
              Veteran Owned and Operated
            </span>
          </div>

          {/* Center: Brand name */}
          <div className="font-extrabold text-base md:text-lg tracking-tight whitespace-nowrap hidden sm:block">
            <span style={{ color: "#e63946" }}>All</span>
            <span style={{ color: "#e7b800" }}>Window</span>
            <span style={{ color: "#06d6a0" }}>Door</span>
            <span style={{ color: "#118ab2" }}>Parts</span>
            <span style={{ color: "#f4a261" }}>Group</span>
          </div>

          {/* Right: Payment icons */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <span className="text-gray-400 text-xs uppercase tracking-wider mr-1 hidden md:block">We Accept</span>
            <FaCcVisa      className="text-[2.2rem] md:text-[2.6rem] drop-shadow" style={{ color: "#1a1f71" }} title="Visa" />
            <FaCcMastercard className="text-[2.2rem] md:text-[2.6rem] drop-shadow" style={{ color: "#eb001b" }} title="Mastercard" />
            <FaCcAmex      className="text-[2.2rem] md:text-[2.6rem] drop-shadow" style={{ color: "#2e77bc" }} title="American Express" />
            <FaCcDiscover  className="text-[2.2rem] md:text-[2.6rem] drop-shadow" style={{ color: "#e65c00" }} title="Discover" />
            <FaCcPaypal    className="text-[2.2rem] md:text-[2.6rem] drop-shadow" style={{ color: "#009cde" }} title="PayPal" />
            <FaCcStripe    className="text-[2.2rem] md:text-[2.6rem] drop-shadow" style={{ color: "#6772e5" }} title="Stripe" />
          </div>

        </div>
      </div>
    </div>
  );
}
