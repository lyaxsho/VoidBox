import mongoose from 'mongoose';

export async function connectDB() {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    throw new Error('Missing MONGODB_URL environment variable');
  }

  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  // Ensure all model indexes match the schema definitions.
  // Critical: telegram_id must be sparse+unique so that unlinking (unsetting the field)
  // doesn't cause a duplicate-null conflict with other users who have no telegram_id.
  const { User } = await import('./models.js');
  await User.syncIndexes();
}

export { mongoose };