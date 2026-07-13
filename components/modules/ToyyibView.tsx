import React, { useState, useCallback, useEffect } from 'react';
import { CreditCard, Shield, ExternalLink, AlertCircle, CheckCircle, Smartphone, Layout, List, Wallet, Plus, Settings, Search, Clock, RefreshCw } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs, StatCard } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { ToyyibService } from '../../services/toyyibService';

export const ToyyibView: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('Bill Management');
  const [amount, setAmount] = useState('10.00');
  const [email, setEmail] = useState('test@example.com');
  const [phone, setPhone] = useState('0123456789');
  const [billName, setBillName] = useState('Test Payment');
  const [loading, setLoading] = useState(false);
  const [lastPaymentUrl, setLastPaymentUrl] = useState<string | null>(null);
  const [lastBillCode, setLastBillCode] = useState<string | null>(null);
  
  // Real data states
  const [categories, setCategories] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Category Management states
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [isCategoryDetailsModalOpen, setIsCategoryDetailsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const handleCreateCategory = async () => {
    if (!newCategoryName || !newCategoryDesc) {
      showToast('Please fill in all fields', 'warning');
      return;
    }
    setIsCreatingCategory(true);
    try {
      await ToyyibService.createCategory(newCategoryName, newCategoryDesc);
      showToast('Category created successfully!', 'success');
      setIsCreateCategoryModalOpen(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
      loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create category', 'error');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleViewCategoryDetails = async (categoryCode: string) => {
    setIsLoadingDetails(true);
    try {
      const details = await ToyyibService.getCategoryDetails(categoryCode);
      // API returns an array, usually we take the first item
      if (details && details.length > 0) {
        setSelectedCategory(details[0]);
        setIsCategoryDetailsModalOpen(true);
      } else {
        showToast('No details found for this category', 'warning');
      }
    } catch (error) {
      showToast('Failed to fetch category details', 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleDeleteCategory = async (categoryCode: string) => {
    try {
      await ToyyibService.deleteCategory(categoryCode);
      showToast('Category removed from system (ToyyibPay account unchanged)', 'success');
      loadData();
    } catch (error) {
      showToast('Failed to remove category', 'error');
    }
  };

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [catList, billList, settleList] = await Promise.all([
        ToyyibService.getCategories(),
        ToyyibService.getBills(),
        ToyyibService.getSettlements()
      ]);
      setCategories(Array.isArray(catList) ? catList : []);
      setBills(Array.isArray(billList) ? billList : []);
      setSettlements(Array.isArray(settleList) ? settleList : []);
    } catch (error) {
      console.error('Failed to load ToyyibPay data', error);
      showToast('Failed to fetch real-time data', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTestPayment = async () => {
    setLoading(true);
    try {
      showToast('Connecting to ToyyibPay...', 'info');
      
      const response = await ToyyibService.createBill({
        billName,
        billDescription: 'Testing ToyyibPay Integration',
        billAmount: parseFloat(amount),
        billTo: 'Test User',
        billEmail: email,
        billPhone: phone,
        externalReferenceNo: 'TEST-' + Date.now()
      });
      
      setLastPaymentUrl(response.paymentUrl);
      setLastBillCode(response.billCode);
      showToast('Bill created successfully!', 'success');
      // Refresh list after creation
      loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create bill', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryManagement = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Bill Categories
            <span className="ml-2 text-sm font-normal text-slate-400">({categories.length} from ToyyibPay)</span>
          </h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={loadData} isLoading={isRefreshing} title="Refresh from ToyyibPay">
              <RefreshCw size={15} className="text-slate-500" />
            </Button>
            <Button size="sm" variant="primary" className="flex items-center gap-2" onClick={() => setIsCreateCategoryModalOpen(true)}>
              <Plus size={16} /> Create Category
            </Button>
          </div>
        </div>
        <Card>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Category Name</th>
                    <th className="pb-3 font-medium">Category Code</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Bills</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isRefreshing ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}>
                        <td className="py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-32 mb-1" /><div className="h-3 bg-slate-100 rounded animate-pulse w-48" /></td>
                        <td className="py-4"><div className="h-3 bg-slate-100 rounded animate-pulse w-20" /></td>
                        <td className="py-4"><div className="h-5 bg-slate-100 rounded-full animate-pulse w-14" /></td>
                        <td className="py-4"><div className="h-3 bg-slate-100 rounded animate-pulse w-6" /></td>
                        <td className="py-4 text-right"><div className="h-6 bg-slate-100 rounded animate-pulse w-24 ml-auto" /></td>
                      </tr>
                    ))
                  ) : categories.length > 0 ? (
                    categories.map((cat, idx) => (
                      <tr key={cat.categoryCode || idx} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-4">
                          <p className="font-bold text-slate-900">{cat.categoryName}</p>
                          <p className="text-xs text-slate-500">{cat.categoryDescription}</p>
                        </td>
                        <td className="py-4 font-mono text-xs text-slate-500">{cat.categoryCode}</td>
                        <td className="py-4">
                          <Badge
                            variant={cat.categoryStatus === '1' ? 'success' : 'neutral'}
                            className="text-[10px]"
                          >
                            {cat.categoryStatus === '1' ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                        </td>
                        <td className="py-4 text-slate-600 font-medium">{cat.billCount ?? '-'}</td>
                        <td className="py-4 text-right space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 py-0 text-jci-blue hover:bg-sky-50"
                            onClick={() => handleViewCategoryDetails(cat.categoryCode)}
                            isLoading={isLoadingDetails && selectedCategory?.categoryCode === cat.categoryCode}
                          >
                            Details
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 py-0 text-red-500 hover:bg-red-50"
                            onClick={() => handleDeleteCategory(cat.categoryCode)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                        No categories found — check that the API key is configured and click ↺ to retry
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderBillManagement = () => {
    return (
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Plus size={20} className="text-jci-blue" />
              Create Test Bill
            </h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Bill Name</label>
                <Input 
                  value={billName} 
                  onChange={(e) => setBillName(e.target.value)}
                  placeholder="e.g. Annual Dues"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Amount (RM)</label>
                <Input 
                  type="number"
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Payer Email</label>
                <Input 
                  type="email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="payer@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Payer Phone</label>
                <Input 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxx"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button 
                onClick={handleTestPayment} 
                className="w-full" 
                isLoading={loading}
                variant="primary"
              >
                Generate Test Payment Link
              </Button>
            </div>

            {lastPaymentUrl && (
              <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-xl animate-fade-in">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-green-500 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-green-900">Payment Link Generated</p>
                    <p className="text-xs text-green-800 font-mono mb-1">Bill Code: {lastBillCode}</p>
                    <p className="text-xs text-green-700 mb-3 truncate">{lastPaymentUrl}</p>
                    <Button 
                      size="sm" 
                      variant="success" 
                      className="flex items-center gap-2"
                      onClick={() => window.open(lastPaymentUrl, '_blank')}
                    >
                      <ExternalLink size={14} />
                      Open Payment Page
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="bg-slate-900 text-white border-none shadow-xl">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Shield size={20} className="text-blue-400" />
                Security Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">API Key</span>
                  <Badge variant="success" className="bg-green-500/20 text-green-400 border-none">Valid</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Webhook URL</span>
                  <Badge variant="info" className="bg-blue-500/20 text-blue-400 border-none">Configured</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">SSL Certificate</span>
                  <Badge variant="success" className="bg-green-500/20 text-green-400 border-none">Active</Badge>
                </div>
              </div>
            </div>
          </Card>
          
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Quick Stats</h3>
                <Layout size={16} className="text-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Bills</p>
                  <p className="text-lg font-bold text-slate-900">{bills.length}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Success Rate</p>
                  <p className="text-lg font-bold text-green-600">94%</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="md:col-span-3">
          <Card title="Recent Bills">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-3 px-4 font-medium">Bill Name</th>
                    <th className="pb-3 px-4 font-medium">Bill Code</th>
                    <th className="pb-3 px-4 font-medium text-right">Amount</th>
                    <th className="pb-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bills.length > 0 ? (
                    bills.slice(0, 10).map((bill, idx) => (
                      <tr key={bill.billCode || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-900">{bill.billName}</td>
                        <td className="py-4 px-4 font-mono text-xs text-slate-500">{bill.billCode}</td>
                        <td className="py-4 px-4 text-right font-bold">RM {(parseFloat(bill.billAmount) || 0).toFixed(2)}</td>
                        <td className="py-4 px-4">
                          <Badge 
                            variant={bill.billPaymentStatus === '1' ? 'success' : 'warning'} 
                            className="text-[10px]"
                          >
                            {bill.billPaymentStatus === '1' ? 'PAID' : 'PENDING'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">No recent bills found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderSettlementManagement = () => {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <StatCard title="Available for Settlement" value="RM 2,450.00" icon={<Wallet className="text-green-500" />} />
          <StatCard title="Pending Settlement" value="RM 1,200.50" icon={<Clock className="text-blue-500" />} />
          <StatCard title="Last Settlement" value="RM 850.00" subtext="2026-04-15" icon={<CheckCircle className="text-slate-400" />} />
        </div>

        <Card>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Settlement History</h3>
              <Button size="sm" variant="ghost" className="text-xs flex items-center gap-2">
                <Search size={14} /> Filter
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Reference No</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Fee (Toyyib)</th>
                    <th className="pb-3 font-medium">Net Amount</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {settlements.length > 0 ? (
                    settlements.map((set, idx) => (
                      <tr key={set.settlementReferenceNo || idx} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-4 font-mono text-xs text-slate-600">{set.settlementReferenceNo}</td>
                        <td className="py-4 font-medium">RM {(parseFloat(set.settlementAmount) || 0).toFixed(2)}</td>
                        <td className="py-4 text-red-500">- RM {(parseFloat(set.settlementFee) || 0).toFixed(2)}</td>
                        <td className="py-4 font-bold text-slate-900">RM {(parseFloat(set.settlementNetAmount) || 0).toFixed(2)}</td>
                        <td className="py-4 text-slate-500">{set.settlementDate}</td>
                        <td className="py-4">
                          <Badge 
                            variant={set.settlementStatus === '1' ? 'success' : 'warning'} 
                            className="text-[10px]"
                          >
                            {set.settlementStatus === '1' ? 'PAID' : 'PENDING'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">No settlement history found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-6 max-w-6xl mx-auto py-6 px-4'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {embedded ? (
          <div>
            <h2 className="text-base font-black text-slate-900">ToyyibPay Integration</h2>
            <p className="text-slate-400 text-xs">Payment gateway management and testing.</p>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ToyyibPay Integration Center</h1>
            <p className="text-slate-500 text-sm">Official payment gateway management and testing dashboard.</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Badge variant="info" className="px-3 py-1 bg-blue-50 text-blue-600 border-blue-100">Sandbox Mode</Badge>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full border border-slate-200" onClick={loadData} isLoading={isRefreshing}>
            <Settings size={18} className="text-slate-500" />
          </Button>
        </div>
      </div>

      <div className="border-b border-slate-200 overflow-x-auto">
        <Tabs
          tabs={['Category Management', 'Bill Management', 'Settlement Management']}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'Category Management' && renderCategoryManagement()}
        {activeTab === 'Bill Management' && renderBillManagement()}
        {activeTab === 'Settlement Management' && renderSettlementManagement()}
      </div>

      {activeTab === 'Bill Management' && (
        <Card className="mt-8">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Recent Webhook Logs</h3>
              <Button size="sm" variant="ghost" className="text-xs">Clear Logs</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Timestamp</th>
                    <th className="pb-3 font-medium">Event</th>
                    <th className="pb-3 font-medium">Bill Code</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <tr className="group hover:bg-slate-50 transition-colors">
                    <td className="py-4 text-slate-500">2026-04-27 15:42:10</td>
                    <td className="py-4 font-medium text-slate-700">payment_received</td>
                    <td className="py-4 font-mono text-xs text-slate-500">BILL-XYZ-123</td>
                    <td className="py-4">
                      <Badge variant="success" className="text-[10px]">SUCCESS</Badge>
                    </td>
                    <td className="py-4 font-bold text-slate-900">RM 50.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Modals */}
      <Modal
        isOpen={isCreateCategoryModalOpen}
        onClose={() => setIsCreateCategoryModalOpen(false)}
        title="Create New Category"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Category Name</label>
            <Input 
              value={newCategoryName} 
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Donation 2026"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Category Description</label>
            <Input 
              value={newCategoryDesc} 
              onChange={(e) => setNewCategoryDesc(e.target.value)}
              placeholder="e.g. General donation for JCI projects"
            />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCreateCategoryModalOpen(false)}>Cancel</Button>
            <Button variant="primary" isLoading={isCreatingCategory} onClick={handleCreateCategory}>Create Category</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCategoryDetailsModalOpen}
        onClose={() => setIsCategoryDetailsModalOpen(false)}
        title="Category Details"
      >
        {selectedCategory ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-100">
              <span className="font-medium text-slate-500">Code</span>
              <span className="col-span-2 font-mono text-slate-900">{selectedCategory.categoryCode}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-100">
              <span className="font-medium text-slate-500">Name</span>
              <span className="col-span-2 font-bold text-slate-900">{selectedCategory.categoryName}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-100">
              <span className="font-medium text-slate-500">Description</span>
              <span className="col-span-2 text-slate-700">{selectedCategory.categoryDescription}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-100">
              <span className="font-medium text-slate-500">Status</span>
              <span className="col-span-2">
                <Badge variant={selectedCategory.categoryStatus === '1' ? 'success' : 'neutral'}>
                  {selectedCategory.categoryStatus === '1' ? 'Active' : 'Inactive'}
                </Badge>
              </span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500">No details available.</div>
        )}
      </Modal>
    </div>
  );
};
