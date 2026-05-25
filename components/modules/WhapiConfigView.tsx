import React, { useState, useEffect } from 'react';
import { Settings, Shield, MessageSquare, CheckCircle, ExternalLink, Save, Activity, BarChart2 } from 'lucide-react';
import { Card, Button, Badge, useToast, ProgressBar } from '../ui/Common';
import { Input } from '../ui/Form';

export const WhapiConfigView: React.FC = () => {
  const { showToast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  
  const [quotaData, setQuotaData] = useState<{
    messages: { used: number, total: number | string },
    chats: { used: number, total: number | string },
    requests: { used: number, total: number | string }
  } | null>(null);

  useEffect(() => {
    // Load existing config from local storage or mock backend
    const savedConfig = localStorage.getItem('whapi_config_key');
    if (savedConfig) {
      setApiKey(savedConfig);
      setStatus('connected');
      fetchQuota(savedConfig);
    }
  }, []);

  const fetchQuota = async (token: string) => {
    try {
      const response = await fetch('https://gate.whapi.cloud/limits', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 204) {
        // 204 No Content means "No limits" (e.g., Paid channel)
        setQuotaData({
          messages: { used: 0, total: 'Unlimited' },
          chats: { used: 0, total: 'Unlimited' },
          requests: { used: 0, total: 'Unlimited' }
        });
        return;
      }

      if (response.ok) {
        const text = await response.text();
        console.log('Whapi /limits raw response:', text); // Debugging info

        if (!text) {
          setQuotaData({
            messages: { used: 0, total: 'Unlimited' },
            chats: { used: 0, total: 'Unlimited' },
            requests: { used: 0, total: 'Unlimited' }
          });
          return;
        }
        
        const data = JSON.parse(text);
        
        // The API returns values like {"messages":150,"chats":[],"checks":30,"requests":980}
        // which represents remaining quotas or usage in the sandbox.
        const messagesVal = typeof data?.messages === 'number' ? data.messages : 0;
        const requestsVal = typeof data?.requests === 'number' ? data.requests : 0;
        const chatsVal = Array.isArray(data?.chats) ? data.chats.length : 0;

        setQuotaData({
          messages: { used: messagesVal, total: 'Sandbox Quota' },
          chats: { used: chatsVal, total: 'Sandbox Quota' },
          requests: { used: requestsVal, total: 'Sandbox Quota' }
        });
      } else {
        console.error('Whapi /limits error status:', response.status);
        setQuotaData({
          messages: { used: 0, total: 'Error' },
          chats: { used: 0, total: 'Error' },
          requests: { used: 0, total: 'Error' }
        });
      }
    } catch (e) {
      console.error('Failed to fetch limits (possible CORS or network issue):', e);
      setQuotaData({
        messages: { used: 0, total: 'Error' },
        chats: { used: 0, total: 'Error' },
        requests: { used: 0, total: 'Error' }
      });
    }
  };

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('whapi_config_key', apiKey);
      showToast('Whapi configuration saved successfully', 'success');
      setStatus('connected');
      setLoading(false);
      fetchQuota(apiKey);
    }, 800);
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      showToast('Please enter an API Key first', 'warning');
      return;
    }
    setTesting(true);
    
    try {
      // Real API call to Whapi to check token validity
      const response = await fetch('https://gate.whapi.cloud/settings', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        showToast('Connection to Whapi successful!', 'success');
        setStatus('connected');
        fetchQuota(apiKey);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Invalid API Token or Connection Failed');
      }
    } catch (error) {
      console.error('Whapi connection error:', error);
      showToast(error instanceof Error ? error.message : 'Connection failed. Please check your token.', 'error');
      setStatus('disconnected');
      setQuotaData(null);
    } finally {
      setTesting(false);
    }
  };

  const renderQuotaItem = (label: string, used: number, total: number | string) => {
    let percentage = 0;
    if (typeof total === 'number' && total > 0) {
      percentage = Math.min(100, Math.round((used / total) * 100));
    }
    
    const isWarning = percentage > 80;
    const isCritical = percentage > 95;

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-end text-sm">
          <span className="font-bold text-slate-700">{label}</span>
          <span className="text-slate-500 font-mono text-xs">
            {used.toLocaleString()} / {typeof total === 'number' ? total.toLocaleString() : total}
          </span>
        </div>
        {typeof total === 'number' ? (
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-jci-blue'}`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        ) : (
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-full rounded-full"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Whapi API Configuration</h1>
          <p className="text-slate-500 text-sm">Manage your WhatsApp API connection via Whapi.</p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'connected' ? (
            <Badge variant="success" className="px-3 py-1 bg-green-50 text-green-600 border-green-100 flex items-center gap-1">
              <CheckCircle size={14} /> Connected
            </Badge>
          ) : (
            <Badge variant="neutral" className="px-3 py-1">Not Connected</Badge>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Settings size={20} className="text-jci-blue" />
              API Settings
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Whapi API Token</label>
                <Input 
                  type="password"
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Whapi Token"
                />
                <p className="text-xs text-slate-500">
                  You can find your API token in the Whapi dashboard. 
                  <a href="https://whapi.readme.io/reference/" target="_blank" rel="noopener noreferrer" className="text-jci-blue hover:underline ml-1 inline-flex items-center">
                    View Documentation <ExternalLink size={10} className="ml-0.5" />
                  </a>
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex gap-3">
              <Button 
                onClick={handleSave} 
                isLoading={loading}
                variant="primary"
                className="flex items-center gap-2"
              >
                <Save size={16} /> Save Configuration
              </Button>
              <Button 
                onClick={handleTestConnection} 
                isLoading={testing}
                variant="outline"
              >
                Test Connection
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="bg-slate-900 text-white border-none shadow-xl">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Shield size={20} className="text-green-400" />
                Connection Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Status</span>
                  <Badge variant={status === 'connected' ? 'success' : 'neutral'} className="border-none">
                    {status === 'connected' ? 'Active' : 'Offline'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Webhook Integration</span>
                  <Badge variant="neutral" className="border-none">Not Configured</Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Quota Section - Spans across below settings if connected */}
        {status === 'connected' && (
          <Card className="md:col-span-3">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <BarChart2 size={20} className="text-jci-blue" />
                  API Usage & Quota
                </h3>
                <Button size="sm" variant="ghost" onClick={() => fetchQuota(apiKey)} className="text-xs flex items-center gap-2">
                  <Activity size={14} /> Refresh Usage
                </Button>
              </div>
              
              {quotaData ? (
                <div className="grid md:grid-cols-3 gap-8 pt-4">
                  {renderQuotaItem('Messages Sent', quotaData.messages.used, quotaData.messages.total)}
                  {renderQuotaItem('Active Chats', quotaData.chats.used, quotaData.chats.total)}
                  {renderQuotaItem('API Requests', quotaData.requests.used, quotaData.requests.total)}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 animate-pulse">
                  Loading quota data...
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
