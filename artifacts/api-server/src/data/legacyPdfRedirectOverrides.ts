const masterCatalogUrl =
  "https://wefixitusa.com/wp-content/uploads/2023/04/WindowDoorHardwareParts-PDF-Catalog.pdf";

export const legacyPdfRedirectOverrides: Readonly<Record<string, string>> = {
  "2023/03/AllWindowDoorParts-PDF-Catalog.pdf": masterCatalogUrl,
  "2023/04/AllBrandWindowDoorParts-PDF-Catalog.pdf": masterCatalogUrl,
  "2023/04/BiltBestWindowParts-PDF-Catalog.pdf": masterCatalogUrl,
  "2023/04/WindowDoorHardwareParts-PDF-Catalog.pdf": masterCatalogUrl,
  "2023/05/AllWindowDoorParts-PDF-Catalog.pdf": masterCatalogUrl,
  "2022/09/How-To-Measure-BiltBest-Casement-Sash-Frame-With-Glass.pdf":
    "https://truthentrygard.com/wp-content/uploads/2022/08/How-To-Measure-BiltBest-Casement-Sash-Frame-With-Glass.pdf",
};
