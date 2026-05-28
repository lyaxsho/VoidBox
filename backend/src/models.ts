import mongoose, { Schema, Document } from 'mongoose';

export type StorageMode = 'secure' | 'standard';

export interface IFile extends Document {
    name: string;
    size: number;
    mimetype: string;
    slug: string;
    uploader_ip: string;
    telegram_file_id: string;
    telegram_message_id: string;
    storage_mode: StorageMode;
    is_chunked: boolean;
    total_chunks?: number;
    download_count: number;
    expiry_at?: Date;
    link_accessed_at?: Date;
    created_at: Date;
}

const fileSchema = new Schema<IFile>({
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mimetype: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    uploader_ip: { type: String, required: true },
    telegram_file_id: { type: String, default: '' },
    telegram_message_id: { type: String, default: '' },
    storage_mode: { type: String, enum: ['secure', 'standard'], default: 'standard' },
    is_chunked: { type: Boolean, default: false },
    total_chunks: { type: Number },
    download_count: { type: Number, default: 0 },
    expiry_at: { type: Date },
    link_accessed_at: { type: Date },
    created_at: { type: Date, default: Date.now },
});

export const File = mongoose.model<IFile>('File', fileSchema);

export interface IUser {
    _id: string;
    email?: string;
    password_hash?: string;
    email_verified: boolean;
    email_verify_token?: string;
    magic_link_token?: string;
    magic_link_expires_at?: Date;
    secure_upload_enabled: boolean;
    is_admin?: boolean;
    telegram_id?: number;
    telegram_session?: string;  // MTProto session string — persisted so re-login preserves secure upload
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    channel_id?: number;
    created_at: Date;
}

const userSchema = new Schema<IUser>({
    _id: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password_hash: { type: String },
    email_verified: { type: Boolean, default: false },
    email_verify_token: { type: String },
    magic_link_token: { type: String, index: true, sparse: true },
    magic_link_expires_at: { type: Date },
    secure_upload_enabled: { type: Boolean, default: false },
    is_admin: { type: Boolean, default: false },
    telegram_id: { type: Number, unique: true, sparse: true },
    telegram_session: { type: String },
    first_name: { type: String, required: true },
    last_name: { type: String },
    username: { type: String },
    photo_url: { type: String },
    channel_id: { type: Number },
    created_at: { type: Date, default: Date.now },
}, { _id: false });

export const User = mongoose.model<IUser>('User', userSchema);

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

export interface IUserFile extends Document {
    user_id: string;
    name: string;
    slug: string;
    mimetype: string;
    size: number;
    storage_mode: StorageMode;
    created_at: Date;
    notes?: string;
    type: string;
    thumbnail?: string;
}

const userFileSchema = new Schema<IUserFile>({
    user_id: { type: String, ref: 'User', required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    storage_mode: { type: String, enum: ['secure', 'standard'], default: 'standard' },
    created_at: { type: Date, default: Date.now },
    notes: { type: String },
    type: { type: String, default: 'file' },
    thumbnail: { type: String },
});

userFileSchema.index({ user_id: 1, created_at: -1 });
export const UserFile = mongoose.model<IUserFile>('UserFile', userFileSchema);

export interface IFileChunk extends Document {
    file_slug: string;
    chunk_index: number;
    telegram_file_id: string;
    telegram_message_id: string;
    size: number;
}

const fileChunkSchema = new Schema<IFileChunk>({
    file_slug: { type: String, required: true, index: true },
    chunk_index: { type: Number, required: true },
    telegram_file_id: { type: String, required: true },
    telegram_message_id: { type: String, required: true },
    size: { type: Number, required: true },
});
fileChunkSchema.index({ file_slug: 1, chunk_index: 1 }, { unique: true });

export const FileChunk = mongoose.model<IFileChunk>('FileChunk', fileChunkSchema);
