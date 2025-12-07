import React, { useState } from 'react';
import { Calendar, MapPin, Users, Filter, Plus, Clock, BrainCircuit } from 'lucide-react';
import { Card, Button, Badge, Tabs } from '../ui/Common';
import { MOCK_EVENTS } from '../../services/mockData';
import { Event } from '../../types';

export const EventsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Upcoming');

  const filteredEvents = MOCK_EVENTS.filter(e => 
    activeTab === 'All' ? true : e.status === activeTab
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Events Management</h2>
          <p className="text-slate-500">Plan, track, and analyze LO activities.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline"><Calendar size={16} className="mr-2"/> Calendar View</Button>
            <Button><Plus size={16} className="mr-2"/> Create Event</Button>
        </div>
      </div>

      <Card noPadding>
        <div className="px-6">
          <Tabs 
            tabs={['Upcoming', 'Completed', 'Cancelled', 'All']} 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
          />
        </div>
        
        <div className="divide-y divide-slate-100">
            {filteredEvents.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                    No events found in this category.
                </div>
            ) : (
                filteredEvents.map(event => (
                    <EventRow key={event.id} event={event} />
                ))
            )}
        </div>
      </Card>
    </div>
  );
};

const EventRow: React.FC<{ event: Event }> = ({ event }) => {
    const date = new Date(event.date);
    
    return (
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 hover:bg-slate-50 transition-colors">
            {/* Date Box */}
            <div className="flex-shrink-0 w-16 h-16 bg-blue-50 text-jci-blue rounded-xl flex flex-col items-center justify-center border border-blue-100">
                <span className="text-xs font-bold uppercase tracking-wider">{date.toLocaleString('default', { month: 'short' })}</span>
                <span className="text-2xl font-bold leading-none">{date.getDate()}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="neutral">{event.type}</Badge>
                    {event.predictedDemand === 'High' && (
                        <Badge variant="jci"><BrainCircuit size={10} className="mr-1 inline"/> High Demand AI</Badge>
                    )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{event.title}</h3>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <MapPin size={14} />
                        <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Users size={14} />
                        <span>{event.attendees} / {event.maxAttendees || '∞'} registered</span>
                    </div>
                </div>
            </div>

            {/* Action */}
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">Manage</Button>
                {event.status === 'Upcoming' && <Button size="sm">Check-in</Button>}
            </div>
        </div>
    )
}
