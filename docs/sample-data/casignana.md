# Roman Villa of Casignana sample dataset

The first working 3D dataset supplied for Archeology Notes is a textured photogrammetry model of a room from the Roman Villa of Casignana.

Supplied archive contents:

- `casignana2.obj`
- `casignana.jpg`

Observed source characteristics from the previous prototype analysis:

- approximately 244,639 vertices
- approximately 486,261 triangular faces
- 8000 × 8000 RGB texture
- approximate source extent 21.21 × 14.95 × 6.40 model units

The archive did not include explicit coordinate-reference or acquisition metadata.

The earlier Hupla mockup used a 3,000-vertex texture-coloured sample for fast interaction. That derivative is intentionally not considered adequate for professional inspection.

Planned standalone path:

1. retain the supplied OBJ and texture as source assets
2. create an efficient textured photographic web representation
3. use that photographic representation as the default 3D mode
4. add a denser point representation and proper point-cloud ingestion later
5. preserve source-to-derivative provenance throughout
