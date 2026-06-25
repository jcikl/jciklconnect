import React, { useState, useEffect } from 'react';
import { Activity, Clock, Database, Zap, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Common';
import { apiCache, userDataCache, staticDataCache } from '../../services/cacheService';

/**
 * 性能监控组件 - 显示应用性能指标
 * Performance Monitor Component - Shows application performance metrics
 */

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  apiResponseTime: number;
  errorRate: number;
}

export const PerformanceMonitor: React.FC<{
  isVisible: boolean;
  onClose: () => void;
}> = ({ isVisible, onClose }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    apiResponseTime: 0,
    errorRate: 0
  });

  const [cacheStats, setCacheStats] = useState({
    api: { totalEntries: 0, memorySize: 0, expiredEntries: 0, localStorageSize: 0 },
    user: { totalEntries: 0, memorySize: 0, expiredEntries: 0, localStorageSize: 0 },
    static: { totalEntries: 0, memorySize: 0, expiredEntries: 0, localStorageSize: 0 }
  });

  useEffect(() => {
    if (!isVisible) return;

    const updateMetrics = () => {
      // 获取缓存统计
      const apiStats = apiCache.getStats();
      const userStats = userDataCache.getStats();
      const staticStats = staticDataCache.getStats();

      setCacheStats({
        api: apiStats,
        user: userStats,
        static: staticStats
      });

      // 计算性能指标
      const totalCacheEntries = apiStats.totalEntries + userStats.totalEntries + staticStats.totalEntries;
      const cacheHitRate = totalCacheEntries > 0 ?
        ((apiStats.totalEntries - apiStats.expiredEntries) / totalCacheEntries) * 100 : 0;

      // 获取内存使用情况（如果支持）
      const memoryUsage = (performance as any).memory ?
        (performance as any).memory.usedJSHeapSize / 1024 / 1024 : 0;

      setMetrics(prev => ({
        ...prev,
        memoryUsage,
        cacheHitRate
      }));
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 2000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center">
              <Activity className="mr-2" />
              性能监控
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {/* 性能指标卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm text-slate-600">渲染时间</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics.renderTime.toFixed(1)}ms
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-sm text-slate-600">内存使用</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics.memoryUsage.toFixed(1)}MB
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <Zap className="h-8 w-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm text-slate-600">缓存命中率</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics.cacheHitRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
                <div>
                  <p className="text-sm text-slate-600">错误率</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics.errorRate.toFixed(2)}%
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* 缓存详情 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">缓存统计</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <h4 className="font-medium text-slate-900 mb-2">API 缓存</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">总条目:</span>
                    <span className="font-medium">{cacheStats.api.totalEntries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">内存大小:</span>
                    <span className="font-medium">{cacheStats.api.memorySize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">过期条目:</span>
                    <span className="font-medium">{cacheStats.api.expiredEntries}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium text-slate-900 mb-2">用户缓存</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">总条目:</span>
                    <span className="font-medium">{cacheStats.user.totalEntries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">内存大小:</span>
                    <span className="font-medium">{cacheStats.user.memorySize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">过期条目:</span>
                    <span className="font-medium">{cacheStats.user.expiredEntries}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium text-slate-900 mb-2">静态缓存</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">总条目:</span>
                    <span className="font-medium">{cacheStats.static.totalEntries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">内存大小:</span>
                    <span className="font-medium">{cacheStats.static.memorySize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">过期条目:</span>
                    <span className="font-medium">{cacheStats.static.expiredEntries}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* 性能建议 */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">性能建议</h3>
            <div className="space-y-2">
              {metrics.memoryUsage > 100 && (
                <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-sm text-yellow-800">
                    内存使用较高 ({metrics.memoryUsage.toFixed(1)}MB)，建议清理缓存或优化组件
                  </span>
                </div>
              )}

              {metrics.cacheHitRate < 50 && (
                <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Zap className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm text-blue-800">
                    缓存命中率较低 ({metrics.cacheHitRate.toFixed(1)}%)，考虑调整缓存策略
                  </span>
                </div>
              )}

              {metrics.errorRate > 5 && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-red-800">
                    错误率较高 ({metrics.errorRate.toFixed(2)}%)，请检查错误日志
                  </span>
                </div>
              )}

              {metrics.memoryUsage <= 100 && metrics.cacheHitRate >= 50 && metrics.errorRate <= 5 && (
                <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Zap className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm text-green-800">
                    应用性能良好，所有指标都在正常范围内
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
            <button
              onClick={() => {
                apiCache.clear();
                userDataCache.clear();
                staticDataCache.clear();
              }}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              清空所有缓存
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200"
            >
              关闭
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PerformanceMonitor;