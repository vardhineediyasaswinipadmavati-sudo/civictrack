import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { Readable } from 'node:stream';
import path from 'path';
import fs from 'fs';

dotenv.config();

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

/**
 * Upload an image buffer to Cloudinary or fallback to local disk in dev mode.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} originalName - Original filename for extension and naming
 * @param {string} folder - Cloudinary folder (default: 'civictrack')
 * @returns {Promise<{ url: string, provider: 'cloudinary' | 'local', public_id?: string }>}
 */
export async function uploadImageToStorage(buffer, originalName, folder = 'civictrack') {
  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error.message || error);
            return reject(new Error(`Cloud storage upload failed: ${error.message || 'Unknown provider error'}`));
          }
          if (!result || !result.secure_url) {
            return reject(new Error('Cloud storage provider did not return a valid HTTPS URL.'));
          }
          resolve({
            url: result.secure_url,
            provider: 'cloudinary',
            public_id: result.public_id
          });
        }
      );

      // Stream the memory buffer to Cloudinary
      const readableStream = Readable.from(buffer);
      readableStream.pipe(uploadStream);
    });
  }

  // If Cloudinary is not configured:
  // In production, strictly reject since ephemeral storage will lose images on container restart
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Permanent cloud image storage is not configured. Please define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your server environment variables.'
    );
  }

  // Development/Test fallback: Save to server/src/uploads
  console.warn('ℹ Cloudinary credentials not configured. Falling back to local disk storage for development.');
  const uploadDir = path.resolve(process.cwd(), 'server/src/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const filename = `civic-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filepath = path.join(uploadDir, filename);

  fs.writeFileSync(filepath, buffer);

  return {
    url: `/uploads/${filename}`,
    provider: 'local'
  };
}

export function getStorageStatus() {
  return {
    isConfigured: isCloudinaryConfigured,
    provider: isCloudinaryConfigured ? 'cloudinary' : 'local_fallback',
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ? `${process.env.CLOUDINARY_CLOUD_NAME.slice(0, 3)}***` : null
  };
}

export default {
  uploadImageToStorage,
  getStorageStatus
};
