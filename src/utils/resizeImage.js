/**
 * Resizes an image File to fit within maxWidth × maxHeight while preserving
 * aspect ratio. Returns a new File at the same MIME type.
 *
 * SVG files are returned unchanged — they're already resolution-independent.
 * If the image is already smaller than the target, it's returned as-is.
 *
 * @param {File}   file       - The original image file
 * @param {number} maxWidth   - Maximum output width in px  (default 400)
 * @param {number} maxHeight  - Maximum output height in px (default 400)
 * @param {number} quality    - JPEG/WebP compression 0–1   (default 0.88)
 * @returns {Promise<File>}
 */
export function resizeImage(file, maxWidth = 400, maxHeight = 400, quality = 0.88) {
  // SVG is vector — skip canvas entirely
  if (file.type === 'image/svg+xml') return Promise.resolve(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Only scale down, never up
      if (width <= maxWidth && height <= maxHeight) {
        resolve(file);
        return;
      }

      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width  = Math.round(width  * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // PNG stays PNG (preserves transparency); everything else → JPEG
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Image resize failed.')); return; }
          resolve(new File([blob], file.name, { type: outputType }));
        },
        outputType,
        outputType === 'image/jpeg' ? quality : undefined,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image for resizing.'));
    };

    img.src = objectUrl;
  });
}
