"use strict";

// Synthetic 1x1 image fixtures for isolated Satellite integration testing.
// These are not real supplier tiles and do not establish production policy.
// Exact bytes match independently created Pillow fixtures already validated
// by tests/v370-satellite-raster-validation.test.ts.
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQ8KsDAAFmAOVTZ6irAAAAAElFTkSuQmCC";
const JPEG_BASE64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgFBgcGBQgHBgcJCAgJDBMMDAsLDBgREg4THBgdHRsYGxofIywlHyEqIRobJjQnKi4vMTIxHiU2OjYwOiwwMTD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAABP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AO//Z";
module.exports = Object.freeze({
  png: () => Buffer.from(PNG_BASE64, "base64"),
  jpeg: () => Buffer.from(JPEG_BASE64, "base64"),
});
