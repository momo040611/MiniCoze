import type { ChatAttachment } from '../types';
import { PrivateFileImage } from './PrivateFileImage';

interface Props {
  attachments: ChatAttachment[];
  imageClassName?: string;
  itemClassName?: string;
  iconClassName?: string;
  infoClassName?: string;
  nameClassName?: string;
  sizeClassName?: string;
  listClassName?: string;
  compact?: boolean;
}

export function ChatAttachmentList({
  attachments,
  imageClassName,
  itemClassName,
  iconClassName,
  infoClassName,
  nameClassName,
  sizeClassName,
  listClassName,
  compact = false,
}: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className={listClassName}>
      {attachments.map((attachment) => (
        <div key={attachment.fileId} className={itemClassName}>
          {attachment.isImage ? (
            <PrivateFileImage
              fileId={attachment.fileId}
              alt={attachment.name}
              className={imageClassName}
              fallback={compact ? <span className={iconClassName}>{attachment.name}</span> : undefined}
            />
          ) : compact ? (
            <span className={iconClassName}>{attachment.name}</span>
          ) : (
            <span className={iconClassName}>TXT</span>
          )}
          {!compact && (
            <div className={infoClassName}>
              <span className={nameClassName}>{attachment.name}</span>
              <span className={sizeClassName}>{attachment.sizeText}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
