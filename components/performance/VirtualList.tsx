import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * 虚拟滚动列表组件 - 用于高效渲染大量列表项
 * Virtual Scrolling List Component - For efficiently rendering large lists
 */

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // Number of items to render outside visible area
  className?: string;
  onEndReached?: () => void; // Callback when scrolled near end
  endReachedThreshold?: number; // Distance from end to trigger callback (in pixels)
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
  onEndReached,
  endReachedThreshold = 200
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    // Check if near end
    if (onEndReached) {
      const distanceFromEnd = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (distanceFromEnd < endReachedThreshold) {
        onEndReached();
      }
    }
  }, [onEndReached, endReachedThreshold]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 虚拟网格组件 - 用于高效渲染大量网格项
 * Virtual Grid Component - For efficiently rendering large grids
 */

export interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  gap?: number;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function VirtualGrid<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  gap = 0,
  overscan = 1,
  className = '',
  onEndReached,
  endReachedThreshold = 200
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate grid dimensions
  const columns = Math.floor(containerWidth / (itemWidth + gap));
  const rows = Math.ceil(items.length / columns);
  const totalHeight = rows * (itemHeight + gap);

  // Calculate visible range
  const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan);
  const endRow = Math.min(
    rows - 1,
    Math.ceil((scrollTop + containerHeight) / (itemHeight + gap)) + overscan
  );

  const startIndex = startRow * columns;
  const endIndex = Math.min(items.length - 1, (endRow + 1) * columns - 1);

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startRow * (itemHeight + gap);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    // Check if near end
    if (onEndReached) {
      const distanceFromEnd = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (distanceFromEnd < endReachedThreshold) {
        onEndReached();
      }
    }
  }, [onEndReached, endReachedThreshold]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div 
          style={{ 
            transform: `translateY(${offsetY}px)`,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, ${itemWidth}px)`,
            gap: `${gap}px`
          }}
        >
          {visibleItems.map((item, index) => (
            <div key={startIndex + index}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 虚拟表格组件 - 用于高效渲染大量表格行
 * Virtual Table Component - For efficiently rendering large tables
 */

export interface VirtualTableColumn<T> {
  key: string;
  header: string;
  width?: number;
  render: (item: T, index: number) => React.ReactNode;
}

export interface VirtualTableProps<T> {
  items: T[];
  columns: VirtualTableColumn<T>[];
  rowHeight: number;
  containerHeight: number;
  overscan?: number;
  className?: string;
  headerClassName?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function VirtualTable<T>({
  items,
  columns,
  rowHeight,
  containerHeight,
  overscan = 3,
  className = '',
  headerClassName = '',
  rowClassName = '',
  onEndReached,
  endReachedThreshold = 200
}: VirtualTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const totalHeight = items.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * rowHeight;

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    // Check if near end
    if (onEndReached) {
      const distanceFromEnd = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (distanceFromEnd < endReachedThreshold) {
        onEndReached();
      }
    }
  }, [onEndReached, endReachedThreshold]);

  const getRowClassName = (item: T, index: number): string => {
    if (typeof rowClassName === 'function') {
      return rowClassName(item, index);
    }
    return rowClassName;
  };

  return (
    <div className={`overflow-auto ${className}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 bg-white border-b ${headerClassName}`}>
        <div className="flex">
          {columns.map(column => (
            <div
              key={column.key}
              className="px-4 py-3 font-semibold text-left"
              style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div
        ref={containerRef}
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleItems.map((item, index) => (
              <div
                key={startIndex + index}
                className={`flex border-b ${getRowClassName(item, startIndex + index)}`}
                style={{ height: rowHeight }}
              >
                {columns.map(column => (
                  <div
                    key={column.key}
                    className="px-4 py-3 flex items-center"
                    style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
                  >
                    {column.render(item, startIndex + index)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VirtualList;