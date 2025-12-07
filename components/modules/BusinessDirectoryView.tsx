import React, { useState } from 'react';
import { Building2, Globe, ExternalLink, Search, Mail, Send, Plus } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { MOCK_BUSINESSES, MOCK_MEMBERS } from '../../services/mockData';
import { BusinessProfile } from '../../types';

export const BusinessDirectoryView: React.FC = () => {
  const [businesses, setBusinesses] = useState<BusinessProfile[]>(MOCK_BUSINESSES);
  const [selectedBiz, setSelectedBiz] = useState<BusinessProfile | null>(null);
  const [isListModalOpen, setListModalOpen] = useState(false);
  const { showToast } = useToast();

  const handleListBusiness = (e: React.FormEvent) => {
      e.preventDefault();
      const newBiz: BusinessProfile = {
          id: `bp${Date.now()}`,
          memberId: 'u1',
          companyName: 'New Business',
          industry: 'Other',
          description: 'A new listing.',
          website: 'www.example.com',
          offer: '10% off for JCI',
          logo: 'https://placehold.co/100?text=Logo'
      };
      setBusinesses([...businesses, newBiz]);
      setListModalOpen(false);
      showToast('Business listed successfully', 'success');
  }

  const handleContact = () => {
      setSelectedBiz(null);
      showToast('Inquiry sent to owner', 'success');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Member Business Directory</h2>
          <p className="text-slate-500">Support local member businesses and partners.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input type="text" placeholder="Search services..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
             </div>
            <Button onClick={() => setListModalOpen(true)}><Plus size={16} className="mr-2"/> List My Business</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.map(biz => {
            const owner = MOCK_MEMBERS.find(m => m.id === biz.memberId);
            return (
                <div key={biz.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
                    <div className="h-24 bg-gradient-to-r from-slate-100 to-slate-200 relative">
                        <div className="absolute -bottom-6 left-6 w-16 h-16 bg-white rounded-lg border border-slate-200 p-1">
                            <img src={biz.logo} alt="Logo" className="w-full h-full object-cover rounded" />
                        </div>
                        <div className="absolute top-4 right-4">
                            <Badge variant="neutral">{biz.industry}</Badge>
                        </div>
                    </div>
                    <div className="pt-8 px-6 pb-6 flex-1 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900">{biz.companyName}</h3>
                        <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                            Owned by <span className="font-medium text-jci-blue">{owner?.name || 'Unknown'}</span>
                        </p>
                        <p className="text-sm text-slate-600 mb-4 flex-1">{biz.description}</p>
                        
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">JCI Member Deal</span>
                            <p className="text-sm font-medium text-blue-900">{biz.offer}</p>
                        </div>

                        <div className="flex gap-2 mt-auto">
                            <Button variant="outline" size="sm" className="flex-1"><Globe size={14} className="mr-2"/> Website</Button>
                            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setSelectedBiz(biz)}>Contact</Button>
                        </div>
                    </div>
                </div>
            )
        })}
      </div>

      <Modal isOpen={!!selectedBiz} onClose={() => setSelectedBiz(null)} title={`Contact ${selectedBiz?.companyName}`}>
          <div className="space-y-4">
              <p className="text-sm text-slate-600">
                  Connect with this business directly. Mention you are a JCI member to redeem the special offer: 
                  <span className="font-bold text-slate-900 ml-1">{selectedBiz?.offer}</span>
              </p>
              
              <Input label="Subject" placeholder="Inquiry about services..." />
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
                  <textarea className="w-full border-slate-300 rounded-lg shadow-sm focus:border-jci-blue focus:ring-jci-blue sm:text-sm p-3 border h-32" placeholder="Hi, I'm interested in..." defaultValue={`Hi, I'm a fellow JCI member and interested in...`}></textarea>
              </div>

              <div className="pt-2">
                  <Button className="w-full" onClick={handleContact}>
                      <Send size={16} className="mr-2"/> Send Inquiry
                  </Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isListModalOpen} onClose={() => setListModalOpen(false)} title="List Your Business">
          <form onSubmit={handleListBusiness} className="space-y-4">
              <Input label="Company Name" required />
              <div className="grid grid-cols-2 gap-4">
                  <Select label="Industry" options={[
                      {label:'Consulting', value:'Consulting'},
                      {label:'Events', value:'Events'},
                      {label:'Retail', value:'Retail'},
                      {label:'Technology', value:'Technology'}
                  ]} />
                  <Input label="Website" placeholder="https://" />
              </div>
              <Input label="Description" placeholder="What do you do?" />
              <Input label="JCI Member Deal" placeholder="e.g. 15% discount" required />
              <div className="pt-4">
                  <Button className="w-full" type="submit">Submit Listing</Button>
              </div>
          </form>
      </Modal>
    </div>
  );
};