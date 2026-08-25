import React from 'react';
import { FileText } from 'lucide-react';
import { Button, Modal } from '../../ui/Common';

interface PaymentRequestPdfPreviewModalProps {
  pdfPreviewUrl: string | null;
  pdfPreviewFileName: string;
  onClose: () => void;
}

export const PaymentRequestPdfPreviewModal: React.FC<PaymentRequestPdfPreviewModalProps> = ({
  pdfPreviewUrl,
  pdfPreviewFileName,
  onClose,
}) => {
  return (
    <Modal
      isOpen={!!pdfPreviewUrl}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-700">
          <div className="bg-slate-100 p-2 rounded-lg">
            <FileText size={18} className="text-slate-500" />
          </div>
          <span className="font-bold text-base truncate">{pdfPreviewFileName}</span>
        </div>
      }
      size="2xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <a href={pdfPreviewUrl || '#'} download={pdfPreviewFileName}>
            <Button>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Download PDF
            </Button>
          </a>
        </div>
      }
    >
      <div className="w-full" style={{ height: '70vh' }}>
        <iframe
          src={pdfPreviewUrl || ''}
          className="w-full h-full rounded border border-slate-200"
          title="PDF Preview"
        />
      </div>
    </Modal>
  );
};
