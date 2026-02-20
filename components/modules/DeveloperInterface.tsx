// Developer Interface - API Documentation, Webhook Management, and Integration Tools
import React, { useState } from 'react';
import { 
  Code, Webhook as WebhookIcon, Key, BookOpen, Terminal, FileText, Copy, CheckCircle,
  ExternalLink, AlertCircle, Settings, Eye, EyeOff, Plus, Trash2, Edit,
  Play, Activity, Shield, Globe
} from 'lucide-react';
import { Card, Button, Badge, Tabs, Modal, useToast } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { useWebhooks } from '../../hooks/useWebhooks';
import { Webhook } from '../../services/webhookService';
import { formatDate } from '../../utils/dateUtils';

export const DeveloperInterface: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'api' | 'webhooks' | 'keys' | 'logs'>('api');
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; key: string; created: Date; lastUsed?: Date }>>([]);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const { webhooks, loading, createWebhook, updateWebhook, deleteWebhook, testWebhook } = useWebhooks();
  const { showToast } = useToast();

  const handleCreateWebhook = async (data: Partial<Webhook>) => {
    try {
      await createWebhook(data as Webhook);
      setIsWebhookModalOpen(false);
      showToast('Webhook created successfully', 'success');
    } catch (err) {
      showToast('Failed to create webhook', 'error');
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      await testWebhook(webhookId);
      showToast('Webhook test sent', 'success');
    } catch (err) {
      showToast('Failed to test webhook', 'error');
    }
  };

  const handleCreateApiKey = () => {
    const newKey = {
      id: `key-${Date.now()}`,
      name: `API Key ${apiKeys.length + 1}`,
      key: `jci_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      created: new Date(),
    };
    setApiKeys([...apiKeys, newKey]);
    setIsKeyModalOpen(false);
    showToast('API key created successfully', 'success');
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newRevealed = new Set(revealedKeys);
    if (newRevealed.has(keyId)) {
      newRevealed.delete(keyId);
    } else {
      newRevealed.add(keyId);
    }
    setRevealedKeys(newRevealed);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Developer Interface</h2>
            <p className="text-slate-300">API documentation, webhook management, and integration tools</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="success" className="bg-green-500/20 text-green-300 border-green-500/50">
              <Shield size={14} className="mr-1" />
              Secure
            </Badge>
            <Badge variant="info" className="bg-blue-500/20 text-blue-300 border-blue-500/50">
              <Globe size={14} className="mr-1" />
              API v1.0
            </Badge>
          </div>
        </div>
      </div>

      <Card noPadding>
        <div className="px-6 pt-4">
          <Tabs
            tabs={['API Documentation', 'Webhooks', 'API Keys', 'Integration Logs']}
            activeTab={
              activeTab === 'api' ? 'API Documentation' :
              activeTab === 'webhooks' ? 'Webhooks' :
              activeTab === 'keys' ? 'API Keys' : 'Integration Logs'
            }
            onTabChange={(tab) => {
              if (tab === 'API Documentation') setActiveTab('api');
              else if (tab === 'Webhooks') setActiveTab('webhooks');
              else if (tab === 'API Keys') setActiveTab('keys');
              else setActiveTab('logs');
            }}
          />
        </div>

        <div className="p-6">
          {activeTab === 'api' && <APIDocumentationTab />}
          {activeTab === 'webhooks' && (
            <WebhooksTab
              webhooks={webhooks}
              loading={loading}
              onSelect={setSelectedWebhook}
              onEdit={(webhook) => {
                setSelectedWebhook(webhook);
                setIsWebhookModalOpen(true);
              }}
              onDelete={deleteWebhook}
              onTest={handleTestWebhook}
              onCreate={() => {
                setSelectedWebhook(null);
                setIsWebhookModalOpen(true);
              }}
            />
          )}
          {activeTab === 'keys' && (
            <APIKeysTab
              apiKeys={apiKeys}
              revealedKeys={revealedKeys}
              onToggleVisibility={toggleKeyVisibility}
              onCopy={copyToClipboard}
              onCreate={() => setIsKeyModalOpen(true)}
              onDelete={(id) => {
                setApiKeys(apiKeys.filter(k => k.id !== id));
                showToast('API key deleted', 'success');
              }}
            />
          )}
          {activeTab === 'logs' && <IntegrationLogsTab />}
        </div>
      </Card>

      {/* Webhook Modal */}
      {isWebhookModalOpen && (
        <WebhookModal
          webhook={selectedWebhook}
          onClose={() => {
            setIsWebhookModalOpen(false);
            setSelectedWebhook(null);
          }}
          onSave={handleCreateWebhook}
        />
      )}

      {/* API Key Modal */}
      {isKeyModalOpen && (
        <APIKeyModal
          onClose={() => setIsKeyModalOpen(false)}
          onCreate={handleCreateApiKey}
        />
      )}
    </div>
  );
};

// API Documentation Tab
const APIDocumentationTab: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  const endpoints = [
    {
      id: 'members',
      method: 'GET',
      path: '/api/v1/members',
      description: 'Retrieve all members',
      auth: 'Bearer Token',
    },
    {
      id: 'events',
      method: 'GET',
      path: '/api/v1/events',
      description: 'Retrieve all events',
      auth: 'Bearer Token',
    },
    {
      id: 'projects',
      method: 'GET',
      path: '/api/v1/projects',
      description: 'Retrieve all projects',
      auth: 'Bearer Token',
    },
    {
      id: 'points',
      method: 'POST',
      path: '/api/v1/points/award',
      description: 'Award points to a member',
      auth: 'Bearer Token',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">API Endpoints</h3>
        <div className="space-y-2">
          {endpoints.map(endpoint => (
            <div
              key={endpoint.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedEndpoint === endpoint.id
                  ? 'border-jci-blue bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setSelectedEndpoint(selectedEndpoint === endpoint.id ? null : endpoint.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={endpoint.method === 'GET' ? 'success' : 'info'}>
                    {endpoint.method}
                  </Badge>
                  <code className="text-sm font-mono text-slate-700">{endpoint.path}</code>
                  <span className="text-sm text-slate-500">{endpoint.description}</span>
                </div>
                <Badge variant="neutral" className="text-xs">
                  {endpoint.auth}
                </Badge>
              </div>
              {selectedEndpoint === endpoint.id && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="bg-slate-900 rounded-lg p-4 text-green-400 font-mono text-sm overflow-x-auto">
                    <pre>{`curl -X ${endpoint.method} \\
  ${window.location.origin}${endpoint.path} \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="text-blue-600 mt-1" size={20} />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Full API Documentation</h4>
            <p className="text-sm text-blue-700 mb-3">
              For complete API documentation, including request/response schemas, authentication, and examples, visit our API docs.
            </p>
            <Button size="sm" variant="outline" className="border-blue-300 text-blue-700">
              <ExternalLink size={14} className="mr-2" />
              View Full Documentation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Webhooks Tab
interface WebhooksTabProps {
  webhooks: Webhook[];
  loading: boolean;
  onSelect: (webhook: Webhook) => void;
  onEdit: (webhook: Webhook) => void;
  onDelete: (id: string) => Promise<void>;
  onTest: (id: string) => Promise<void>;
  onCreate: () => void;
}

const WebhooksTab: React.FC<WebhooksTabProps> = ({
  webhooks,
  loading,
  onSelect,
  onEdit,
  onDelete,
  onTest,
  onCreate,
}) => {
  const { showToast } = useToast();

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Loading webhooks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Webhook Endpoints</h3>
          <p className="text-sm text-slate-500">Configure webhooks to receive real-time events</p>
        </div>
        <Button onClick={onCreate}>
          <Plus size={16} className="mr-2" />
          Create Webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
          <WebhookIcon className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 mb-4">No webhooks configured</p>
          <Button onClick={onCreate}>Create Your First Webhook</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(webhook => (
            <div
              key={webhook.id}
              className="p-4 border border-slate-200 rounded-lg hover:border-jci-blue transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-slate-900">{webhook.name}</h4>
                    <Badge variant={webhook.active ? 'success' : 'neutral'}>
                      {webhook.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <code className="text-sm text-slate-600 block mb-2">{webhook.url}</code>
                  <div className="flex flex-wrap gap-2">
                    {webhook.events.map(event => (
                      <Badge key={event} variant="neutral" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onTest(webhook.id!)}
                  >
                    <Play size={14} className="mr-1" />
                    Test
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(webhook)}
                  >
                    <Edit size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this webhook?')) {
                        await onDelete(webhook.id!);
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// API Keys Tab
interface APIKeysTabProps {
  apiKeys: Array<{ id: string; name: string; key: string; created: Date; lastUsed?: Date }>;
  revealedKeys: Set<string>;
  onToggleVisibility: (id: string) => void;
  onCopy: (text: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

const APIKeysTab: React.FC<APIKeysTabProps> = ({
  apiKeys,
  revealedKeys,
  onToggleVisibility,
  onCopy,
  onCreate,
  onDelete,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">API Keys</h3>
          <p className="text-sm text-slate-500">Manage your API keys for authentication</p>
        </div>
        <Button onClick={onCreate}>
          <Plus size={16} className="mr-2" />
          Create API Key
        </Button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
          <Key className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 mb-4">No API keys created</p>
          <Button onClick={onCreate}>Create Your First API Key</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map(apiKey => (
            <div
              key={apiKey.id}
              className="p-4 border border-slate-200 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 mb-2">{apiKey.name}</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-sm font-mono bg-slate-100 px-2 py-1 rounded flex-1">
                      {revealedKeys.has(apiKey.id) ? apiKey.key : '•'.repeat(40)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggleVisibility(apiKey.id)}
                    >
                      {revealedKeys.has(apiKey.id) ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onCopy(apiKey.key)}
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500">
                    Created: {formatDate(apiKey.created)}
                    {apiKey.lastUsed && ` • Last used: ${formatDate(apiKey.lastUsed)}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this API key?')) {
                      onDelete(apiKey.id);
                    }
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Integration Logs Tab
const IntegrationLogsTab: React.FC = () => {
  const logs = [
    { id: '1', timestamp: new Date(), type: 'webhook', status: 'success', message: 'Webhook delivered successfully' },
    { id: '2', timestamp: new Date(), type: 'api', status: 'error', message: 'API request failed: Invalid token' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Integration Activity</h3>
        <div className="space-y-2">
          {logs.map(log => (
            <div
              key={log.id}
              className="p-4 border border-slate-200 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Badge variant={log.status === 'success' ? 'success' : 'error'}>
                  {log.status}
                </Badge>
                <span className="text-sm text-slate-600">{log.type}</span>
                <span className="text-sm text-slate-500">{log.message}</span>
              </div>
              <span className="text-xs text-slate-400">{formatDate(log.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Webhook Modal
interface WebhookModalProps {
  webhook: Webhook | null;
  onClose: () => void;
  onSave: (data: Partial<Webhook>) => Promise<void>;
}

const WebhookModal: React.FC<WebhookModalProps> = ({ webhook, onClose, onSave }) => {
  const [name, setName] = useState(webhook?.name || '');
  const [url, setUrl] = useState(webhook?.url || '');
  const [events, setEvents] = useState<string[]>(webhook?.events || []);
  const [active, setActive] = useState(webhook?.active ?? true);

  const availableEvents = [
    'member.created',
    'member.updated',
    'event.created',
    'event.updated',
    'project.created',
    'project.updated',
    'points.awarded',
  ];

  const handleSave = async () => {
    await onSave({
      name,
      url,
      events,
      active,
    });
  };

  const toggleEvent = (event: string) => {
    if (events.includes(event)) {
      setEvents(events.filter(e => e !== event));
    } else {
      setEvents([...events, event]);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={webhook ? 'Edit Webhook' : 'Create Webhook'}
      size="lg"
    >
      <div className="space-y-4">
        <Input
          label="Webhook Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Webhook"
          required
        />
        <Input
          label="Webhook URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/webhook"
          required
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Events to Subscribe
          </label>
          <div className="grid grid-cols-2 gap-2">
            {availableEvents.map(event => (
              <label
                key={event}
                className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={events.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded"
                />
                <span className="text-sm">{event}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-slate-700">Active</span>
        </label>
        <div className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="flex-1">Save Webhook</Button>
        </div>
      </div>
    </Modal>
  );
};

// API Key Modal
interface APIKeyModalProps {
  onClose: () => void;
  onCreate: () => void;
}

const APIKeyModal: React.FC<APIKeyModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Create API Key"
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Key Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My API Key"
          required
        />
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <AlertCircle size={16} className="inline mr-1" />
            Make sure to copy your API key immediately. You won't be able to see it again.
          </p>
        </div>
        <div className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onCreate} className="flex-1" disabled={!name.trim()}>
            Create API Key
          </Button>
        </div>
      </div>
    </Modal>
  );
};

