# Outputs Feature Slice

Owns generated output review, packet preview, final packet operations, and output delivery UI.

Modernization targets:

- lazy-load expensive preview surfaces
- keep output review state separate from generation state
- standardize loading, empty, error, and success feedback
- keep DOCX/PDF preview work outside render paths where possible
