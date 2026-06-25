import React, { useState } from 'react';
import { Tabs } from '../ui/Common';
import { EventsView } from './EventsView';
import { ProjectsView } from './ProjectsView';
import { ActivityPlansView } from './ActivityPlansView';

/**
 * Unified view for Activities & Projects
 * Combines Activity Plans, Events, and Projects into a single interface
 * 
 * This unified view allows users to:
 * - Manage activity plan proposals (Draft → Submit → Review → Approved)
 * - Create and manage events (one-time activities with registration)
 * - Track long-term projects (with tasks, budget, and team management)
 * 
 * All three are related in the workflow:
 * Activity Plan (proposal) → Event (execution) → Project (long-term)
 */
export const ActivitiesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'plans' | 'events' | 'projects'>('plans');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Activities & Projects</h2>
          <p className="text-slate-500">Manage proposals, events, and long-term projects in one place.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 md:px-6 pt-4 border-b border-slate-200">
          <Tabs
            tabs={['Activity Plans', 'Events', 'Projects']}
            activeTab={
              activeTab === 'plans' ? 'Activity Plans' :
                activeTab === 'events' ? 'Events' : 'Projects'
            }
            onTabChange={(tab) => {
              if (tab === 'Activity Plans') setActiveTab('plans');
              else if (tab === 'Events') setActiveTab('events');
              else setActiveTab('projects');
            }}
          />
        </div>

        <div>
          {activeTab === 'plans' && <ActivityPlansView />}
          {activeTab === 'events' && <EventsView />}
          {activeTab === 'projects' && <ProjectsView />}
        </div>
      </div>
    </div>
  );
};

