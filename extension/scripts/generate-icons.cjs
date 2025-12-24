#!/usr/bin/env node
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const svgPath = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  console.log('🎨 Generating PNG icons from SVG...\n');

  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon${size}.png`);
    
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      const stats = fs.statSync(outputPath);
      console.log(`✅ icon${size}.png created (${stats.size} bytes)`);
    } catch (error) {
      console.error(`❌ Failed to create icon${size}.png:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(error => {
  console.error('❌ Icon generation failed:', error);
  process.exit(1);
});
