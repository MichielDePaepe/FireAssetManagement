# QR scanner dependency

`@zxing/browser` provides the browser camera reader used by the reusable pager scan control. The built-in `BarcodeDetector` API is not available consistently across target browsers, so ZXing supplies the camera decoding path while the backend remains responsible for scan lookup and AZERTY/QWERTY alternatives.

The project currently allows `@zxing/browser` `^0.1.5` (MIT). It is only loaded by the frontend camera scanner. Keyboard-wedge scanning does not need this package.

Camera access requires a secure browser context, usually HTTPS or `localhost`. The current HTTP LAN deployment therefore supports keyboard-wedge scanning; mobile camera scanning requires a trusted HTTPS origin. No certificate or hosting changes are part of the scanner feature.
