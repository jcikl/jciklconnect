import React from 'react';
import { Package, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, Button, Badge } from '../ui/Common';
import { MOCK_INVENTORY } from '../../services/mockData';

export const InventoryView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Asset & Inventory</h2>
          <p className="text-slate-500">Track physical assets, locations, and custodians.</p>
        </div>
        <Button>Add New Item</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 border-blue-100">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-lg text-blue-600 shadow-sm"><Package size={24}/></div>
                <div>
                    <p className="text-sm text-blue-600 font-medium">Total Assets</p>
                    <h3 className="text-2xl font-bold text-slate-900">{MOCK_INVENTORY.length}</h3>
                </div>
            </div>
        </Card>
        <Card className="bg-green-50 border-green-100">
            <div className="flex items-center gap-4">
                 <div className="p-3 bg-white rounded-lg text-green-600 shadow-sm"><CheckCircle size={24}/></div>
                <div>
                    <p className="text-sm text-green-600 font-medium">Available</p>
                    <h3 className="text-2xl font-bold text-slate-900">{MOCK_INVENTORY.filter(i => i.status === 'Available').length}</h3>
                </div>
            </div>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
            <div className="flex items-center gap-4">
                 <div className="p-3 bg-white rounded-lg text-amber-600 shadow-sm"><AlertCircle size={24}/></div>
                <div>
                    <p className="text-sm text-amber-600 font-medium">Action Needed</p>
                    <h3 className="text-2xl font-bold text-slate-900">{MOCK_INVENTORY.filter(i => i.status !== 'Available').length}</h3>
                </div>
            </div>
        </Card>
      </div>

      <Card title="Asset Registry" action={
          <div className="relative">
              <Search className="absolute left-2 top-1.5 text-slate-400" size={16} />
              <input type="text" placeholder="Search..." className="pl-8 py-1 text-sm border rounded-md" />
          </div>
      }>
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Custodian</th>
                    <th className="py-3 px-4 text-right">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {MOCK_INVENTORY.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                        <td className="py-3 px-4 text-slate-500">{item.category}</td>
                        <td className="py-3 px-4 text-slate-500">{item.location}</td>
                        <td className="py-3 px-4">
                            <Badge variant={item.status === 'Available' ? 'success' : item.status === 'Out of Stock' ? 'error' : 'warning'}>
                                {item.status}
                            </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{item.custodian || '-'}</td>
                        <td className="py-3 px-4 text-right">
                            <Button variant="ghost" size="sm">Edit</Button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </Card>
    </div>
  );
};