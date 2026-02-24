import mongoose, { Schema, Document } from 'mongoose';

// File schema
export interface IFile extends Document {
    name: string;
    size: number;
    mimetype: string;
    slug: string;
    uploader_ip: string;
    telegram_file_id: string;
    telegram_message_id: string;
    download_count: number;
    expiry_at?: Date;
    created_at: Date;
}

const fileSchema = new Schema<IFile>({
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mimetype: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    uploader_ip: { type: String, required: true },
    telegram_file_id: { type: String, required: true },
    telegram_message_id: { type: String, required: true },
    download_count: { type: Number, default: 0 },
    expiry_at: { type: Date },
    created_at: { type: Date, default: Date.now },
});

export const File = mongoose.model<IFile>('File', fileSchema);

// User schema - uses Telegram ID for authentication
export interface IUser {
    _id: string;
    telegram_id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    channel_id?: number;     // User's personal VoidBox Drive channel
    created_at: Date;
}

const userSchema = new Schema<IUser>({
    _id: { type: String, required: true },
    telegram_id: { type: Number, required: true, unique: true },
    first_name: { type: String, required: true },
    last_name: { type: String },
    username: { type: String },
    photo_url: { type: String },
    channel_id: { type: Number },
    created_at: { type: Date, default: Date.now },
}, { _id: false });

export const User = mongoose.model<IUser>('User', userSchema);

// AbuseFlag schema
export interface IAbuseFlag extends Document {
    file_id: mongoose.Types.ObjectId;
    reason: string;
    ip: string;
    flagged_at: Date;
}

const abuseFlagSchema = new Schema<IAbuseFlag>({
    file_id: { type: Schema.Types.ObjectId, ref: 'File' },
    reason: { type: String, required: true },
    ip: { type: String, required: true },
    flagged_at: { type: Date, default: Date.now },
});

export const AbuseFlag = mongoose.model<IAbuseFlag>('AbuseFlag', abuseFlagSchema);

// UserFile schema - uses string user_id to support Telegram user IDs
export interface IUserFile extends Document {
    user_id: string;
    name: string;
    slug: string;
    mimetype: string;
    size: number;
    created_at: Date;
    notes?: string;
    type: string;
}

const userFileSchema = new Schema<IUserFile>({
    user_id: { type: String, ref: 'User', required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    created_at: { type: Date, default: Date.now },
    notes: { type: String },
    type: { type: String, default: 'file' },
});

export const UserFile = mongoose.model<IUserFile>('UserFile', userFileSchema);
