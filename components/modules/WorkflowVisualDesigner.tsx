// Visual Workflow Designer - Drag-and-drop workflow builder
import React, { useState, useCallback, useRef } from 'react';
import { 
  Play, Mail, Award, Bell, Webhook, GitBranch, Plus, Trash2, 
  Save, Eye, Settings, ArrowRight, X, GripVertical, CheckCircle
} from 'lucide-react';
import { Card, Button, Badge, Modal, useToast } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { Workflow, WorkflowStep } from '../../services/automationService';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  label: string;
  icon: React.ReactNode;
  config: any;
  position: { x: number; y: number };
  connections: string[]; // IDs of connected nodes
}

interface WorkflowVisualDesignerProps {
  workflow?: Workflow;
  onSave: (workflow: Omit<Workflow, 'id'>) => Promise<void>;
  onClose: () => void;
}

export const WorkflowVisualDesigner: React.FC<WorkflowVisualDesignerProps> = ({
  workflow,
  onSave,
  onClose,
}) => {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isConfigModalOpen, setConfigModalOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState(workflow?.name || '');
  const [workflowDescription, setWorkflowDescription] = useState(workflow?.description || '');
  const [draggedNode, setDraggedNode] = useState<WorkflowNode | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Initialize nodes from workflow
  React.useEffect(() => {
    if (workflow) {
      const initialNodes: WorkflowNode[] = [];
      
      // Add trigger node
      if (workflow.trigger) {
        initialNodes.push({
          id: 'trigger-1',
          type: 'trigger',
          label: workflow.trigger.type,
          icon: <Play size={20} />,
          config: workflow.trigger,
          position: { x: 100, y: 100 },
          connections: ['action-1'],
        });
      }

      // Add action nodes
      workflow.steps.forEach((step, index) => {
        const nodeId = `action-${index + 1}`;
        initialNodes.push({
          id: nodeId,
          type: 'action',
          label: step.type,
          icon: getStepIcon(step.type),
          config: step,
          position: { x: 100, y: 250 + (index * 150) },
          connections: index < workflow.steps.length - 1 ? [`action-${index + 2}`] : [],
        });
      });

      setNodes(initialNodes);
    }
  }, [workflow]);

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'send_email':
        return <Mail size={20} />;
      case 'award_points':
        return <Award size={20} />;
      case 'create_notification':
        return <Bell size={20} />;
      case 'call_webhook':
        return <Webhook size={20} />;
      case 'update_data':
        return <Settings size={20} />;
      default:
        return <GitBranch size={20} />;
    }
  };

  const handleAddNode = (type: 'trigger' | 'action' | 'condition') => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      label: type === 'trigger' ? 'New Trigger' : type === 'action' ? 'New Action' : 'New Condition',
      icon: type === 'trigger' ? <Play size={20} /> : <GitBranch size={20} />,
      config: {},
      position: { x: 300, y: nodes.length * 150 + 100 },
      connections: [],
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
    setConfigModalOpen(true);
  };

  const handleNodeClick = (node: WorkflowNode) => {
    setSelectedNode(node);
    setConfigModalOpen(true);
  };

  const handleNodeConfigSave = (config: any) => {
    if (!selectedNode) return;

    setNodes(nodes.map(node =>
      node.id === selectedNode.id
        ? { ...node, config, label: config.name || config.type || node.label }
        : node
    ));
    setConfigModalOpen(false);
    setSelectedNode(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setConfigModalOpen(false);
    }
  };

  const handleSave = async () => {
    if (!workflowName.trim()) {
      showToast('Please enter a workflow name', 'error');
      return;
    }

    const triggerNode = nodes.find(n => n.type === 'trigger');
    const actionNodes = nodes.filter(n => n.type === 'action').sort((a, b) => {
      // Sort by position or connection order
      return a.position.y - b.position.y;
    });

    if (!triggerNode) {
      showToast('Please add at least one trigger', 'error');
      return;
    }

    if (actionNodes.length === 0) {
      showToast('Please add at least one action', 'error');
      return;
    }

    try {
      const workflowData: Omit<Workflow, 'id'> = {
        name: workflowName,
        description: workflowDescription,
        trigger: triggerNode.config,
        steps: actionNodes.map(node => node.config as WorkflowStep),
        active: true,
        executions: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await onSave(workflowData);
      showToast('Workflow saved successfully', 'success');
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save workflow';
      showToast(errorMessage, 'error');
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);
  const GRID_SIZE = 20;

  const handleNodeMouseDown = (node: WorkflowNode, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left mouse button
    if ((e.target as HTMLElement).closest('button')) return; // Don't drag if clicking buttons
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDraggedNode(node);
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning && canvasRef.current) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setCanvasOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!isDragging || !draggedNode || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left - dragOffset.x - canvasOffset.x) / zoom;
    let y = (e.clientY - rect.top - dragOffset.y - canvasOffset.y) / zoom;

    // Snap to grid if enabled
    if (snapToGrid) {
      x = Math.round(x / GRID_SIZE) * GRID_SIZE;
      y = Math.round(y / GRID_SIZE) * GRID_SIZE;
    }

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === draggedNode.id
          ? { ...node, position: { x: Math.max(0, x), y: Math.max(0, y) } }
          : node
      )
    );
  }, [isDragging, draggedNode, dragOffset, isPanning, panStart, canvasOffset, zoom, snapToGrid]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNode(null);
    setIsPanning(false);
  }, []);

  React.useEffect(() => {
    if (isDragging || isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isPanning, handleMouseMove, handleMouseUp]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // Start panning if middle mouse button or space + click
      if (e.button === 1 || e.ctrlKey || e.metaKey) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        e.preventDefault();
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.5, Math.min(2, prev * delta)));
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (connectingFrom && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleConnectStart = (nodeId: string) => {
    setConnectingFrom(nodeId);
  };

  const handleConnectEnd = (targetNodeId: string) => {
    if (connectingFrom && connectingFrom !== targetNodeId) {
      setNodes(prevNodes =>
        prevNodes.map(node =>
          node.id === connectingFrom
            ? { ...node, connections: [...new Set([...node.connections, targetNodeId])] }
            : node
        )
      );
    }
    setConnectingFrom(null);
  };

  const handleDisconnect = (fromNodeId: string, toNodeId: string) => {
    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === fromNodeId
          ? { ...node, connections: node.connections.filter(id => id !== toNodeId) }
          : node
      )
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-slate-200 p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Workflow Name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="max-w-md"
            />
            <Textarea
              placeholder="Description (optional)"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              rows={2}
              className="max-w-md"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save size={16} className="mr-2" />
              Save Workflow
            </Button>
          </div>
        </div>

        {/* Node Palette */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAddNode('trigger')}
            className="flex items-center gap-2"
          >
            <Plus size={14} />
            Add Trigger
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAddNode('action')}
            className="flex items-center gap-2"
          >
            <Plus size={14} />
            Add Action
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAddNode('condition')}
            className="flex items-center gap-2"
          >
            <Plus size={14} />
            Add Condition
          </Button>
        </div>
      </div>

      {/* Canvas Controls */}
      <div className="border-b border-slate-200 p-2 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
          >
            -
          </Button>
          <span className="text-sm text-slate-600 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
          >
            +
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(1)}
          >
            Reset
          </Button>
          <div className="w-px h-6 bg-slate-300 mx-2" />
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              className="rounded"
            />
            Snap to Grid
          </label>
        </div>
        <div className="text-xs text-slate-500">
          Hold Ctrl/Cmd + Scroll to zoom | Hold Ctrl/Cmd + Drag to pan
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative bg-slate-50 overflow-auto"
        onMouseMove={handleCanvasMouseMove}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        onClick={(e) => {
          // Cancel connection if clicking on canvas
          if (connectingFrom && e.target === e.currentTarget) {
            setConnectingFrom(null);
          }
        }}
      >
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <GitBranch className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500 mb-4">Start building your workflow</p>
              <p className="text-sm text-slate-400">Add a trigger and actions to get started</p>
            </div>
          </div>
        ) : (
          <div 
            className="relative" 
            style={{ 
              minWidth: '1000px', 
              minHeight: '800px',
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Grid Background */}
            {snapToGrid && (
              <svg className="absolute inset-0 pointer-events-none opacity-20" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                    <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#94a3b8" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            )}

            {/* Connection Lines */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
              {nodes.map(node =>
                node.connections.map(connectedId => {
                  const connectedNode = nodes.find(n => n.id === connectedId);
                  if (!connectedNode) return null;
                  
                  const startX = node.position.x + 100;
                  const startY = node.position.y + 80;
                  const endX = connectedNode.position.x + 100;
                  const endY = connectedNode.position.y;
                  
                  // Calculate control points for curved line
                  const midY = (startY + endY) / 2;
                  
                  return (
                    <g key={`${node.id}-${connectedId}`}>
                      <path
                        d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
                        stroke="#3b82f6"
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#arrowhead)"
                      />
                      {/* Invisible clickable area for disconnecting */}
                      <path
                        d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
                        stroke="transparent"
                        strokeWidth="10"
                        fill="none"
                        className="pointer-events-auto cursor-pointer"
                        onClick={() => handleDisconnect(node.id, connectedId)}
                      />
                    </g>
                  );
                })
              )}
              
              {/* Temporary connection line while connecting */}
              {connectingFrom && (() => {
                const fromNode = nodes.find(n => n.id === connectingFrom);
                if (!fromNode) return null;
                
                const startX = fromNode.position.x + 100;
                const startY = fromNode.position.y + 80;
                const midY = (startY + mousePosition.y) / 2;
                
                return (
                  <path
                    d={`M ${startX} ${startY} C ${startX} ${midY}, ${mousePosition.x} ${midY}, ${mousePosition.x} ${mousePosition.y}`}
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    fill="none"
                  />
                );
              })()}
              
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
                </marker>
              </defs>
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
              <div
                key={node.id}
                className={`absolute cursor-move bg-white border-2 rounded-lg shadow-lg p-4 min-w-[200px] ${
                  selectedNode?.id === node.id
                    ? 'border-jci-blue ring-2 ring-jci-blue/20'
                    : 'border-slate-200 hover:border-jci-blue'
                } ${isDragging && draggedNode?.id === node.id ? 'opacity-75' : ''}`}
                style={{
                  left: `${node.position.x}px`,
                  top: `${node.position.y}px`,
                }}
                onMouseDown={(e) => handleNodeMouseDown(node, e)}
                onClick={(e) => {
                  if (!isDragging) {
                    handleNodeClick(node);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-jci-blue">{node.icon}</div>
                    <Badge variant={node.type === 'trigger' ? 'info' : node.type === 'condition' ? 'warning' : 'neutral'}>
                      {node.type}
                    </Badge>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNode(node.id);
                    }}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
                <h4 className="font-semibold text-slate-900 text-sm">{node.label}</h4>
                {node.config.description && (
                  <p className="text-xs text-slate-500 mt-1">{node.config.description}</p>
                )}
                
                {/* Connection Points */}
                <div className="mt-3 flex items-center justify-between">
                  {node.type !== 'trigger' && (
                    <div className="relative group">
                      <button
                        className={`w-4 h-4 rounded-full border-2 border-white transition-all ${
                          connectingFrom === node.id
                            ? 'bg-jci-blue scale-125'
                            : connectingFrom
                            ? 'bg-amber-400 hover:bg-jci-blue scale-110'
                            : 'bg-slate-300 hover:bg-jci-blue'
                        }`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (connectingFrom) {
                            handleConnectEnd(node.id);
                          } else {
                            handleConnectStart(node.id);
                          }
                        }}
                        title={connectingFrom === node.id ? 'Cancel connection' : 'Connect from this node'}
                      />
                      <div className="absolute left-0 top-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          {connectingFrom === node.id ? 'Click to cancel' : 'Click to connect from'}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex-1" />
                  {node.type !== 'action' && (
                    <div className="relative group">
                      <button
                        className={`w-4 h-4 rounded-full border-2 border-white transition-all ${
                          connectingFrom && connectingFrom !== node.id
                            ? 'bg-jci-blue scale-125'
                            : connectingFrom === node.id
                            ? 'bg-amber-400 hover:bg-jci-blue scale-110'
                            : 'bg-slate-300 hover:bg-jci-blue'
                        }`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (connectingFrom && connectingFrom !== node.id) {
                            handleConnectEnd(node.id);
                          } else if (!connectingFrom) {
                            handleConnectStart(node.id);
                          }
                        }}
                        title={connectingFrom ? 'Connect to this node' : 'Connect from this node'}
                      />
                      <div className="absolute right-0 top-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          {connectingFrom ? 'Click to connect to' : 'Click to connect from'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Node Configuration Modal */}
      {selectedNode && (
        <NodeConfigModal
          node={selectedNode}
          isOpen={isConfigModalOpen}
          onClose={() => {
            setConfigModalOpen(false);
            setSelectedNode(null);
          }}
          onSave={handleNodeConfigSave}
        />
      )}
    </div>
  );
};

// Node Configuration Modal
interface NodeConfigModalProps {
  node: WorkflowNode;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
}

const NodeConfigModal: React.FC<NodeConfigModalProps> = ({ node, isOpen, onClose, onSave }) => {
  const [config, setConfig] = useState<any>(node.config || {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  if (node.type === 'trigger') {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Configure Trigger" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Trigger Type"
            value={config.type || ''}
            onChange={(e) => setConfig({ ...config, type: e.target.value })}
            options={[
              { label: 'Event', value: 'event' },
              { label: 'Schedule', value: 'schedule' },
              { label: 'Condition', value: 'condition' },
              { label: 'Webhook', value: 'webhook' },
            ]}
            required
          />
          {config.type === 'event' && (
            <Input
              label="Event Name"
              value={config.eventName || ''}
              onChange={(e) => setConfig({ ...config, eventName: e.target.value })}
              placeholder="e.g., member_registered"
            />
          )}
          {config.type === 'schedule' && (
            <Input
              label="Cron Expression"
              value={config.cron || ''}
              onChange={(e) => setConfig({ ...config, cron: e.target.value })}
              placeholder="e.g., 0 0 * * * (daily at midnight)"
            />
          )}
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1">Save</Button>
          </div>
        </form>
      </Modal>
    );
  }

  if (node.type === 'action') {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Configure Action" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Action Type"
            value={config.type || ''}
            onChange={(e) => setConfig({ ...config, type: e.target.value })}
            options={[
              { label: 'Send Email', value: 'send_email' },
              { label: 'Award Points', value: 'award_points' },
              { label: 'Create Notification', value: 'create_notification' },
              { label: 'Call Webhook', value: 'call_webhook' },
              { label: 'Update Data', value: 'update_data' },
            ]}
            required
          />
          {config.type === 'send_email' && (
            <>
              <Input
                label="Email Template"
                value={config.template || ''}
                onChange={(e) => setConfig({ ...config, template: e.target.value })}
                placeholder="Template name or ID"
              />
              <Input
                label="Recipient"
                value={config.recipient || ''}
                onChange={(e) => setConfig({ ...config, recipient: e.target.value })}
                placeholder="Email address or variable"
              />
            </>
          )}
          {config.type === 'award_points' && (
            <>
              <Input
                label="Points Amount"
                type="number"
                value={config.amount || ''}
                onChange={(e) => setConfig({ ...config, amount: parseInt(e.target.value) })}
                required
              />
              <Input
                label="Category"
                value={config.category || ''}
                onChange={(e) => setConfig({ ...config, category: e.target.value })}
                placeholder="e.g., event_attendance"
              />
            </>
          )}
          {config.type === 'create_notification' && (
            <>
              <Input
                label="Title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                required
              />
              <Textarea
                label="Message"
                value={config.message || ''}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                required
              />
            </>
          )}
          {config.type === 'call_webhook' && (
            <>
              <Input
                label="Webhook URL"
                value={config.url || ''}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="https://example.com/webhook"
                required
              />
              <Select
                label="Method"
                value={config.method || 'POST'}
                onChange={(e) => setConfig({ ...config, method: e.target.value })}
                options={[
                  { label: 'POST', value: 'POST' },
                  { label: 'GET', value: 'GET' },
                  { label: 'PUT', value: 'PUT' },
                ]}
              />
            </>
          )}
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1">Save</Button>
          </div>
        </form>
      </Modal>
    );
  }

  if (node.type === 'condition') {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Configure Condition" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Condition Name"
            value={config.name || ''}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="e.g., Check if member is active"
            required
          />
          <Select
            label="Condition Type"
            value={config.conditionType || ''}
            onChange={(e) => setConfig({ ...config, conditionType: e.target.value })}
            options={[
              { label: 'Equals', value: 'equals' },
              { label: 'Not Equals', value: 'not_equals' },
              { label: 'Greater Than', value: 'greater_than' },
              { label: 'Less Than', value: 'less_than' },
              { label: 'Contains', value: 'contains' },
              { label: 'Is Empty', value: 'is_empty' },
            ]}
            required
          />
          <Input
            label="Field Path"
            value={config.field || ''}
            onChange={(e) => setConfig({ ...config, field: e.target.value })}
            placeholder="e.g., member.role"
            required
          />
          <Input
            label="Expected Value"
            value={config.value || ''}
            onChange={(e) => setConfig({ ...config, value: e.target.value })}
            placeholder="Value to compare against"
          />
          <Textarea
            label="Description"
            value={config.description || ''}
            onChange={(e) => setConfig({ ...config, description: e.target.value })}
            placeholder="Optional description of this condition"
            rows={2}
          />
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1">Save</Button>
          </div>
        </form>
      </Modal>
    );
  }

  return null;
};

