import React, { useState } from 'react';
import { DollarSign, PieChart, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, FileText, Plus, X } from 'lucide-react';
import { Card, Button, Badge, ProgressBar, StatCard, Modal, useToast } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { MOCK_STATS, MOCK_TRANSACTIONS, MOCK_ACCOUNTS } from '../../services/mockData';
import { Transaction } from '../../types';

export const FinanceView: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showToast } = useToast();

  const handleAddTransaction = (e: React.FormEvent) => {
      e.preventDefault();
      const newTx: Transaction = {
          id: `t${Date.now()}`,
          date: new Date().toISOString(),
          description: 'New Entry',
          amount: 150,
          type: 'Income',
          category: 'Admin',
          status: 'Cleared'
      };
      // In a real app, we'd gather form data here. For mock:
      setTransactions([newTx, ...transactions]);
      setIsModalOpen(false);
      showToast('Transaction recorded successfully', 'success');
  };

  const handleSendReminders = () => {
      showToast('32 Payment reminders sent via Email & Push', 'success');
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Management</h2>
          <p className="text-slate-500">Automated bookkeeping, dues collection, and budgeting.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline"><FileText size={16} className="mr-2"/> Reports</Button>
            <Button onClick={() => setIsModalOpen(true)}><DollarSign size={16} className="mr-2"/> New Transaction</Button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            title="Total Cash on Hand" 
            value={`$${MOCK_ACCOUNTS.reduce((acc, curr) => acc + curr.balance, 0).toLocaleString()}`} 
            icon={<DollarSign size={20}/>}
            subtext="Across all accounts"
        />
        <StatCard 
            title="Dues Collected (2024)" 
            value={`${MOCK_STATS.duesCollectedPercentage}%`} 
            icon={<RefreshCw size={20}/>}
            subtext="Automated renewal active"
            trend={15}
        />
        <StatCard 
            title="Pending Expenses" 
            value="$450.00" 
            icon={<AlertCircle size={20}/>}
            subtext="3 approvals needed"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content: Transactions */}
        <div className="lg:col-span-2 space-y-6">
            <Card title="Recent Transactions" action={<Button variant="ghost" size="sm">View All</Button>}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="pb-3 font-semibold pl-2">Date</th>
                                <th className="pb-3 font-semibold">Description</th>
                                <th className="pb-3 font-semibold">Category</th>
                                <th className="pb-3 font-semibold text-right pr-2">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {transactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-50">
                                    <td className="py-3 pl-2 text-slate-500">{new Date(tx.date).toLocaleDateString()}</td>
                                    <td className="py-3 font-medium text-slate-900">
                                        {tx.description}
                                        {tx.status === 'Pending' && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-400"></span>}
                                    </td>
                                    <td className="py-3">
                                        <Badge variant="neutral">{tx.category}</Badge>
                                    </td>
                                    <td className={`py-3 text-right pr-2 font-mono font-medium ${tx.type === 'Income' ? 'text-green-600' : 'text-slate-900'}`}>
                                        {tx.type === 'Income' ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Automated Dues Section */}
            <Card title="Membership Dues Automation">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-jci-blue">
                        <RefreshCw size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900">Annual Renewal Cycle (2024)</h4>
                        <p className="text-sm text-slate-500">Automated invoices sent to 142 members.</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <ProgressBar progress={MOCK_STATS.duesCollectedPercentage} label="Collection Progress" />
                    <p className="text-xs text-slate-500 text-right">Target: $18,000 / Collected: $14,040</p>
                </div>
                <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSendReminders}>Send Reminders (32)</Button>
                    <Button variant="outline" size="sm">Configure Settings</Button>
                </div>
            </Card>
        </div>

        {/* Sidebar: Accounts */}
        <div className="space-y-6">
            <Card title="Bank Accounts">
                <div className="space-y-4">
                    {MOCK_ACCOUNTS.map(acc => (
                        <div key={acc.id} className="p-4 rounded-lg border border-slate-100 bg-slate-50">
                            <p className="text-xs text-slate-500 uppercase font-medium mb-1">{acc.name}</p>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">${acc.balance.toLocaleString()}</h3>
                            <div className="flex items-center text-xs text-green-600">
                                <CheckCircleIcon size={12} className="mr-1" />
                                Reconciled: {acc.lastReconciled}
                            </div>
                        </div>
                    ))}
                    <Button variant="outline" className="w-full text-sm">Add Account</Button>
                </div>
            </Card>

            <Card title="Budget Health">
                 <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                        <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                            Operating Budget
                        </span>
                        </div>
                        <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-blue-600">
                            60% Used
                        </span>
                        </div>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                        <div style={{ width: "60%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-jci-blue"></div>
                    </div>
                 </div>
                 <p className="text-sm text-slate-500">Projected surplus of $2,300 by year end based on current spending.</p>
            </Card>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Transaction">
          <form onSubmit={handleAddTransaction} className="space-y-4">
              <Input label="Description" placeholder="e.g. Event Venue Deposit" required />
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Amount" type="number" placeholder="0.00" required />
                  <Select label="Type" options={[{label:'Expense', value:'Expense'}, {label:'Income', value:'Income'}]} />
              </div>
              <Select label="Category" options={[
                  {label:'Event', value:'Event'},
                  {label:'Project', value:'Project'},
                  {label:'Admin', value:'Admin'},
                  {label:'Dues', value:'Dues'}
              ]} />
              <div className="pt-4">
                  <Button className="w-full" type="submit">Save Transaction</Button>
              </div>
          </form>
      </Modal>
    </div>
  );
};

const CheckCircleIcon = ({size, className}: {size: number, className: string}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
)