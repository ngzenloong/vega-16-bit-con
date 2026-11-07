# Pixel asset tools

The application uses the checked-in SVGs. These offline authoring tools are not part of the browser bundle. Run them from the repository with Node22+, Python3 and the installed sharp dependency.

To regenerate the complete set, run in order:

```sh
python3 tools/art/build-rival-cars.py
node tools/art/generate-car-profiles.mjs
node tools/art/build-car-turns.cjs
node tools/art/build-companions.cjs
node tools/art/check-rival-cars.cjs
```

`build-car-turns.cjs --preview` validates and renders candidate turns without replacing public sheets. `metadata/` contains reproducible geometry, source references and label positions. Generated contact images there are ignored. `rear-canonicals.json` retains the exact approved straight groups; turning poses preserve their lettering and shared ground anchor. S-Cargo alone uses the requested marine blue and tea plate. The runtime hitboxes use straight body widths; side profiles are for inspection and turn construction.
