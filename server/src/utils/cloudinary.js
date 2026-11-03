import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { Readable } from 'node:stream';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

function checkCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

if (checkCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

/**
 * Persist image buffer directly to the local static uploads directory.
 * Allowed ONLY during local development/testing.
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename for extension extraction
 * @returns {{ url: string, provider: 'local', filename: string }}
 */
function saveToLocalStorage(buffer, originalName) {
  // Always resolve to server/src/uploads relative to this module directory
  const uploadDir = path.resolve(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const filename = `civic-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filepath = path.join(uploadDir, filename);

  fs.writeFileSync(filepath, buffer);

  return {
    url: `/uploads/${filename}`,
    provider: 'local',
    filename
  };
}

/**
 * Upload an image buffer to Cloudinary or fallback to local disk storage in development.
 * In production, Cloudinary is strictly mandatory; failures reject with clear errors without disk fallback.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} originalName - Original filename for extension and naming
 * @param {string} folder - Cloudinary folder (default: 'civictrack')
 * @returns {Promise<{ url: string, provider: 'cloudinary' | 'local', public_id?: string }>}
 */
export async function uploadImageToStorage(buffer, originalName, folder = 'civictrack') {
  const isProduction = process.env.NODE_ENV === 'production';
  const isConfigured = checkCloudinaryConfigured();

  if (isConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }

  // 1. PRODUCTION ENVIRONMENT: Cloudinary is strictly mandatory
  if (isProduction) {
    if (!isConfigured) {
      throw new Error(
        'Cloud image storage is mandatory in production, but Cloudinary credentials are not configured. Please define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your server environment variables.'
      );
    }

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
            console.error('Cloudinary upload error in production:', error.message || error);
            return reject(
              new Error(`Cloud image storage upload failed: ${error.message || 'Unknown provider error'}. Please verify Cloudinary credentials and connectivity.`)
            );
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

      const readableStream = Readable.from(buffer);
      readableStream.pipe(uploadStream);
    });
  }

  // 2. LOCAL DEVELOPMENT / TEST ENVIRONMENT:
  if (isConfigured) {
    try {
      return await new Promise((resolve, reject) => {
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
              console.warn('Cloudinary upload error in development, falling back to local disk:', error.message || error);
              return reject(error);
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

        const readableStream = Readable.from(buffer);
        readableStream.pipe(uploadStream);
      });
    } catch (err) {
      console.warn('ℹ Cloudinary upload failed in development. Falling back to local disk storage:', err.message || err);
      return saveToLocalStorage(buffer, originalName);
    }
  }

  // Cloudinary credentials not configured in local development: Fall back to local disk storage
  console.warn('ℹ Cloudinary credentials not configured. Falling back to local disk storage for development.');
  return saveToLocalStorage(buffer, originalName);
}

export function getStorageStatus() {
  const isConfigured = checkCloudinaryConfigured();
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    isConfigured,
    provider: isConfigured ? 'cloudinary' : (isProduction ? 'unconfigured_production' : 'local_fallback'),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ? `${process.env.CLOUDINARY_CLOUD_NAME.slice(0, 3)}***` : null
  };
}

export default {
  uploadImageToStorage,
  getStorageStatus
};
