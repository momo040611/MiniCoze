import { useEffect, useState, type ReactNode } from 'react';
import { getFileObjectUrl } from '../../../api/files';

interface Props {
  fileId: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}

export function PrivateFileImage({ fileId, alt, className, fallback = null }: Props) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    setFailed(false);

    void getFileObjectUrl(fileId)
      .then((nextUrl) => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (failed) return fallback;
  return url ? <img src={url} alt={alt} className={className} /> : null;
}
