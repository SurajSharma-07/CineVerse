/**
 * Compresses an image file in the browser using HTML5 Canvas
 * and converts it to a compact Base64 data URL.
 * 
 * @param file The image File object from input or drop
 * @param maxWidth The maximum width constraint
 * @param maxHeight The maximum height constraint
 * @param quality The JPEG compression quality (0.0 to 1.0)
 * @returns Promise resolving to the compressed Base64 data URL string
 */
export function compressImageToBase64(
  file: File,
  maxWidth = 800,
  maxHeight = 600,
  quality = 0.6
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate constrained dimensions keeping aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas 2d context for image compression.'));
          return;
        }

        // Draw image onto canvas with new dimensions
        ctx.drawImage(img, 0, 0, width, height);

        // Convert the canvas to a compressed JPEG Base64 data URL
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => {
        reject(err);
      };
    };
    reader.onerror = (err) => {
      reject(err);
    };
  });
}
