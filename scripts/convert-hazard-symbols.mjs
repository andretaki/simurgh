import sharp from "sharp";
import { readdir, mkdir } from "fs/promises";
import { join, basename } from "path";

const TIF_FILES = [
  "acid_red.tif",
  "Aquatic-pollut-red.tif",
  "exclam.tif",
  "flamme.tif",
  "rondflam.tif",
  "silhouete.tif",
  "skull.tif",
];

async function convertTifToPng() {
  const publicDir = join(process.cwd(), "public");
  const outputDir = join(publicDir, "hazard-symbols");

  // Create output directory
  try {
    await mkdir(outputDir, { recursive: true });
  } catch (e) {
    // Directory may already exist
  }

  console.log("Converting TIF hazard symbols to PNG...\n");

  for (const tifFile of TIF_FILES) {
    const inputPath = join(publicDir, tifFile);
    const outputName = basename(tifFile, ".tif") + ".png";
    const outputPath = join(outputDir, outputName);

    try {
      await sharp(inputPath)
        .resize(200, 200, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(outputPath);

      console.log(`✓ Converted: ${tifFile} -> hazard-symbols/${outputName}`);
    } catch (error) {
      console.error(`✗ Failed to convert ${tifFile}:`, error.message);
    }
  }

  console.log("\nDone! PNG files are in /public/hazard-symbols/");
}

convertTifToPng();
