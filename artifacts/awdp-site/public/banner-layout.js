(() => {
  "use strict";

  const BANNER_SELECTOR = 'img[src*="/assets/header_bg"]';
  const STYLE_ID = "awdp-responsive-banner-styles";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .awdp-banner-shell {
        width: 100%;
        overflow: hidden;
        background: #d5d5d5;
        line-height: 0;
      }

      .awdp-banner-desktop {
        display: none;
        width: 100%;
        max-width: 1920px;
        margin: 0 auto;
      }

      .awdp-banner-desktop svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .awdp-banner-mobile {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        margin: 0 auto !important;
        object-fit: contain !important;
      }

      @media (min-width: 900px) {
        .awdp-banner-desktop { display: block; }
        .awdp-banner-mobile { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function setImageHref(image, source) {
    image.setAttribute("href", source);
    image.setAttributeNS(XLINK_NS, "xlink:href", source);
  }

  function addCrop(svg, source, frame, crop, transform) {
    const nested = document.createElementNS(SVG_NS, "svg");
    nested.setAttribute("x", String(frame.x));
    nested.setAttribute("y", String(frame.y));
    nested.setAttribute("width", String(frame.width));
    nested.setAttribute("height", String(frame.height));
    nested.setAttribute("viewBox", `${crop.x} ${crop.y} ${crop.width} ${crop.height}`);
    nested.setAttribute("preserveAspectRatio", "none");
    nested.setAttribute("overflow", "hidden");

    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", "1352");
    image.setAttribute("height", "551");
    image.setAttribute("preserveAspectRatio", "none");
    if (transform) image.setAttribute("transform", transform);
    setImageHref(image, source);

    nested.appendChild(image);
    svg.appendChild(nested);
  }

  function buildDesktopBanner(source) {
    const wrapper = document.createElement("div");
    wrapper.className = "awdp-banner-desktop";
    wrapper.setAttribute("aria-hidden", "true");

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 1920 430");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("focusable", "false");

    const background = document.createElementNS(SVG_NS, "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", "1920");
    background.setAttribute("height", "430");
    background.setAttribute("fill", "#d5d5d5");
    svg.appendChild(background);

    // Keep the approved artwork at its natural proportions. The center carries
    // the full headline, while mirrored edge slices extend the flag to full width.
    addCrop(
      svg,
      source,
      { x: 0, y: 0, width: 284, height: 300 },
      { x: 0, y: 0, width: 284, height: 300 },
      "translate(284 0) scale(-1 1)"
    );
    addCrop(
      svg,
      source,
      { x: 284, y: 0, width: 1352, height: 300 },
      { x: 0, y: 0, width: 1352, height: 300 }
    );
    addCrop(
      svg,
      source,
      { x: 1636, y: 0, width: 284, height: 300 },
      { x: 0, y: 0, width: 284, height: 300 },
      "translate(1352 0) scale(-1 1)"
    );

    // Move the two lower information blocks directly below the headline so the
    // desktop banner stays shallow without stretching any lettering or logos.
    addCrop(
      svg,
      source,
      { x: 65, y: 285, width: 605, height: 143 },
      { x: 35, y: 332, width: 605, height: 143 }
    );
    addCrop(
      svg,
      source,
      { x: 1385, y: 285, width: 470, height: 143 },
      { x: 858, y: 332, width: 470, height: 143 }
    );

    wrapper.appendChild(svg);
    return wrapper;
  }

  function enhanceBanner(image) {
    const parent = image.parentElement;
    if (!parent) return;

    const source = image.currentSrc || image.src;
    if (!source) return;

    installStyles();
    parent.classList.add("awdp-banner-shell");

    const label = image.getAttribute("alt") || "We Fix It USA — free online parts identification — veteran owned and operated";
    parent.setAttribute("role", "img");
    parent.setAttribute("aria-label", label);

    image.classList.add("awdp-banner-mobile");
    image.setAttribute("alt", "");
    image.setAttribute("aria-hidden", "true");

    const currentDesktop = parent.querySelector(":scope > .awdp-banner-desktop");
    if (!currentDesktop) {
      parent.insertBefore(buildDesktopBanner(source), image);
    }
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
