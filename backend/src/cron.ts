import { File, UserFile } from './models.js';
import { connectDB } from './db.js';

// Cleanup expired files from the database
// Note: files remain in user's Telegram channel (user can delete manually)
async function cleanupExpiredFiles() {
  await connectDB();

  const expiredFiles = await File.find({
    expiry_at: { $ne: null, $lt: new Date() }
  });

  for (const file of expiredFiles) {
    try {
      // Remove from database (file stays in user's Telegram channel)
      await UserFile.deleteMany({ slug: file.slug });
      await File.deleteOne({ _id: file._id });
      console.log(`Cleaned up expired file ${file._id}`);
    } catch (err) {
      console.error(`Failed to cleanup file ${file._id}:`, err);
    }
  }
}

cleanupExpiredFiles().then(() => process.exit(0));