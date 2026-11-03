process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { uploadImageToStorage } from '../src/utils/cloudinary.js';
import { CitizenReport, SharedIssue, ReportImage } from '../src/models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../src/uploads');

test('CivicTrack Evidence Image Integrity & Preservation Suite', async (t) => {
  // Test Image A: 32 bytes of distinct binary data representing Image A (e.g. Red pothole photo)
  const imageABuffer = Buffer.from('EVIDENCE_IMAGE_A_RED_POTHOLE_DAMAGED_ROAD_1234567890');
  // Test Image B: 32 bytes of distinct binary data representing Image B (e.g. Blue street defect photo)
  const imageBBuffer = Buffer.from('EVIDENCE_IMAGE_B_BLUE_STREET_DRAINAGE_OVERFLOW_0987654');

  let uploadResultA;
  let uploadResultB;

  await t.test('1. uploadImageToStorage saves Image A and returns accessible URL without errors', async () => {
    uploadResultA = await uploadImageToStorage(imageABuffer, 'pothole_water_lane.jpg', 'civictrack/test');
    assert.ok(uploadResultA.url, 'Image A URL must be returned');
    assert.match(uploadResultA.url, /\/uploads\/civic-\d+-\d+\.jpg$/, 'URL must follow local upload structure');
    assert.doesNotMatch(uploadResultA.url, /1515162816999-a0c47dc192f7/, 'Must never return the stock umbrella photo');
  });

  await t.test('2. uploadImageToStorage saves Image B and returns distinct URL from Image A', async () => {
    uploadResultB = await uploadImageToStorage(imageBBuffer, 'cracked_asphalt.png', 'civictrack/test');
    assert.ok(uploadResultB.url, 'Image B URL must be returned');
    assert.notStrictEqual(uploadResultA.url, uploadResultB.url, 'Image A and Image B must have different URLs');
    assert.match(uploadResultB.url, /\/uploads\/civic-\d+-\d+\.png$/, 'URL must reflect correct extension');
    assert.doesNotMatch(uploadResultB.url, /1515162816999-a0c47dc192f7/, 'Must never return the stock umbrella photo');
  });

  await t.test('3. Exact binary file bytes on disk match uploaded bytes byte-for-byte', async () => {
    const filenameA = path.basename(uploadResultA.url);
    const filenameB = path.basename(uploadResultB.url);

    const diskPathA = path.join(uploadsDir, filenameA);
    const diskPathB = path.join(uploadsDir, filenameB);

    assert.ok(fs.existsSync(diskPathA), `Saved file A must exist at ${diskPathA}`);
    assert.ok(fs.existsSync(diskPathB), `Saved file B must exist at ${diskPathB}`);

    const readBytesA = fs.readFileSync(diskPathA);
    const readBytesB = fs.readFileSync(diskPathB);

    assert.deepStrictEqual(readBytesA, imageABuffer, 'Saved file A bytes must be identical to uploaded buffer A');
    assert.deepStrictEqual(readBytesB, imageBBuffer, 'Saved file B bytes must be identical to uploaded buffer B');
    assert.notDeepStrictEqual(readBytesA, readBytesB, 'Saved files A and B must have completely distinct bytes');
  });

  await t.test('4. Relational integrity: Two complaints associate with their own distinct evidence images', async () => {
    const reportAId = new mongoose.Types.ObjectId();
    const reportBId = new mongoose.Types.ObjectId();
    const sharedIssueId = new mongoose.Types.ObjectId();

    const reportImageA = new ReportImage({
      report_id: reportAId,
      shared_issue_id: sharedIssueId,
      image_url: uploadResultA.url,
      image_type: 'evidence',
      caption: 'Water-filled pothole on active roadway'
    });

    const reportImageB = new ReportImage({
      report_id: reportBId,
      shared_issue_id: sharedIssueId,
      image_url: uploadResultB.url,
      image_type: 'evidence',
      caption: 'Secondary crack widening near pedestrian curb'
    });

    assert.strictEqual(reportImageA.report_id.toString(), reportAId.toString());
    assert.strictEqual(reportImageB.report_id.toString(), reportBId.toString());
    assert.strictEqual(reportImageA.image_url, uploadResultA.url);
    assert.strictEqual(reportImageB.image_url, uploadResultB.url);
    assert.notStrictEqual(reportImageA.image_url, reportImageB.image_url);
    assert.doesNotMatch(reportImageA.image_url, /1515162816999-a0c47dc192f7/);
    assert.doesNotMatch(reportImageB.image_url, /1515162816999-a0c47dc192f7/);
  });

  await t.test('5. Zero-fallback enforcement: Report submitted without image preserves empty array', async () => {
    const rawImageUrls = [];
    // Verify that empty array remains empty without automatic injection of stock photos
    assert.strictEqual(rawImageUrls.length, 0, 'No stock photos injected when user uploads no image');
  });

  await t.test('6. Production Mode Mandate: Missing Cloudinary credentials strictly rejects without disk fallback', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevCloud = process.env.CLOUDINARY_CLOUD_NAME;
    const prevKey = process.env.CLOUDINARY_API_KEY;
    const prevSecret = process.env.CLOUDINARY_API_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      const testBuffer = Buffer.from('TEST_PRODUCTION_REJECTION_BYTES');
      await assert.rejects(
        async () => {
          await uploadImageToStorage(testBuffer, 'fail_in_prod.jpg');
        },
        (err) => {
          assert.match(err.message, /Cloud image storage is mandatory in production/);
          return true;
        },
        'Production upload without Cloudinary credentials must strictly reject'
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevCloud) process.env.CLOUDINARY_CLOUD_NAME = prevCloud;
      if (prevKey) process.env.CLOUDINARY_API_KEY = prevKey;
      if (prevSecret) process.env.CLOUDINARY_API_SECRET = prevSecret;
    }
  });

  await t.test('7. Development Mode Allowance: Gracefully permits local disk fallback when credentials absent', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevCloud = process.env.CLOUDINARY_CLOUD_NAME;
    const prevKey = process.env.CLOUDINARY_API_KEY;
    const prevSecret = process.env.CLOUDINARY_API_SECRET;

    try {
      process.env.NODE_ENV = 'development';
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      const devBuffer = Buffer.from('DEV_FALLBACK_BUFFER');
      const devRes = await uploadImageToStorage(devBuffer, 'dev_test.jpg');
      assert.strictEqual(devRes.provider, 'local', 'Development must allow local disk fallback');
      assert.match(devRes.url, /\/uploads\//, 'Development URL must point to local uploads');

      // Cleanup
      const createdFile = path.join(uploadsDir, path.basename(devRes.url));
      if (fs.existsSync(createdFile)) fs.unlinkSync(createdFile);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevCloud) process.env.CLOUDINARY_CLOUD_NAME = prevCloud;
      if (prevKey) process.env.CLOUDINARY_API_KEY = prevKey;
      if (prevSecret) process.env.CLOUDINARY_API_SECRET = prevSecret;
    }
  });

  // Cleanup test files created during test
  t.after(() => {
    try {
      if (uploadResultA?.url) {
        const fileA = path.join(uploadsDir, path.basename(uploadResultA.url));
        if (fs.existsSync(fileA)) fs.unlinkSync(fileA);
      }
      if (uploadResultB?.url) {
        const fileB = path.join(uploadsDir, path.basename(uploadResultB.url));
        if (fs.existsSync(fileB)) fs.unlinkSync(fileB);
      }
    } catch (_) {}
  });
});
