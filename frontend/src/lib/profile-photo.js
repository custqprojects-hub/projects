const PROFILE_PHOTO_MAX_SIZE = 5 * 1024 * 1024;
const PROFILE_PHOTO_MAX_DIMENSION = 512;
const PROFILE_PHOTO_QUALITY = 0.86;

export function readProfilePhotoAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select an image file."));
      return;
    }

    if (file.size > PROFILE_PHOTO_MAX_SIZE) {
      reject(new Error("Profile photo must be 5MB or smaller."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load image file."));
      image.onload = () => {
        const scale = Math.min(1, PROFILE_PHOTO_MAX_DIMENSION / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process image file."));
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", PROFILE_PHOTO_QUALITY));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
