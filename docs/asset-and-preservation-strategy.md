# Asset and preservation strategy

## Rule

Preservation source and working derivative are different assets.

Do not optimise an original in place.

## Example: Casignana

```text
source
  casignana2.obj
  casignana.jpg
      │
      ├── photographic web GLB
      ├── texture-compressed derivative
      ├── point representation
      └── later analysis derivatives
```

## Proposed private R2 structure

```text
projects/{project-id}/
  sites/{site-id}/
    assets/{asset-id}/
      original/
      derivatives/
    records/{record-id}/
      original/
      derivatives/
```

The database, not the path alone, remains the authoritative metadata and relationship layer.

## Integrity

Store at least:

- original filename
- MIME type / declared format
- byte size
- checksum
- upload/acquisition metadata where known
- R2 object key
- derivative relationship

## Image processing

An inverted, contrast-enhanced, filtered or AI-processed image remains a derivative of one source photograph. The application should always make the source accessible to authorised users.

## Voice transcription

The original audio is the evidence. The transcript is a derived text representation that may be corrected without replacing the audio.

## 3D/point-cloud conversion

Original OBJ/E57/LAS/LAZ/COPC files should be retained when licensing and storage policy permit. Browser derivatives should be generated separately and should record the conversion pipeline/version.
