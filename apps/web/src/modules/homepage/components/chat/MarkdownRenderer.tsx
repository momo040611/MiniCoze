import { isValidElement, memo, useState } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { copyToClipboard } from '../../../../utils/clipboard';
import styles from './MarkdownRenderer.module.css';

interface Props {
  content: string;
  isStreaming?: boolean;
}

function extractText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (isValidElement(children)) return extractText((children.props as Record<string, unknown>).children as ReactNode);
  return '';
}

function CodeBlock({ language, value }: { language?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(value, false);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.codeBlockWrapper}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{language || 'text'}</span>
        <button className={styles.copyBtn} onClick={handleCopy} type="button">
          {copied ? (
            <>
              <CheckOutlined style={{ fontSize: 12 }} /> 已复制
            </>
          ) : (
            <>
              <CopyOutlined style={{ fontSize: 12 }} /> 复制
            </>
          )}
        </button>
      </div>
      <pre className={styles.codePre}>
        <code>{value}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return <code className={styles.inlineCode}>{children}</code>;
}

function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className={styles.tableWrapper}>
      <table>{children}</table>
    </div>
  );
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isStreaming,
}: Props) {
  return (
    <div className={`${styles.mdContent} ${isStreaming ? styles.streaming : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight, rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            // 代码块（有语言标记）vs 行内代码（无语言标记）
            const match = /language-(\w+)/.exec(className || '');
            const value = extractText(children).replace(/\n$/, '');

            // 行内代码：无语言标记且为单行
            const isInline = !match && !String(children).includes('\n');

            if (isInline) {
              return <InlineCode>{children}</InlineCode>;
            }

            return <CodeBlock language={match?.[1]} value={value} />;
          },
          table({ children }) {
            return <TableWrapper>{children}</TableWrapper>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
