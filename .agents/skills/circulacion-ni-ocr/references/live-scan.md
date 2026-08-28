# Live scan (Amazon / Stripe pattern)

## What Amazon does

The camera stays open. A rectangle tells you where to put the card. Frames are scored on-device. When the card fills the box and text is sharp, the app captures by itself. No shutter.

Same idea here. A circulation card is a plastic/paper document, not a QR. Do not wait for a barcode.

## Why not send every frame to the model

Cost, latency, and rate limits. 5 fps × Gemini = unusable on the shop floor.

Local scoring is cheap. Vision runs once.

## Suggested loop

```
rAF or setInterval 200 ms
  draw guide crop to 320px canvas
  sharpness = gray laplacian variance
  glare = pct luma > 245
  fill = edge density near guide
  ok = sharpness > T1 && glare < 0.08 && fill > 0.55
  if ok streak >= 3
     pick sharpest of the streak
     stop scoring
     jpeg grab from full video
     POST v2
```

Reset streak if the clerk pulls the card away.

## Camera constraints

```js
{
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
}
```

Do not request 4K.

## Overlay copy

- Searching. `Pon la tarjeta dentro del recuadro`
- Almost. `Un poco mas cerca`
- Glare. `Inclina para quitar el brillo`
- Locking. `No te muevas`
- Sent. `Leyendo…`

## Permissions

- Secure context only.
- If denied, skip to file picker. Do not loop a broken getUserMedia.
- LAN tablets use `https://<ip>:3443` as already documented.

## Manual shutter

Keep one ghost button after 4 s without lock. Accessibility + dark workshops.

## Failures

Two auto-captures with empty plate and empty VIN → stop auto, ask file upload, toast `Usa otra luz o quita el forro plastico`.
