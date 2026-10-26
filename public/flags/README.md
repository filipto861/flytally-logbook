# FlyTally self-hosted airport country flags

This bitmap atlas supports the **Flights list only**. It is rendered from MIT-licensed 4:3 SVGs in [flag-icons](https://github.com/lipis/flag-icons), pinned at tag **v7.6.0**, source commit `0d8909b00aa8418802a5abf2afa82356b129a7ef`. The upstream MIT license and copyright notice are retained in `LICENSE.flag-icons.txt`.

`iso-atlas.png`: **936 × 702** pixels, **256** country/two-character territory codes, 26 columns indexed by the **second** uppercase letter and 26 rows by the **first**; one tile is 36 × 27 physical pixels and 18 × 13.5 CSS pixels (2×). Atlas SHA-256: `656a18eb2d3a632d176d4e34e5979bd24d425cb4187562a17c2451c837f7410a`. Each tile was rasterized from the same-named upstream 4:3 SVG (36 × 27 pixels) then composed into one PNG with transparent unused cells. No new application dependency or third-party browser network request.

The Flights list uses only `getCatalogAirport(ident)?.country` from the existing airport catalog; unrecognized/unsupported, `XX`, and `ZZ` produce **no** icon. A country flag is **decorative**, not a regulatory or geographic inference from ICAO prefixes. If the atlas is updated, verify code coverage, licensing, browser rendering, metadata size, and SHA-bound tests first.
