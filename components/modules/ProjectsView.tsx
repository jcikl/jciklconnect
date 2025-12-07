import React, { useState } from 'react';
import { Settings, Zap, Layout, Kanban, Plus, UserCircle, FileText, Calendar, DollarSign } from 'lucide-react';
import { Button, Card, Badge, ProgressBar, Modal } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { MOCK_PROJECTS, MOCK_TASKS } from '../../services/mockData';
import { Project } from '../../types';

export const ProjectsView: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProposalModalOpen, setProposalModalOpen] = useState(false);
  
  const selectedProject = MOCK_PROJECTS.find(p => p.id === selectedProjectId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          {selectedProject ? (
              <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedProjectId(null)} className="text-slate-400 hover:text-slate-600 text-sm">Projects /</button>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedProject.name}</h2>
              </div>
          ) : (
             <>
                <h2 className="text-2xl font-bold text-slate-900">Active Projects</h2>
                <p className="text-slate-500">Track progress, budget, and team performance.</p>
             </>
          )}
        </div>
        <div className="flex gap-2">
            {!selectedProject && <Button onClick={() => setProposalModalOpen(true)}><Plus size={16} className="mr-2"/> New Proposal</Button>}
            {selectedProject && <Button variant="outline"><Settings size={16}/> Settings</Button>}
        </div>
      </div>

      {!selectedProject ? (
        <ProjectGrid onSelect={setSelectedProjectId} onNewProposal={() => setProposalModalOpen(true)} />
      ) : (
        <ProjectKanban projectId={selectedProject.id} />
      )}

      {/* Plan of Action Modal */}
      <Modal isOpen={isProposalModalOpen} onClose={() => setProposalModalOpen(false)} title="Submit Activity Plan (JCI Plan of Action)">
            <div className="space-y-4">
                <p className="text-sm text-slate-500 mb-4 bg-blue-50 p-3 rounded text-blue-800">
                    This form follows the standard JCI Planning Framework. Once submitted, it will be reviewed by the Board.
                </p>
                
                <div className="space-y-4">
                    <Input label="Project Name" placeholder="e.g. Summer Leadership Summit" icon={<FileText size={16}/>} />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Type" options={[
                            {label: 'Community', value: 'community'},
                            {label: 'Business', value: 'business'},
                            {label: 'Individual', value: 'individual'},
                            {label: 'International', value: 'international'}
                        ]} />
                        <Input label="Proposed Date" type="date" icon={<Calendar size={16}/>} />
                    </div>

                    <Input label="Proposed Budget ($)" type="number" placeholder="5000" icon={<DollarSign size={16}/>} />

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Objectives & Impact</label>
                        <textarea className="w-full border-slate-300 rounded-lg shadow-sm focus:border-jci-blue focus:ring-jci-blue sm:text-sm p-3 border h-24" placeholder="Describe the goals and expected community impact..."></textarea>
                    </div>

                    <div className="pt-4 flex gap-3">
                         <Button className="flex-1" onClick={() => setProposalModalOpen(false)}>Submit for Approval</Button>
                         <Button variant="ghost" onClick={() => setProposalModalOpen(false)}>Save Draft</Button>
                    </div>
                </div>
            </div>
      </Modal>
    </div>
  )
}

const ProjectGrid: React.FC<{ onSelect: (id: string) => void, onNewProposal: () => void }> = ({ onSelect, onNewProposal }) => (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {MOCK_PROJECTS.map(project => (
          <Card key={project.id} className="flex flex-col h-full cursor-pointer hover:border-jci-blue transition-colors group" onClick={() => onSelect(project.id)}>
             {/* Wrapper div to capture click event but stop propagation on buttons if needed */}
             <div className="pointer-events-none">
                <div className="flex justify-between items-start mb-4">
                <Badge variant={project.status === 'Active' ? 'success' : 'info'}>{project.status}</Badge>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-jci-blue transition-colors">{project.name}</h3>
                <p className="text-sm text-slate-500 mb-6">{project.description || `Lead: ${project.lead}`}</p>
                
                <div className="space-y-4 mb-6 flex-1">
                <div>
                    <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Completion</span>
                    <span className="font-medium text-slate-900">{project.completion}%</span>
                    </div>
                    <ProgressBar progress={project.completion} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg">
                    <span className="text-xs text-slate-500 block">Budget Used</span>
                    <span className="font-semibold text-slate-900">${project.spent} / ${project.budget}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                    <span className="text-xs text-slate-500 block">Team Size</span>
                    <span className="font-semibold text-slate-900">{project.teamSize} Members</span>
                    </div>
                </div>
                </div>
             </div>
             
             <div className="border-t border-slate-100 pt-4 mt-auto">
                <Button variant="outline" className="w-full text-sm" onClick={() => onSelect(project.id)}>Open Board</Button>
             </div>
          </Card>
        ))}
         <button onClick={onNewProposal} className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:border-jci-blue hover:text-jci-blue hover:bg-sky-50 transition-colors h-full min-h-[300px]">
           <Zap size={32} className="mb-3" />
           <span className="font-medium">Start New Project</span>
           <span className="text-xs mt-1">or submit an activity plan</span>
        </button>
    </div>
)

const ProjectKanban: React.FC<{ projectId: string }> = ({ projectId }) => {
    const tasks = MOCK_TASKS.filter(t => t.projectId === projectId);
    const columns = ['Todo', 'In Progress', 'Done'];

    return (
        <div className="flex gap-6 overflow-x-auto pb-6">
            {columns.map(col => (
                <div key={col} className="w-80 flex-shrink-0 flex flex-col bg-slate-100 rounded-xl max-h-[600px]">
                    <div className="p-4 font-bold text-slate-700 flex justify-between items-center">
                        {col}
                        <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                            {tasks.filter(t => t.status === col).length}
                        </span>
                    </div>
                    <div className="p-3 space-y-3 overflow-y-auto flex-1">
                        {tasks.filter(t => t.status === col).map(task => (
                            <div key={task.id} className="bg-white p-3 rounded shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${task.priority === 'High' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{task.priority}</span>
                                    <span className="text-[10px] text-slate-400">{new Date(task.dueDate).toLocaleDateString()}</span>
                                </div>
                                <h4 className="text-sm font-medium text-slate-800 mb-3">{task.title}</h4>
                                <div className="flex justify-end">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500" title={task.assignee}>
                                        {task.assignee.charAt(0)}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm border border-dashed border-slate-300 rounded hover:bg-white transition-colors">
                            + Add Task
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}