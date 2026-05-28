import { useState } from 'react';
import { FileItem } from '../types';
import { BASE_URL } from '../lib/api';

export function useUserFiles() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const setUserFiles = (newFiles: FileItem[]) => {
    setFiles(newFiles);
  };

  const fetchUserFiles = async (_user_id: string) => {
    const token = localStorage.getItem('voidbox_token');
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/mydrops`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch user files');
      const data = await res.json();
      setFiles(data.files || []);
      return data.files || [];
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  return { files, setUserFiles, fetchUserFiles, loading, hasFetched };
}