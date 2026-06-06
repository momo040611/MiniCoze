import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { VariableSizeList as List } from 'react-window';

interface VirtualizedMessageListProps {
  items: unknown[];
  estimatedItemHeight?: number;
  overscan?: number;
  children: (item: unknown, index: number) => ReactNode;
  className?: string;
  autoScrollToBottom?: boolean;
}

/**
 * 虚拟化消息列表组件
 * 使用 react-window 的 VariableSizeList 实现高性能渲染
 * 支持动态高度和自动滚动到底部
 */
export function VirtualizedMessageList({
  items,
  estimatedItemHeight = 80,
  overscan = 5,
  children,
  className,
  autoScrollToBottom = true,
}: VirtualizedMessageListProps) {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const itemSizeCache = useRef<Map<number, number>>(new Map());
  const prevItemCount = useRef(items.length);

  // 监听容器高度变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 获取每个 item 的高度（带缓存）
  const getItemSize = useCallback(
    (index: number) => {
      return itemSizeCache.current.get(index) ?? estimatedItemHeight;
    },
    [estimatedItemHeight],
  );

  // 重置缓存并重新计算
  const resetHeightCache = useCallback(() => {
    itemSizeCache.current.clear();
    listRef.current?.resetAfterIndex(0);
  }, []);

  // 当 items 数量变化时，自动滚动到底部
  useEffect(() => {
    if (autoScrollToBottom && items.length > prevItemCount.current) {
      // 延迟一帧确保 DOM 已更新
      requestAnimationFrame(() => {
        listRef.current?.scrollToItem(items.length - 1, 'end');
      });
    }
    prevItemCount.current = items.length;
  }, [items.length, autoScrollToBottom]);

  // 渲染每个 item
  const ItemRenderer = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = items[index];
      return (
        <div style={{ ...style, paddingBottom: 4 }}>
          {children(item, index)}
        </div>
      );
    },
    [items, children],
  );

  return (
    <div ref={containerRef} className={className} style={{ flex: 1, minHeight: 0 }}>
      <List
        ref={listRef}
        height={containerHeight}
        itemCount={items.length}
        itemSize={getItemSize}
        width="100%"
        overscanCount={overscan}
      >
        {ItemRenderer}
      </List>
    </div>
  );
}
