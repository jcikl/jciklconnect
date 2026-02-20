import React, { useState, useCallback, useRef } from 'react';
import { 
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Grid, 
  Play, 
  Save, 
  Trash2 
} from 'lucide-react';
import { 
  Workflow, 
  WorkflowNode, 
  WorkflowConnection, 
  WorkflowNodeType, 
  WorkflowNodeCategory 
} from '../../../types';

interface WorkflowCanvasProps {
  workflow: Workflow;
  onWorkflowChange: (workflow: Workflow) => void;
  onSave: () => void;
  onTest: () => void;
  readonly?: boolean;
}

interface NodePaletteItem {
  type: WorkflowNodeType;
  category: WorkflowNodeCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
}

interface CanvasPosition {
  x: number;
  y: number;
  scale: number;
}

const NODE_PALETTE: NodePaletteItem[] = [
  // Triggers
  { type: 'trigger', category: 'triggers', label: 'Manual Trigger', description: 'Start workflow manually', icon: '▶️', color: 'bg-green-500' },
  
  // Actions
  { type: 'action', category: 'actions', label: 'Action', description: 'Perform an action', icon: '⚡', color: 'bg-blue-500' },
  { type: 'email', category: 'communication', label: 'Send Email', description: 'Send email notification', icon: '📧', color: 'bg-purple-500' },
  { type: 'notification', category: 'communication', label: 'Notification', description: 'Send in-app notification', icon: '🔔', color: 'bg-yellow-500' },
  
  // Logic
  { type: 'condition', category: 'logic', label: 'Condition', description: 'Conditional branching', icon: '❓', color: 'bg-orange-500' },
  { type: 'delay', category: 'utilities', label: 'Delay', description: 'Wait for specified time', icon: '⏰', color: 'bg-gray-500' },
  
  // Data
  { type: 'data_update', category: 'data', label: 'Update Data', description: 'Update database record', icon: '💾', color: 'bg-indigo-500' },
  { type: 'task_create', category: 'actions', label: 'Create Task', description: 'Create a new task', icon: '📝', color: 'bg-teal-500' },
  
  // Integrations
  { type: 'webhook', category: 'integrations', label: 'Webhook', description: 'Call external webhook', icon: '🔗', color: 'bg-pink-500' },
  
  // Utilities
  { type: 'approval', category: 'utilities', label: 'Approval', description: 'Wait for approval', icon: '✋', color: 'bg-red-500' },
  { type: 'end', category: 'utilities', label: 'End', description: 'End workflow', icon: '🏁', color: 'bg-gray-700' },
];

const CATEGORIES = [
  { id: 'triggers', label: 'Triggers', icon: '⚡' },
  { id: 'actions', label: 'Actions', icon: '🎯' },
  { id: 'logic', label: 'Logic', icon: '🧠' },
  { id: 'communication', label: 'Communication', icon: '💬' },
  { id: 'data', label: 'Data', icon: '📊' },
  { id: 'integrations', label: 'Integrations', icon: '🔗' },
  { id: 'utilities', label: 'Utilities', icon: '🛠️' },
];

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  onWorkflowChange,
  onSave,
  onTest,
  readonly = false,
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [canvasPosition, setCanvasPosition] = useState<CanvasPosition>({ x: 0, y: 0, scale: 1 });
  const [isPaletteVisible, setIsPaletteVisible] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<WorkflowNodeCategory>('triggers');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{ nodeId: string; handle?: string } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [draggedNodeType, setDraggedNodeType] = useState<WorkflowNodeType | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Handle node drag from palette
  const handleDragStart = useCallback((e: React.DragEvent, nodeType: WorkflowNodeType) => {
    if (readonly) return;
    setDraggedNodeType(nodeType);
    e.dataTransfer.setData('text/plain', nodeType);
  }, [readonly]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (readonly || !draggedNodeType) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const nodeType = NODE_PALETTE.find(n => n.type === draggedNodeType);
    if (!nodeType) return;

    const x = (e.clientX - rect.left - canvasPosition.x) / canvasPosition.scale;
    const y = (e.clientY - rect.top - canvasPosition.y) / canvasPosition.scale;

    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: nodeType.type,
      position: { x: Math.max(0, x - 100), y: Math.max(0, y - 40) },
      data: {
        label: nodeType.label,
        description: nodeType.description,
        category: nodeType.category,
        icon: nodeType.icon,
      },
      connections: [],
    };

    const updatedWorkflow = {
      ...workflow,
      nodes: [...workflow.nodes, newNode],
    };

    onWorkflowChange(updatedWorkflow);
    setDraggedNodeType(null);
  }, [workflow, onWorkflowChange, readonly, draggedNodeType, canvasPosition]);

  // Handle node selection
  const handleNodeClick = useCallback((nodeId: string) => {
    if (readonly) return;
    
    if (isConnecting && connectionStart) {
      // Complete connection
      if (connectionStart.nodeId !== nodeId) {
        const newConnection: WorkflowConnection = {
          id: `conn_${Date.now()}`,
          sourceNodeId: connectionStart.nodeId,
          targetNodeId: nodeId,
          sourceHandle: connectionStart.handle,
        };

        const updatedWorkflow = {
          ...workflow,
          connections: [...workflow.connections, newConnection],
        };

        onWorkflowChange(updatedWorkflow);
      }
      
      setIsConnecting(false);
      setConnectionStart(null);
    } else {
      setSelectedNode(nodeId);
    }
  }, [workflow, onWorkflowChange, isConnecting, connectionStart, readonly]);

  // Handle connection start
  const handleConnectionStart = useCallback((nodeId: string, handle?: string) => {
    if (readonly) return;
    
    setIsConnecting(true);
    setConnectionStart({ nodeId, handle });
  }, [readonly]);

  // Handle node deletion
  const handleDeleteNode = useCallback((nodeId: string) => {
    if (readonly) return;
    
    const updatedWorkflow = {
      ...workflow,
      nodes: workflow.nodes.filter(n => n.id !== nodeId),
      connections: workflow.connections.filter(
        c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
      ),
    };

    onWorkflowChange(updatedWorkflow);
    setSelectedNode(null);
  }, [workflow, onWorkflowChange, readonly]);

  // Canvas zoom and pan
  const handleZoomIn = useCallback(() => {
    setCanvasPosition(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCanvasPosition(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.3) }));
  }, []);

  const handleResetView = useCallback(() => {
    setCanvasPosition({ x: 0, y: 0, scale: 1 });
  }, []);

  // Filter nodes by category
  const filteredNodes = NODE_PALETTE.filter(node => node.category === selectedCategory);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Node Palette */}
      {isPaletteVisible && (
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Node Palette</h3>
              <button
                onClick={() => setIsPaletteVisible(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <EyeOff size={16} />
              </button>
            </div>
            
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id as WorkflowNodeCategory)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category.icon} {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Node List */}
          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            {filteredNodes.map((node) => (
              <div
                key={node.type}
                draggable={!readonly}
                onDragStart={(e) => handleDragStart(e, node.type)}
                className={`p-3 bg-white border border-gray-200 rounded-lg cursor-move hover:shadow-md transition-shadow ${
                  readonly ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${node.color} rounded-lg flex items-center justify-center text-white text-sm`}>
                    {node.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">{node.label}</div>
                    <div className="text-xs text-gray-500">{node.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isPaletteVisible && (
              <button
                onClick={() => setIsPaletteVisible(true)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Eye size={16} />
              </button>
            )}
            
            <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-2">
              <button
                onClick={handleZoomOut}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                {Math.round(canvasPosition.scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={handleResetView}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <RotateCcw size={16} />
              </button>
            </div>
            
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-lg ${
                showGrid 
                  ? 'text-blue-600 bg-blue-100' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Grid size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!readonly && (
              <>
                <button
                  onClick={onTest}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Play size={16} />
                  Test Workflow
                </button>
                <button
                  onClick={onSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  Save
                </button>
              </>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            backgroundImage: showGrid 
              ? 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)'
              : 'none',
            backgroundSize: showGrid ? '20px 20px' : 'auto',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasPosition.scale})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Render Connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {workflow.connections.map(connection => {
                const sourceNode = workflow.nodes.find(n => n.id === connection.sourceNodeId);
                const targetNode = workflow.nodes.find(n => n.id === connection.targetNodeId);
                
                if (!sourceNode || !targetNode) return null;
                
                const x1 = sourceNode.position.x + 100;
                const y1 = sourceNode.position.y + 40;
                const x2 = targetNode.position.x + 100;
                const y2 = targetNode.position.y + 40;
                
                return (
                  <g key={connection.id}>
                    <path
                      d={`M ${x1} ${y1} Q ${x1 + (x2 - x1) / 2} ${y1} ${x2} ${y2}`}
                      stroke={selectedConnection === connection.id ? '#3b82f6' : '#6b7280'}
                      strokeWidth="2"
                      fill="none"
                      className="cursor-pointer"
                      onClick={() => setSelectedConnection(connection.id)}
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r="4"
                      fill={selectedConnection === connection.id ? '#3b82f6' : '#6b7280'}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Render Nodes */}
            {workflow.nodes.map(node => {
              const nodeType = NODE_PALETTE.find(n => n.type === node.type);
              if (!nodeType) return null;
              
              return (
                <div
                  key={node.id}
                  className={`absolute bg-white border-2 rounded-lg shadow-md cursor-pointer transition-all ${
                    selectedNode === node.id 
                      ? 'border-blue-500 shadow-lg' 
                      : 'border-gray-200 hover:border-gray-300'
                  } ${
                    node.status === 'running' ? 'animate-pulse' : ''
                  }`}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                    width: '200px',
                    height: '80px',
                  }}
                  onClick={() => handleNodeClick(node.id)}
                >
                  <div className="p-3 h-full flex items-center gap-3">
                    <div className={`w-10 h-10 ${nodeType.color} rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                      {nodeType.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">
                        {node.data.label}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {node.data.description}
                      </div>
                    </div>
                    
                    {/* Node Status Indicator */}
                    {node.status && (
                      <div className={`w-3 h-3 rounded-full ${
                        node.status === 'completed' ? 'bg-green-500' :
                        node.status === 'running' ? 'bg-blue-500' :
                        node.status === 'error' ? 'bg-red-500' :
                        'bg-gray-300'
                      }`} />
                    )}
                  </div>
                  
                  {/* Connection Handles */}
                  {!readonly && (
                    <>
                      <div
                        className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full cursor-pointer hover:bg-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConnectionStart(node.id, 'output');
                        }}
                      />
                      <div
                        className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full cursor-pointer hover:bg-gray-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle input connection
                        }}
                      />
                    </>
                  )}
                  
                  {/* Delete Button */}
                  {!readonly && selectedNode === node.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNode(node.id);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};