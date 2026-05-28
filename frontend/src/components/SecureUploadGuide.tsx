import { Shield, AlertTriangle, Clock, HardDrive } from 'lucide-react';

interface SecureUploadGuideProps {
  secureEnabled: boolean;
}

export default function SecureUploadGuide({ secureEnabled }: SecureUploadGuideProps) {
  if (secureEnabled) {
    return (
      <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-start gap-3">
          <Shield className="text-emerald-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-gray-900 dark:text-white mb-1">Secure Upload is on</p>
            <p>
              Files are stored in your personal Telegram channel (VoidBox Drive). Only you can access
              them through your linked account. Larger files and direct streaming are supported.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-gray-700 dark:text-gray-300">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
        <div className="space-y-2">
          <p className="font-medium text-gray-900 dark:text-white">Standard upload (default)</p>
          <ul className="list-none space-y-1.5 text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <HardDrive size={14} className="mt-1 shrink-0" />
              Files go through VoidBox shared storage — not your personal Telegram.
            </li>
            <li className="flex items-start gap-2">
              <Clock size={14} className="mt-1 shrink-0" />
              Under heavy load, uploads may wait in a queue before processing.
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-1 shrink-0" />
              Upload and download speeds may be slower than Secure Upload.
            </li>
          </ul>
          <p className="text-gray-500 dark:text-gray-500 pt-1">
            Turn on <strong>Secure Upload</strong> and link Telegram for private storage in your own
            channel, with higher size limits.
          </p>
        </div>
      </div>
    </div>
  );
}
