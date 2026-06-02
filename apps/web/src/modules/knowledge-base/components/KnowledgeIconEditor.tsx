import { UploadOutlined } from '@ant-design/icons';
import { Button, Input, Space, message } from 'antd';
import { useRef } from 'react';
import type { KnowledgeIconType } from '../../../api/knowledge-base';
import { KnowledgeIcon, type KnowledgeIconValue } from './KnowledgeIcon';
import styles from '../document/document.module.css';

type KnowledgeIconEditorProps = {
  value: KnowledgeIconValue;
  onChange: (value: KnowledgeIconValue & { iconType: KnowledgeIconType }) => void;
};

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('图片读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function KnowledgeIconEditor({ value, onChange }: KnowledgeIconEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (file?: File) => {
    if (!file) return;
    const url = await readImageAsDataUrl(file);
    onChange({ ...value, iconType: 'image', iconImageUrl: url });
    message.success('图标图片已更新');
  };

  return (
    <div className={styles.iconEditor}>
      <div className={styles.iconPreviewPanel}>
        <KnowledgeIcon value={value} size="large" />
        <span>当前图标</span>
      </div>
      <div className={styles.iconEditorControls}>
        <label className={styles.iconEditorLabel}>Emoji 图标</label>
        <Input
          maxLength={4}
          placeholder="📘"
          value={value.icon ?? ''}
          onChange={(event) => onChange({ ...value, icon: event.target.value, iconType: 'emoji' })}
        />
        <Space wrap>
          <Button icon={<UploadOutlined />} onClick={() => inputRef.current?.click()}>
            上传图片
          </Button>
          <Button
            disabled={!value.iconImageUrl}
            onClick={() => onChange({ ...value, iconType: 'emoji', iconImageUrl: undefined })}
          >
            清除图片
          </Button>
        </Space>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/*"
          onChange={(event) => {
            void handleImageChange(event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </div>
    </div>
  );
}

export { KnowledgeIconEditor };
