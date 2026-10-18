import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, XCircle, HelpCircle } from 'lucide-react';

interface Props {
  isAuthenticated: boolean;
}

/**
 * Landing page after a ToyyibPay payment (billReturnUrl = <site>/payment-return).
 * ToyyibPay appends status_id (1 = success, 2 = pending, 3 = failed), billcode and msg.
 * This page only informs the payer: the payment is recorded by the server-side callback
 * (netlify/functions/toyyibpay-callback), never from these query parameters.
 */
export const PaymentReturnPage: React.FC<Props> = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const statusId = params.get('status_id');
  const billCode = params.get('billcode');

  const state =
    statusId === '1' ? {
      icon: <CheckCircle size={56} className="text-green-600" />,
      title: '付款成功 · Payment successful',
      body: '谢谢！系统正在确认这笔付款，记录可能需要几分钟才会更新。Thank you! We are confirming your payment; your records may take a few minutes to update.',
    } : statusId === '2' ? {
      icon: <Clock size={56} className="text-amber-500" />,
      title: '付款处理中 · Payment pending',
      body: '银行还在处理这笔付款。确认后系统会自动更新，请不要重复付款。Your bank is still processing this payment. Records update automatically once it is confirmed; please do not pay again.',
    } : statusId === '3' ? {
      icon: <XCircle size={56} className="text-red-600" />,
      title: '付款未成功 · Payment failed',
      body: '这笔付款没有完成，没有扣款。你可以回到系统重新付款。The payment was not completed and you were not charged. You can return and try again.',
    } : {
      icon: <HelpCircle size={56} className="text-slate-400" />,
      title: '付款结果 · Payment result',
      body: '未能读取付款结果。请回到系统查看缴费记录。We could not read the payment result. Please check your payment records in the app.',
    };

  return (
    <main id="main-content" role="main" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center gap-4">
        {state.icon}
        <h1 className="text-xl font-bold text-slate-800">{state.title}</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{state.body}</p>
        {billCode && <p className="text-xs text-slate-400 font-mono break-all">Bill: {billCode}</p>}
        <button
          type="button"
          onClick={() => navigate(isAuthenticated ? '/roadmap' : '/', { replace: true })}
          className="mt-2 inline-flex items-center justify-center gap-2 bg-jci-navy text-white font-semibold px-6 py-3 rounded-lg hover:bg-jci-blue transition-colors focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-2"
        >
          {isAuthenticated ? '返回系统 · Back to JCI KL Connect' : '返回首页 · Back to home'}
        </button>
      </div>
    </main>
  );
};

export default PaymentReturnPage;
