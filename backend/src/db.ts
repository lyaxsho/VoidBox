import mongoose from 'mongoose';

export async function connectDB() {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    throw new Error('Missing MONGODB_URL environment variable');
  }

  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');
}

export { mongoose };