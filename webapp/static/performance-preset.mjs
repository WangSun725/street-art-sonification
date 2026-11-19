import { artworkPanelJoins } from "./scan-path.mjs?v=panel-seams1";

const FORMAT = "street-art-sonification";
export const MAX_PRESET_BYTES = 100 * 1024 * 1024;
const MAX_REGION_MASKS = 15;
const IMAGE_DATA = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function requireImage(value) {
  if (typeof value !== "string" || !IMAGE_DATA.test(value)) {
    throw new Error("The preset is missing an embedded artwork image or region mask.");
  }
  return value;
}

async function embedImage(url) {
  if (url.startsWith("data:")) return requireImage(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error("An artwork image or region mask could not be saved.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("An artwork image or region mask could not be read."));
    reader.readAsDataURL(blob);
  }).then(requireImage);
}

export async function packPreset(manifest, name, settings) {
  const [image, regions] = await Promise.all([
    embedImage(manifest.image_url),
    Promise.all(manifest.regions.slice(0, MAX_REGION_MASKS).map(async region => {
      const [visual, hit] = await Promise.all([embedImage(region.visual_mask_url), embedImage(region.hit_mask_url)]);
      return {
        id: region.id, label: region.label, type: region.type, index: region.index,
        type_label: region.type_label, default_instrument: region.default_instrument,
        category_source: region.category_source,
        color_rgb: region.color_rgb, area_ratio: region.area_ratio,
        fine_detail: Boolean(region.fine_detail), palette_band: Boolean(region.palette_band),
        meaning: region.meaning, sam_scores: region.sam_scores, visual, hit,
      };
    })),
  ]);
  return {
    format: FORMAT, version: 1, name,
    artwork: {
      image, regions,
      regionTaxonomy: manifest.region_taxonomy,
      regionLayout: manifest.region_layout,
      scanJoins: artworkPanelJoins(manifest),
      statement: manifest.artist_statement || "",
      statementColors: manifest.statement_colors || [],
    },
    settings,
  };
}

export async function readPreset(file) {
  if (file.size > MAX_PRESET_BYTES) throw new Error("The preset exceeds 100 MB.");
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("This file is not a readable preset.");
  }
  if (data?.format !== FORMAT || data.version !== 1) throw new Error("This preset format is not supported.");
  const artwork = data.artwork;
  if (!Array.isArray(artwork?.regions) || !artwork.regions.length || artwork.regions.length > MAX_REGION_MASKS) {
    throw new Error("The preset has no valid regions.");
  }
  const ids = new Set();
  const regions = artwork.regions.map((region, index) => {
    if (typeof region?.id !== "string" || !region.id || ids.has(region.id)
        || typeof region.label !== "string" || !Array.isArray(region.color_rgb)
        || region.color_rgb.length !== 3 || !region.color_rgb.every(value => Number.isFinite(value))) {
      throw new Error("The preset contains an invalid region.");
    }
    ids.add(region.id);
    return {
      id: region.id, label: region.label.slice(0, 200),
      type: typeof region.type === "string" ? region.type : "detail",
      type_label: typeof region.type_label === "string" ? region.type_label.slice(0, 80) : undefined,
      default_instrument: typeof region.default_instrument === "string" ? region.default_instrument : undefined,
      category_source: typeof region.category_source === "string" ? region.category_source : undefined,
      index: Number.isInteger(region.index) ? region.index : index + 1,
      color_rgb: region.color_rgb.map(value => Math.max(0, Math.min(255, Math.round(value)))),
      area_ratio: Number.isFinite(region.area_ratio) ? Math.max(0, Math.min(1, region.area_ratio)) : .1,
      fine_detail: Boolean(region.fine_detail), palette_band: Boolean(region.palette_band),
      meaning: typeof region.meaning === "string" ? region.meaning : "",
      sam_scores: Array.isArray(region.sam_scores) ? region.sam_scores.filter(Number.isFinite).slice(0, 16) : [],
      visual_mask_url: requireImage(region.visual), hit_mask_url: requireImage(region.hit),
    };
  });
  return {
    name: typeof data.name === "string" && data.name.trim() ? data.name.slice(0, 180) : "Artwork preset",
    manifest: {
      analysis_id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      image_url: requireImage(artwork.image),
      regions,
      region_taxonomy: artwork.regionTaxonomy,
      region_layout: ["by_category", "individual"].includes(artwork.regionLayout) ? artwork.regionLayout : undefined,
      scan_joins: Array.isArray(artwork.scanJoins) ? artwork.scanJoins.filter(Number.isInteger) : [],
      artist_statement: typeof artwork.statement === "string" ? artwork.statement : "",
      statement_colors: Array.isArray(artwork.statementColors) ? artwork.statementColors : [],
    },
    settings: data.settings && typeof data.settings === "object" ? data.settings : {},
  };
}
