import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.S3_BUCKET_NAME || 'cinematic-movie-thumbnails';

// Initialize S3 client. It will automatically load credentials from standard environment variables or ~/.aws/credentials
let s3Client: S3Client | null = null;

try {
  s3Client = new S3Client({ region });
} catch (err) {
  console.warn('Could not initialize S3 Client. Local uploads will be used as fallback.', err);
}

export async function uploadToS3(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ url: string; key: string }> {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `thumbnails/${Date.now()}-${sanitizedFileName}`;
  
  if (s3Client && process.env.S3_BUCKET_NAME) {
    try {
      console.log(`Uploading file ${sanitizedFileName} to S3 bucket ${bucketName}...`);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: mimeType,
        })
      );
      
      // Auto-generated S3 URL
      const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
      console.log('Upload to S3 successful. URL:', url);
      return { url, key };
    } catch (err) {
      console.error('Failed to upload to S3, falling back to local storage:', err);
    }
  } else {
    console.warn('S3_BUCKET_NAME environment variable is not defined in .env. Using local storage for uploads.');
  }

  // Fallback to local file storage: save to public/uploads directory in root
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const localFileName = `${Date.now()}-${sanitizedFileName}`;
  const localFilePath = path.join(uploadDir, localFileName);
  fs.writeFileSync(localFilePath, fileBuffer);

  // Return local URL served by Express
  const url = `/uploads/${localFileName}`;
  console.log('Saved file locally. URL:', url);
  return { url, key: `local:${localFileName}` };
}

export async function deleteFromS3(key: string): Promise<void> {
  if (key.startsWith('local:')) {
    const fileName = key.replace('local:', '');
    const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted local file: ${filePath}`);
      }
    } catch (err) {
      console.error(`Failed to delete local file ${filePath}:`, err);
    }
    return;
  }

  if (s3Client && process.env.S3_BUCKET_NAME) {
    try {
      console.log(`Deleting file from S3: ${key}...`);
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );
      console.log('Deleted file from S3 successfully.');
    } catch (err) {
      console.error(`Failed to delete file from S3 (${key}):`, err);
    }
  }
}
