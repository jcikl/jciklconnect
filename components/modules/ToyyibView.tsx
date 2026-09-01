import React, { useState, useCallback, useEffect } from 'react';
import { ExternalLink, Download, Settings } from 'lucide-react';
import { Button, useToast, ConfirmDialog, CONFIRM_CLOSED, Tabs } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { ToyyibService, ToyyibBillRecord, ToyyibCategory } from '../../services/toyyibService';
import { ProjectsService } from '../../services/projectsService';
import { TOYYIB_CONFIG } from '../../config/constants';
import { useToyyibMode } from '../../hooks/useToyyibMode';
import { MembersService } from '../../services/membersService';
import { ToyyibCategoriesTab } from './Toyyib/ToyyibCategoriesTab';
import { ToyyibBillsTab } from './Toyyib/ToyyibBillsTab';
import { ToyyibCategoryModals } from './Toyyib/ToyyibCategoryModals';
import { ToyyibSettingsPanel } from './Toyyib/ToyyibSettingsPanel';

export const ToyyibView: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { showToast } = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [activeTab, setActiveTab] = useState<'category' | 'bill' | 'settlement'>('category');
  const [categories, setCategories] = useState<ToyyibCategory[]>([]);
  const [bills, setBills] = useState<ToyyibBillRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);

  // Bill creation — category picker drives CreateBillForm props
  const [billCategoryCode, setBillCategoryCode] = useState('');

  // Category creation modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<'membership' | 'project'>('membership');
  const [createYear, setCreateYear] = useState(String(new Date().getFullYear()));
  const [createMembershipType, setCreateMembershipType] = useState('');
  const [createProjectId, setCreateProjectId] = useState('');
  const [isCreatingCat, setIsCreatingCat] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Link modal — assign a category to an event or annual dues
  const [linkCat, setLinkCat] = useState<ToyyibCategory | null>(null);
  const [linkType, setLinkType] = useState<'membership' | 'project'>('membership');
  const [linkProjectId, setLinkProjectId] = useState('');
  const [linkMembershipType, setLinkMembershipType] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);

  const [detailsCat, setDetailsCat] = useState<any>(null);
  const [syncingBill, setSyncingBill] = useState<string | null>(null);

  // Bills tab
  const [billFilter, setBillFilter] = useState<'all' | '1' | '2' | '3'>('all');
  const [showCreateBill, setShowCreateBill] = useState(false);

  // Settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const { isSandbox, hasProdKey, loading: modeLoading } = useToyyibMode();
  const [togglingMode, setTogglingMode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Test payment panel
  const [testMembers, setTestMembers] = useState<any[]>([]);
  const [testMemberId, setTestMemberId] = useState('');
  const [testProjectId, setTestProjectId] = useState('');
  const [testYear, setTestYear] = useState(new Date().getFullYear());
  const [testSyncing, setTestSyncing] = useState(false);
  const [testMemberEventIds, setTestMemberEventIds] = useState<Set<string>>(new Set());

  const handleSyncBillStatus = async (billCode: string) => {
    setSyncingBill(billCode);
    try {
      const result = await ToyyibService.syncBillStatus(billCode);
      if (result) {
        setBills(prev => prev.map(b => b.billCode === billCode ? { ...b, ...result } : b));
        const isPaid = result.billpaymentStatus === '1';
        showToast(isPaid ? 'Marked as Paid' : `Status updated (${result.billpaymentStatus})`, isPaid ? 'success' : 'info');
      } else {
        showToast('No transaction data from ToyyibPay', 'warning');
      }
    } catch {
      showToast('Failed to sync status', 'error');
    } finally {
      setSyncingBill(null);
    }
  };

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [catList, billList, projectList] = await Promise.all([
        ToyyibService.getCategories(),
        ToyyibService.getBills(),
        ProjectsService.getAllProjects(),
      ]);
      setCategories(Array.isArray(catList) ? catList : []);
      setBills(Array.isArray(billList) ? billList : []);
      setProjects((Array.isArray(projectList) ? projectList : []).map(p => ({ id: p.id!, title: p.title || p.name || '' })));
    } catch (error) {
      showToast('Failed to load data', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (showSettings && testMembers.length === 0) {
      MembersService.getAllMembers().then(list => setTestMembers(list ?? [])).catch(() => { });
    }
  }, [showSettings, testMembers.length]);

  const openLinkModal = (cat: ToyyibCategory) => {
    setLinkCat(cat);
    setLinkType(cat.linkedType ?? 'membership');
    setLinkProjectId(cat.linkedProjectId ?? '');
    setLinkMembershipType(cat.membershipType ?? '');
  };

  const handleSaveLink = async () => {
    if (!linkCat) return;
    if (linkType === 'membership' && !linkMembershipType) { showToast('Select a membership type', 'warning'); return; }
    if (linkType === 'project' && !linkProjectId) { showToast('Select a project', 'warning'); return; }
    setIsSavingLink(true);
    try {
      const selectedProject = projects.find(p => p.id === linkProjectId);
      await ToyyibService.updateCategoryLink(linkCat.categoryCode, {
        linkedType: linkType,
        linkedProjectId: linkType === 'project' ? linkProjectId : undefined,
        linkedProjectName: linkType === 'project' ? selectedProject?.title : undefined,
        membershipType: linkType === 'membership' ? linkMembershipType : undefined,
      });
      showToast('Link saved!', 'success');
      setLinkCat(null);
      loadData();
    } catch {
      showToast('Failed to save link', 'error');
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleCreateCategory = async () => {
    if (createType === 'membership' && !createMembershipType) { showToast('Select a membership type', 'warning'); return; }
    if (createType === 'project' && !createProjectId) { showToast('Select a project', 'warning'); return; }

    const selectedProject = projects.find(p => p.id === createProjectId);
    const catName = createType === 'membership'
      ? `${createYear} Membership`
      : selectedProject?.title ?? '';
    const catDesc = catName;

    setIsCreatingCat(true);
    try {
      const result = await ToyyibService.createCategory(catName, catDesc);
      const newCode = Array.isArray(result) ? result[0]?.CategoryCode : null;
      // Auto-link immediately after creation
      if (newCode) {
        await ToyyibService.updateCategoryLink(newCode, {
          linkedType: createType,
          linkedProjectId: createType === 'project' ? createProjectId : undefined,
          linkedProjectName: createType === 'project' ? selectedProject?.title : undefined,
          membershipType: createType === 'membership' ? createMembershipType : undefined,
        });
      }
      showToast('Category created!', 'success');
      setIsCreateModalOpen(false);
      setCreateMembershipType(''); setCreateProjectId('');
      loadData();
    } catch (e) { showToast('Failed to create category', 'error'); }
    finally { setIsCreatingCat(false); }
  };

  const handleImport = async () => {
    if (!importCode.trim()) { showToast('Enter a category code', 'warning'); return; }
    setIsImporting(true);
    try {
      await ToyyibService.importCategory(importCode.trim());
      showToast('Category imported!', 'success');
      setIsImportModalOpen(false); setImportCode('');
      loadData();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setIsImporting(false); }
  };

  const handleDelete = async (categoryCode: string) => {
    try {
      await ToyyibService.deleteCategory(categoryCode);
      showToast('Removed from system', 'success');
      loadData();
    } catch { showToast('Failed to remove', 'error'); }
  };

  const handleShowCategoryDetails = (category: ToyyibCategory) => {
    ToyyibService.getCategoryDetails(category.categoryCode)
      .then(details => setDetailsCat(details?.[0] ?? category))
      .catch(() => setDetailsCat(category));
  };

  // ── Tab bar ────────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'category' as const, label: 'Categories' },
    { key: 'bill' as const, label: 'Bills' },
    { key: 'settlement' as const, label: 'Settlement' },
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────
  // ── Settings ───────────────────────────────────────────────────────────────
  const copyField = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const testConnection = async () => {
    setConnStatus('testing');
    try {
      const result = await ToyyibService.getCategoryDetails(TOYYIB_CONFIG.CATEGORY_CODE);
      setConnStatus(Array.isArray(result) && result.length > 0 ? 'ok' : 'fail');
    } catch {
      setConnStatus('fail');
    }
  };

  const renderSettings = () => (
    <ToyyibSettingsPanel
      connStatus={connStatus}
      showSecretKey={showSecretKey}
      isSandbox={isSandbox}
      hasProdKey={hasProdKey}
      modeLoading={modeLoading}
      togglingMode={togglingMode}
      copiedField={copiedField}
      testMembers={testMembers}
      testMemberId={testMemberId}
      testProjectId={testProjectId}
      testYear={testYear}
      testSyncing={testSyncing}
      testMemberEventIds={testMemberEventIds}
      projects={projects}
      onTestConnection={testConnection}
      onCopyField={copyField}
      showToast={showToast}
      loadData={loadData}
      setShowSecretKey={setShowSecretKey}
      setTogglingMode={setTogglingMode}
      setTestMembers={setTestMembers}
      setTestMemberId={setTestMemberId}
      setTestProjectId={setTestProjectId}
      setTestYear={setTestYear}
      setTestSyncing={setTestSyncing}
      setTestMemberEventIds={setTestMemberEventIds}
      setConfirmState={setConfirmState}
    />
  );
  // ── Category Management ────────────────────────────────────────────────────
  const renderCategories = () => (
    <ToyyibCategoriesTab
      categories={categories}
      projects={projects}
      isRefreshing={isRefreshing}
      isCreateModalOpen={isCreateModalOpen}
      createType={createType}
      createYear={createYear}
      createMembershipType={createMembershipType}
      createProjectId={createProjectId}
      isCreatingCat={isCreatingCat}
      onRefresh={loadData}
      onOpenImport={() => setIsImportModalOpen(true)}
      onCreateTypeChange={setCreateType}
      onCreateYearChange={setCreateYear}
      onCreateMembershipTypeChange={setCreateMembershipType}
      onCreateProjectIdChange={setCreateProjectId}
      onResetCreate={() => { setCreateType('membership'); setCreateMembershipType(''); setCreateProjectId(''); setCreateYear(String(new Date().getFullYear())); }}
      onCreateCategory={handleCreateCategory}
      onOpenLink={openLinkModal}
      onShowDetails={handleShowCategoryDetails}
      onDelete={handleDelete}
    />
  );
  // ── Bill Management ────────────────────────────────────────────────────────
  const renderBills = () => (
    <ToyyibBillsTab
      bills={bills}
      categories={categories}
      billFilter={billFilter}
      showCreateBill={showCreateBill}
      billCategoryCode={billCategoryCode}
      syncingBill={syncingBill}
      isRefreshing={isRefreshing}
      onBillFilterChange={setBillFilter}
      onToggleCreateBill={() => { setShowCreateBill(v => !v); setBillCategoryCode(''); }}
      onBillCategoryCodeChange={setBillCategoryCode}
      onRefresh={loadData}
      onSyncBillStatus={handleSyncBillStatus}
      onCreateBillSuccess={() => { showToast('Bill created!', 'success'); setShowCreateBill(false); loadData(); }}
      onCreateBillError={error => showToast(error.message, 'error')}
    />
  );
  // ── Settlement ─────────────────────────────────────────────────────────────
  const renderSettlement = () => (
    <div className="py-16 text-center space-y-3">
      <Download size={36} className="mx-auto text-slate-200" />
      <p className="font-semibold text-slate-500">Settlement not available</p>
      <p className="text-sm text-slate-400 max-w-xs mx-auto">
        Get Settlement Summary requires an Enterprise Partner account with ToyyibPay.
      </p>
      <a href="https://toyyibpay.com" target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-jci-blue hover:underline mt-1">
        <ExternalLink size={12} /> Learn more on ToyyibPay
      </a>
    </div>
  );

  // ── Root ───────────────────────────────────────────────────────────────────
  return (
    <div className={embedded ? 'space-y-4' : 'space-y-5 max-w-5xl mx-auto py-4 px-3 md:py-6 md:px-4'}>

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={`font-black text-slate-900 ${embedded ? 'text-base' : 'text-lg md:text-xl'}`}>
            ToyyibPay Integration
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Payment gateway management</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
            Sandbox
          </span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full border border-slate-200"
            onClick={() => setShowSettings(v => !v)} title="Settings">
            <Settings size={14} className={showSettings ? 'text-jci-blue' : 'text-slate-500'} />
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <Tabs
        tabs={TABS.map(t => ({ id: t.key, label: t.label }))}
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab as typeof activeTab); setShowSettings(false); }}
      />

      {/* Content */}
      <div>
        {showSettings ? renderSettings() : (
          <>
            {activeTab === 'category' && renderCategories()}
            {activeTab === 'bill' && renderBills()}
            {activeTab === 'settlement' && renderSettlement()}
          </>
        )}
      </div>

      <ToyyibCategoryModals
        isImportModalOpen={isImportModalOpen}
        importCode={importCode}
        isImporting={isImporting}
        detailsCat={detailsCat}
        linkCat={linkCat}
        linkType={linkType}
        linkMembershipType={linkMembershipType}
        linkProjectId={linkProjectId}
        projects={projects}
        isSavingLink={isSavingLink}
        onCloseImport={() => { setIsImportModalOpen(false); setImportCode(''); }}
        onImportCodeChange={setImportCode}
        onImport={handleImport}
        onCloseDetails={() => setDetailsCat(null)}
        onCloseLink={() => setLinkCat(null)}
        onLinkTypeChange={setLinkType}
        onLinkMembershipTypeChange={setLinkMembershipType}
        onLinkProjectIdChange={setLinkProjectId}
        onSaveLink={handleSaveLink}
      />
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div>
  );
};
