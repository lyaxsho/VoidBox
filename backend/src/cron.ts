import { File, UserFile } from './models.js';

export async function cleanupExpiredFiles() {
  const expiredFiles = await File.find({
    expiry_at: { $ne: null, $lt: new Date() }
  });

  for (const file of expiredFiles) {
    try {
      await UserFile.deleteMany({ slug: file.slug });
      await File.deleteOne({ _id: file._id });
      console.log(`[cron] cleaned up expired file ${file._id}`);
    } catch (err) {
      console.error(`[cron] failed to cleanup file ${file._id}:`, err);
    }
  }
}