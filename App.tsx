import React, { useState } from 'react';
import { 
  Users, Calendar, LayoutDashboard, Briefcase, 
  LogOut, Award, Sparkles, TrendingUp, 
  Menu, Bell, Search, AlertTriangle, Package, Building2, Workflow,
  MessageSquare, BookOpen, Heart, Vote, CheckSquare, Check, X
} from 'lucide-react';
import { Button, Card, Badge, StatCard, Modal, Drawer, ToastProvider, useToast } from './components/ui/Common';
import * as Forms from './components/ui/Form';
import { MemberGrowthChart, PointsDistributionChart } from './components/dashboard/Analytics';
import { MOCK_STATS, CURRENT_USER, MOCK_EVENTS, MOCK_NOTIFICATIONS } from './services/mockData';
import { UserRole, Notification } from './types';

// Module Imports
import { FinanceView } from './components/modules/FinanceView';
import { GamificationView } from './components/modules/GamificationView';
import { EventsView } from './components/modules/EventsView';
import { MembersView } from './components/modules/MembersView';
import { ProjectsView } from './components/modules/ProjectsView';
import { InventoryView } from './components/modules/InventoryView';
import { BusinessDirectoryView } from './components/modules/BusinessDirectoryView';
import { AutomationStudio } from './components/modules/AutomationStudio';
import { KnowledgeView } from './components/modules/KnowledgeView';
import { CommunicationView } from './components/modules/CommunicationView';
import { HobbyClubsView } from './components/modules/HobbyClubsView';
import { GovernanceView } from './components/modules/GovernanceView';
import { SurveysView } from './components/modules/SurveysView';

// --- View Definitions ---
type ViewType = 'GUEST' | 'DASHBOARD' | 'MEMBERS' | 'EVENTS' | 'PROJECTS' | 'FINANCE' | 'GAMIFICATION' | 'INVENTORY' | 'DIRECTORY' | 'AUTOMATION' | 'KNOWLEDGE' | 'COMMUNICATION' | 'CLUBS' | 'GOVERNANCE' | 'SURVEYS';

// --- Helper Components ---

const SidebarItem = ({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
      isActive 
        ? 'bg-jci-blue text-white shadow-md' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const GuestLandingPage = ({ onLogin, onRegister }: { onLogin: () => void, onRegister: () => void }) => (
  <div className="min-h-screen bg-slate-50">
    {/* Header */}
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-jci-blue rounded-lg flex items-center justify-center text-white font-bold text-xl">N</div>
          <span className="text-2xl font-bold text-slate-900">JCI Nexus</span>
        </div>
        <nav className="hidden md:flex space-x-8">
          <a href="#" className="text-slate-600 hover:text-jci-blue font-medium">Events</a>
          <a href="#" className="text-slate-600 hover:text-jci-blue font-medium">Projects</a>
          <a href="#" className="text-slate-600 hover:text-jci-blue font-medium">About</a>
        </nav>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onLogin}>Log In</Button>
          <Button onClick={onRegister}>Join Us</Button>
        </div>
      </div>
    </header>

    {/* Hero */}
    <section className="relative bg-jci-navy py-32 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900 opacity-20"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
          Be Better. <span className="text-jci-lightblue">Do Better.</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
          Join a global network of young active citizens creating positive change. 
          Manage your growth, connect with mentors, and lead impactful projects.
        </p>
        <div className="flex justify-center gap-4">
          <Button size="lg" onClick={onRegister}>Become a Member</Button>
          <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-jci-navy">
            View Activity Calendar
          </Button>
        </div>
      </div>
    </section>
  </div>
);

// --- Authenticated Dashboard Views ---

const DashboardHome = ({ userRole, onOpenNotifications }: { userRole: UserRole, onOpenNotifications: () => void }) => {
  const { showToast } = useToast();

  const handleResolve = (id: string) => {
      showToast('Notification resolved', 'success');
  }

  return (
    <div className="space-y-6">
      {/* AI Insight Header */}
      <div className="bg-gradient-to-r from-jci-navy to-jci-blue rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Sparkles className="text-yellow-400" size={20} />
              <span className="font-semibold text-yellow-100 uppercase text-xs tracking-wider">AI Insight</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Good afternoon, {CURRENT_USER.name}!</h2>
            <p className="text-blue-100 max-w-xl">
              Based on your recent activity, we recommend joining the <strong>Youth Mentorship 2024</strong> project team. 
              Your leadership skills are a 95% match.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
              <p className="text-sm text-blue-100 mb-1">Current Tier</p>
              <div className="flex items-center space-x-2">
                <Award className="text-yellow-400" size={24} />
                <span className="text-2xl font-bold">{CURRENT_USER.tier}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Points" 
          value={CURRENT_USER.points.toLocaleString()} 
          icon={<Award size={20} />} 
          trend={12}
          subtext="Top 15% of members"
        />
        <StatCard 
          title="Events Attended" 
          value={MOCK_STATS.upcomingEvents + 12} 
          icon={<Calendar size={20} />} 
          subtext="Last 6 months"
        />
        <StatCard 
          title="Project Tasks" 
          value="8 Pending" 
          icon={<Briefcase size={20} />} 
          subtext="2 Due Today"
        />
        <StatCard 
          title="Network Growth" 
          value="+4 New" 
          icon={<Users size={20} />} 
          subtext="Connections this week"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {userRole === UserRole.BOARD && (
             <MemberGrowthChart />
          )}
          
          <Card title="Priority Actions (Automated)" className="border-l-4 border-l-amber-500">
            <div className="space-y-4">
              {MOCK_NOTIFICATIONS.filter(n => !n.read).map(note => (
                <div key={note.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    {note.type === 'ai' ? <Sparkles size={18} className="text-purple-500 mt-1" /> : <AlertTriangle size={18} className="text-amber-500 mt-1" />}
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">{note.title}</h4>
                      <p className="text-sm text-slate-600">{note.message}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => onOpenNotifications()}>Resolve</Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <PointsDistributionChart />
          
          <Card title="Upcoming Events">
            <div className="space-y-4">
              {MOCK_EVENTS.slice(0, 3).map(event => (
                <div key={event.id} className="flex items-center space-x-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex flex-col items-center justify-center text-jci-blue flex-shrink-0">
                    <span className="text-xs font-bold uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-lg font-bold leading-none">{new Date(event.date).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 truncate">{event.title}</h4>
                    <p className="text-xs text-slate-500">{event.type} • {event.attendees} Attending</p>
                  </div>
                  {event.predictedDemand === 'High' && (
                    <Badge variant="jci">Hot</Badge>
                  )}
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-sm">View Calendar</Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

const NotificationDrawer: React.FC<{ isOpen: boolean, onClose: () => void, notifications: Notification[] }> = ({ isOpen, onClose, notifications: initialNotifications }) => {
    const { showToast } = useToast();
    const [notifications, setNotifications] = useState(initialNotifications.filter(n => !n.read));

    const handleAction = (id: string, type: string) => {
        setNotifications(notifications.filter(n => n.id !== id));
        showToast(type === 'dismiss' ? 'Notification dismissed' : 'Action taken successfully', type === 'dismiss' ? 'info' : 'success');
    }
    
    const handleClearAll = () => {
      setNotifications([]);
      showToast('All notifications cleared', 'info');
    }

    return (
        <Drawer isOpen={isOpen} onClose={onClose} title="Action Center">
            <div className="space-y-4">
                <div className="flex justify-between items-center text-xs text-slate-500 uppercase font-bold tracking-wider">
                    <span>Pending Items</span>
                    <button onClick={handleClearAll} className="text-jci-blue hover:underline">Clear All</button>
                </div>
                
                {notifications.map(note => (
                    <div key={note.id} className="p-4 border border-slate-200 rounded-lg shadow-sm bg-white hover:border-jci-blue transition-colors">
                        <div className="flex items-start gap-3 mb-3">
                            <div className={`p-2 rounded-full flex-shrink-0 ${note.type === 'ai' ? 'bg-purple-100 text-purple-600' : note.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                {note.type === 'ai' ? <Sparkles size={16}/> : note.type === 'warning' ? <AlertTriangle size={16}/> : <Bell size={16}/>}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900">{note.title}</h4>
                                <p className="text-xs text-slate-500">{note.timestamp}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">{note.message}</p>
                        
                        <div className="flex gap-2">
                            <Button size="sm" className="flex-1 text-xs h-8" onClick={() => handleAction(note.id, 'act')}><Check size={14} className="mr-1"/> Approve/Act</Button>
                            <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => handleAction(note.id, 'dismiss')}><X size={14} className="mr-1"/> Dismiss</Button>
                        </div>
                    </div>
                ))}

                {notifications.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-20" />
                        <p>No new notifications.</p>
                    </div>
                )}
            </div>
        </Drawer>
    )
}

// --- Main App Shell ---

const NexusApp: React.FC = () => {
  const [view, setView] = useState<ViewType>('GUEST');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  
  // Simulation State
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.BOARD);
  const { showToast } = useToast();

  const handleLogin = () => {
    setView('DASHBOARD');
    showToast('Login successful. Welcome back!', 'success');
  };

  const handleLogout = () => {
    setView('GUEST');
  };

  const openRegistration = () => setRegisterModalOpen(true);
  const closeRegistration = () => setRegisterModalOpen(false);

  // Conditional Rendering Helper
  if (view === 'GUEST') {
    return (
      <>
        <GuestLandingPage onLogin={handleLogin} onRegister={openRegistration} />
        <Modal isOpen={isRegisterModalOpen} onClose={closeRegistration} title="Join JCI Nexus">
             <div className="space-y-4">
                <p className="text-sm text-slate-500 mb-4">Complete your profile to start your journey of impact.</p>
                <div className="grid grid-cols-2 gap-4">
                    <Forms.Input label="First Name" placeholder="Jane" />
                    <Forms.Input label="Last Name" placeholder="Doe" />
                </div>
                <Forms.Input label="Email Address" placeholder="jane@example.com" type="email" />
                <Forms.Select label="Area of Interest" options={[
                    {label: 'Select...', value: ''},
                    {label: 'Community Projects', value: 'projects'},
                    {label: 'Business Networking', value: 'business'},
                    {label: 'Personal Growth', value: 'growth'}
                ]} />
                <div className="pt-4">
                    <Button className="w-full" onClick={() => { closeRegistration(); handleLogin(); }}>Submit Application</Button>
                    <p className="text-xs text-center mt-2 text-slate-400">By clicking submit, you agree to our Code of Ethics.</p>
                </div>
             </div>
        </Modal>
      </>
    );
  }

  const renderCurrentView = () => {
    switch (view) {
      case 'MEMBERS': return <MembersView />;
      case 'PROJECTS': return <ProjectsView />;
      case 'EVENTS': return <EventsView />;
      case 'FINANCE': return <FinanceView />;
      case 'GAMIFICATION': return <GamificationView />;
      case 'INVENTORY': return <InventoryView />;
      case 'DIRECTORY': return <BusinessDirectoryView />;
      case 'AUTOMATION': return <AutomationStudio />;
      case 'KNOWLEDGE': return <KnowledgeView />;
      case 'COMMUNICATION': return <CommunicationView />;
      case 'CLUBS': return <HobbyClubsView />;
      case 'GOVERNANCE': return <GovernanceView />;
      case 'SURVEYS': return <SurveysView />;
      default: return <DashboardHome userRole={activeRole} onOpenNotifications={() => setNotificationDrawerOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
             <div className="w-8 h-8 bg-jci-blue rounded-lg flex items-center justify-center text-white font-bold mr-3 shadow-sm">N</div>
             <span className="text-xl font-bold text-slate-900 tracking-tight">JCI Nexus</span>
          </div>

          {/* User Snippet */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
             <div className="flex items-center space-x-3">
               <img src={CURRENT_USER.avatar} alt="User" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
               <div className="min-w-0">
                 <p className="text-sm font-semibold text-slate-900 truncate">{CURRENT_USER.name}</p>
                 <p className="text-xs text-slate-500 truncate">{activeRole}</p>
               </div>
             </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <SidebarItem 
              icon={<LayoutDashboard size={18} />} 
              label="Dashboard" 
              isActive={view === 'DASHBOARD'} 
              onClick={() => { setView('DASHBOARD'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<Users size={18} />} 
              label="Members" 
              isActive={view === 'MEMBERS'} 
              onClick={() => { setView('MEMBERS'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<MessageSquare size={18} />} 
              label="Communication" 
              isActive={view === 'COMMUNICATION'} 
              onClick={() => { setView('COMMUNICATION'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<Briefcase size={18} />} 
              label="Projects" 
              isActive={view === 'PROJECTS'} 
              onClick={() => { setView('PROJECTS'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<Calendar size={18} />} 
              label="Events" 
              isActive={view === 'EVENTS'} 
              onClick={() => { setView('EVENTS'); setIsSidebarOpen(false); }} 
            />
             <SidebarItem 
              icon={<Building2 size={18} />} 
              label="Directory" 
              isActive={view === 'DIRECTORY'} 
              onClick={() => { setView('DIRECTORY'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<BookOpen size={18} />} 
              label="Knowledge" 
              isActive={view === 'KNOWLEDGE'} 
              onClick={() => { setView('KNOWLEDGE'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={<Heart size={18} />} 
              label="Hobby Clubs" 
              isActive={view === 'CLUBS'} 
              onClick={() => { setView('CLUBS'); setIsSidebarOpen(false); }} 
            />
            
            <div className="pt-4 mt-4 border-t border-slate-100">
              <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Workspace</p>
              
               <SidebarItem 
                  icon={<Vote size={18} />} 
                  label="Governance" 
                  isActive={view === 'GOVERNANCE'} 
                  onClick={() => { setView('GOVERNANCE'); setIsSidebarOpen(false); }} 
              />
               <SidebarItem 
                  icon={<CheckSquare size={18} />} 
                  label="Surveys" 
                  isActive={view === 'SURVEYS'} 
                  onClick={() => { setView('SURVEYS'); setIsSidebarOpen(false); }} 
              />
              
              {activeRole === UserRole.BOARD && (
                <>
                <SidebarItem 
                    icon={<TrendingUp size={18} />} 
                    label="Finances" 
                    isActive={view === 'FINANCE'} 
                    onClick={() => { setView('FINANCE'); setIsSidebarOpen(false); }} 
                />
                 <SidebarItem 
                    icon={<Package size={18} />} 
                    label="Inventory" 
                    isActive={view === 'INVENTORY'} 
                    onClick={() => { setView('INVENTORY'); setIsSidebarOpen(false); }} 
                />
                 <SidebarItem 
                    icon={<Workflow size={18} />} 
                    label="Automation" 
                    isActive={view === 'AUTOMATION'} 
                    onClick={() => { setView('AUTOMATION'); setIsSidebarOpen(false); }} 
                />
                </>
              )}
              <SidebarItem 
                icon={<Award size={18} />} 
                label="Gamification" 
                isActive={view === 'GAMIFICATION'} 
                onClick={() => { setView('GAMIFICATION'); setIsSidebarOpen(false); }} 
              />
            </div>
          </nav>

          {/* Footer Actions & Dev Tools */}
          <div className="p-4 border-t border-slate-100 space-y-2">
            {/* Role Switcher for Demo */}
            <div className="bg-slate-100 p-2 rounded-lg mb-2">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 text-center">Dev: Role Simulator</p>
                <div className="flex bg-white rounded-md p-0.5 shadow-sm">
                    <button 
                        onClick={() => setActiveRole(UserRole.MEMBER)}
                        className={`flex-1 text-xs py-1 rounded ${activeRole === UserRole.MEMBER ? 'bg-jci-blue text-white shadow-sm' : 'text-slate-500'}`}
                    >Member</button>
                    <button 
                         onClick={() => setActiveRole(UserRole.BOARD)}
                        className={`flex-1 text-xs py-1 rounded ${activeRole === UserRole.BOARD ? 'bg-jci-navy text-white shadow-sm' : 'text-slate-500'}`}
                    >Board</button>
                </div>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
            >
              <LogOut size={18} />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-30 shadow-sm">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <Menu size={24} />
          </button>

          {/* Search */}
          <div className="hidden md:flex items-center relative max-w-md w-full ml-4">
             <Search className="absolute left-3 text-slate-400" size={18} />
             <input 
               type="text" 
               placeholder="Search members, projects, or docs..." 
               className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-jci-blue focus:border-transparent outline-none transition-all text-sm"
             />
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
                onClick={() => setNotificationDrawerOpen(true)}
                className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Bell size={20} />
              {MOCK_NOTIFICATIONS.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <div 
                className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-sky-50 text-jci-blue rounded-full text-sm font-medium cursor-pointer hover:bg-sky-100 transition-colors"
                onClick={() => setView('GAMIFICATION')}
            >
              <Award size={16} />
              <span>{CURRENT_USER.points} Pts</span>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
           <div className="max-w-7xl mx-auto">
             {renderCurrentView()}
           </div>
        </div>
      </main>

      <NotificationDrawer 
        isOpen={isNotificationDrawerOpen} 
        onClose={() => setNotificationDrawerOpen(false)} 
        notifications={MOCK_NOTIFICATIONS}
      />
    </div>
  );
}

const App: React.FC = () => {
  return (
    <ToastProvider>
      <NexusApp />
    </ToastProvider>
  );
}

export default App;
