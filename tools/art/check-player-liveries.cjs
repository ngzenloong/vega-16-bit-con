// Validate only the new unlock liveries. Original campaign and rival art has its own validator.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'metadata/car-turn-metadata.json')));
(async () => {
  let frames = 0;
  for (const car of meta.filter(car => !['fiat-player', 'scargo'].includes(car.id))) {
    const svg = fs.readFileSync(path.join(root, 'public/assets/vega', car.file.replace('.svg', '-player.svg')));
    assert.equal((svg.toString().match(/data-player-badge=/g) || []).length, 3);
    assert(!/PostSIEM|"rearLettering":"SIEM"/.test(svg.toString()));
    const native = await sharp(svg).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    assert.equal(native.info.width, 288);
    assert.equal(native.info.height, 96);
    const double = await sharp(svg, {density:144}).ensureAlpha().raw().toBuffer();
    const nearest = await sharp(native.data, {raw:native.info}).resize(576,192,{kernel:'nearest'}).raw().toBuffer();
    assert(double.equals(nearest), `${car.id}: player badge must remain on the native pixel grid`);
    frames += 3;
  }
  console.log(`Validated 10 player liveries / ${frames} poses. Official daisy sampled at native resolution.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
