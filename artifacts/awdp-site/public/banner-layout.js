(() => {
  "use strict";

  const BANNER_SELECTOR = 'img[src*="/assets/header_bg"]';
  const STYLE_ID = "awdp-responsive-banner-styles";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .awdp-banner-shell {
        position: relative;
        width: 100%;
        height: clamp(260px, 22.4vw, 430px);
        overflow: hidden;
        background: #d2d2d2;
        line-height: 0;
        isolation: isolate;
      }

      .awdp-banner-backdrop {
        position: absolute;
        z-index: 0;
        inset: -24px;
        width: calc(100% + 48px);
        height: calc(100% + 48px);
        max-height: none !important;
        object-fit: cover;
        object-position: center 38%;
        filter: blur(18px) saturate(0.9) brightness(0.94);
        transform: scale(1.035);
        pointer-events: none;
        user-select: none;
      }

      .awdp-banner-foreground {
        position: relative;
        z-index: 1;
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        max-height: none !important;
        margin: 0 auto !important;
        object-fit: contain !important;
        object-position: center center !important;
      }

      @media (max-width: 899px) {
        .awdp-banner-shell {
          height: auto;
          background: #d2d2d2;
        }

        .awdp-banner-backdrop {
          display: none !important;
        }

        .awdp-banner-foreground {
          width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceBanner(image) {
    const parent = image.parentElement;
    if (!parent || image.dataset.awdpBannerEnhanced === "true") return;

    const source = image.currentSrc || image.src;
    if (!source) return;

    installStyles();
    parent.classList.add("awdp-banner-shell");

    const label = image.getAttribute("alt") || "We Fix It USA — free online parts identification — veteran owned and operated";
    parent.setAttribute("role", "img");
    parent.setAttribute("aria-label", label);

    const backdrop = document.createElement("img");
    backdrop.src = source;
    backdrop.alt = "";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.className = "awdp-banner-backdrop";
    backdrop.decoding = "async";
    backdrop.dataset.awdpBannerEnhanced = "true";

    image.classList.add("awdp-banner-foreground");
    image.setAttribute("alt", "");
    image.setAttribute("aria-hidden", "true");
    image.dataset.awdpBannerEnhanced = "true";

    parent.insertBefore(backdrop, image);
  }

  function scan() {
    document.querySelectorAll(BANNER_SELECTOR).forEach(enhanceBanner);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan, { once: true });
  } else {
    scan();
  }
})();
