/** RGB color used by the raster renderer */
@genType
type color = (int, int, int)

/** Opaque mutable RGB raster */
@genType
type raster

/** Creates a filled RGB raster */
@genType
let createRaster: (int, int, color) => raster

/** Fills a clipped rectangle */
@genType
let fillRect: (raster, int, int, int, int, color) => unit

/** Draws a rectangular outline */
@genType
let strokeRect: (raster, int, int, int, int, color, int) => unit

/** Draws uppercase bitmap text */
@genType
let drawText: (raster, int, int, string, int, color) => unit

/** Draws right-aligned uppercase bitmap text */
@genType
let drawRightText: (raster, int, int, string, int, color) => unit

/** Encodes the raster as an RGB PNG */
@genType
let encodePng: raster => promise<Uint8Array.t>
