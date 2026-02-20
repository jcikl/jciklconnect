import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Filter, Users, Eye } from 'lucide-react';
import { VirtualTable, VirtualTableColumn } from './VirtualList';
import { useIntersectionObserver, useLazyLoad } from '../../hooks/usePerformanceOptimization';
import { optimizedFirestore } from '../../services/optimizedFirestoreService';
import { Button, Card } from '../ui/Common';
import { Badge } from '../ui/Common';

/**
 * 优化的会员列表组件 - 展示性能优化技术的实际应用
 * Optimized Members List Component - Demonstrates practical application of performance optimization techniques
 */

interface Member {
  id: string;
  name: string;
  email: string;
  membershipType: string;
  joinDate: string;
  status: 'Active' | 'Inactive' | 'Pending';
  points: number;
  avatar?: string;
}

interface OptimizedMembersListProps {
  className?: string;
}

export const OptimizedMembersList: React.FC<OptimizedMembersListProps> = ({ 
  className = '' 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);

  // 使用防抖优化搜索 - 使用 useState 和 useEffect 实现值的防抖
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // 使用交集观察器实现无限滚动
  const [loadMoreRef, loadMoreEntry] = useIntersectionObserver({
    threshold: 0.1
  });

  // 懒加载会员数据
  const { loading: initialLoading } = useLazyLoad(
    async () => {
      const result = await optimizedFirestore.getCollection<Member>(
        'members',
        [],
        { pageSize: 50 },
        { useCache: true, cacheType: 'user' }
      );
      setMembers(result.data);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      return result.data;
    },
    true
  );

  // 过滤和搜索逻辑（使用 useMemo 优化）
  const filteredMembers = useMemo(() => {
    let filtered = members;

    // 状态过滤
    if (filterStatus !== 'all') {
      filtered = filtered.filter(member => 
        member.status.toLowerCase() === filterStatus.toLowerCase()
      );
    }

    // 搜索过滤
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(searchLower) ||
        member.email.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [members, filterStatus, debouncedSearchTerm]);

  // 加载更多数据
  const loadMoreMembers = useCallback(async () => {
    if (loading || !hasMore || !lastDoc) return;

    setLoading(true);
    try {
      const result = await optimizedFirestore.getCollection<Member>(
        'members',
        [],
        { pageSize: 50, lastDoc },
        { useCache: true, cacheType: 'user' }
      );

      setMembers(prev => [...prev, ...result.data]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading more members:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, lastDoc]);

  // 当滚动到底部时加载更多
  React.useEffect(() => {
    if (loadMoreEntry?.isIntersecting) {
      loadMoreMembers();
    }
  }, [loadMoreEntry?.isIntersecting, loadMoreMembers]);

  // 虚拟表格列定义
  const columns: VirtualTableColumn<Member>[] = useMemo(() => [
    {
      key: 'avatar',
      header: '',
      width: 60,
      render: (member) => (
        <div className="w-8 h-8 bg-jci-blue rounded-full flex items-center justify-center text-white text-sm font-medium">
          {member.avatar ? (
            <img 
              src={member.avatar} 
              alt={member.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            member.name.charAt(0).toUpperCase()
          )}
        </div>
      )
    },
    {
      key: 'name',
      header: '姓名',
      width: 200,
      render: (member) => (
        <div>
          <div className="font-medium text-slate-900">{member.name}</div>
          <div className="text-sm text-slate-500">{member.email}</div>
        </div>
      )
    },
    {
      key: 'membershipType',
      header: '会员类型',
      width: 120,
      render: (member) => (
        <Badge variant="neutral">{member.membershipType}</Badge>
      )
    },
    {
      key: 'status',
      header: '状态',
      width: 100,
      render: (member) => (
        <Badge 
          variant={
            member.status === 'Active' ? 'success' : 
            member.status === 'Pending' ? 'warning' : 'error'
          }
        >
          {member.status}
        </Badge>
      )
    },
    {
      key: 'points',
      header: '积分',
      width: 100,
      render: (member) => (
        <span className="font-medium text-jci-blue">
          {member.points.toLocaleString()}
        </span>
      )
    },
    {
      key: 'joinDate',
      header: '加入日期',
      width: 120,
      render: (member) => (
        <span className="text-slate-600">
          {new Date(member.joinDate).toLocaleDateString('zh-CN')}
        </span>
      )
    },
    {
      key: 'actions',
      header: '操作',
      width: 100,
      render: (member) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // 这里可以添加查看详情的逻辑
            console.log('View member:', member.id);
          }}
        >
          <Eye className="w-4 h-4" />
        </Button>
      )
    }
  ], []);

  if (initialLoading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-jci-blue"></div>
          <span className="ml-2 text-slate-600">正在加载会员数据...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <div className="p-6">
        {/* 搜索和过滤栏 */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索会员姓名或邮箱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-jci-blue focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="text-slate-400 w-4 h-4" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-jci-blue focus:border-transparent"
            >
              <option value="all">所有状态</option>
              <option value="active">活跃</option>
              <option value="inactive">非活跃</option>
              <option value="pending">待审核</option>
            </select>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-slate-600">
            <Users className="w-4 h-4 mr-2" />
            <span>共 {filteredMembers.length} 名会员</span>
            {debouncedSearchTerm && (
              <span className="ml-2 text-sm">
                (搜索: "{debouncedSearchTerm}")
              </span>
            )}
          </div>
        </div>

        {/* 虚拟化表格 */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <VirtualTable
            items={filteredMembers}
            columns={columns}
            rowHeight={60}
            containerHeight={600}
            headerClassName="bg-slate-50 border-b border-slate-200"
            rowClassName={(_, index) => 
              index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
            }
            onEndReached={hasMore ? loadMoreMembers : undefined}
            endReachedThreshold={100}
          />
        </div>

        {/* 加载更多指示器 */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {loading ? (
              <div className="flex items-center text-slate-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-jci-blue mr-2"></div>
                正在加载更多...
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={loadMoreMembers}
                className="text-jci-blue"
              >
                点击加载更多
              </Button>
            )}
          </div>
        )}

        {!hasMore && filteredMembers.length > 0 && (
          <div className="text-center py-4 text-slate-500 text-sm">
            已显示所有会员
          </div>
        )}

        {filteredMembers.length === 0 && !initialLoading && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {debouncedSearchTerm ? '未找到匹配的会员' : '暂无会员数据'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default OptimizedMembersList;