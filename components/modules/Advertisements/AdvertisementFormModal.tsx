import React from 'react';
import { Upload } from 'lucide-react';
import { Button, Modal, ProgressBar } from '../../ui/Common';
import { Input, Textarea } from '../../ui/Form';
import type { Advertisement } from '../../../services/advertisementService';

interface AdvertisementFormModalProps {
  isOpen: boolean;
  selectedAd: Advertisement | null;
  formImage: File | null;
  formLogo: File | null;
  isUploading: boolean;
  uploadProgress: number;
  showAdvanced: boolean;
  statusActive: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onFormImageChange: (file: File) => void;
  onFormLogoChange: (file: File) => void;
  onShowAdvancedChange: React.Dispatch<React.SetStateAction<boolean>>;
  onStatusActiveChange: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AdvertisementFormModal: React.FC<AdvertisementFormModalProps> = ({
  isOpen,
  selectedAd,
  formImage,
  formLogo,
  isUploading,
  uploadProgress,
  showAdvanced,
  statusActive,
  onClose,
  onSubmit,
  onFormImageChange,
  onFormLogoChange,
  onShowAdvancedChange,
  onStatusActiveChange,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedAd ? 'Edit Partnership' : 'Create Partnership'}
      size="lg"
      drawerOnMobile
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Basic Info</p>
          <Input
            name="title"
            label="Partner Name"
            placeholder="e.g. Tech Solutions Inc."
            defaultValue={selectedAd?.title}
            required
          />
          <Textarea
            name="description"
            label="Member Benefit"
            placeholder="What's the exclusive offer for JCI members?"
            defaultValue={selectedAd?.description}
            rows={2}
            required
          />
          <Textarea
            name="termsAndConditions"
            label="Terms & Conditions"
            placeholder="Optional — how to redeem, expiry, restrictions..."
            defaultValue={selectedAd?.termsAndConditions}
            rows={2}
          />
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Images</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">Logo <span className="text-slate-400 font-normal">(square)</span></label>
              <div
                className="relative w-full aspect-square bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-jci-blue hover:bg-blue-50/40 transition-colors group"
                onClick={() => document.getElementById('ad-logo-upload')?.click()}
              >
                {(formLogo || selectedAd?.logoUrl) ? (
                  <>
                    <img
                      src={formLogo ? URL.createObjectURL(formLogo) : selectedAd?.logoUrl}
                      alt="Logo"
                      className="w-full h-full object-contain p-3"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload size={18} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-400 group-hover:text-jci-blue transition-colors">
                    <Upload size={20} />
                    <span className="text-[10px] font-semibold">Upload Logo</span>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFormLogoChange(file); }} className="hidden" id="ad-logo-upload" />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">Ad Banner <span className="text-red-400">*</span> <span className="text-slate-400 font-normal">(landscape)</span></label>
              <div
                className="relative w-full aspect-square bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-jci-blue hover:bg-blue-50/40 transition-colors group"
                onClick={() => document.getElementById('ad-image-upload')?.click()}
              >
                {(formImage || selectedAd?.imageUrl) ? (
                  <>
                    <img
                      src={formImage ? URL.createObjectURL(formImage) : selectedAd?.imageUrl}
                      alt="Banner"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload size={18} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-400 group-hover:text-jci-blue transition-colors">
                    <Upload size={20} />
                    <span className="text-[10px] font-semibold">Upload Banner</span>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFormImageChange(file); }} className="hidden" id="ad-image-upload" />
            </div>
          </div>
          {isUploading && (
            <ProgressBar progress={uploadProgress} label={`Uploading... ${uploadProgress}%`} />
          )}
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Settings</p>
          <div className="flex items-center justify-between py-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <button
              type="button"
              role="switch"
              aria-checked={statusActive}
              onClick={() => onStatusActiveChange(value => !value)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${statusActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${statusActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-xs font-semibold ${statusActive ? 'text-emerald-600' : 'text-slate-400'}`}>{statusActive ? 'Active' : 'Inactive'}</span>
            <input type="hidden" name="status" value={statusActive ? 'Active' : 'Inactive'} />
          </div>
          <Input
            name="linkUrl"
            label="Partner Website (Optional)"
            placeholder="https://example.com"
            defaultValue={selectedAd?.linkUrl}
          />
          <Input
            name="endDate"
            label="Expiry Date (Optional)"
            type="date"
            defaultValue={selectedAd?.endDate ? (typeof selectedAd.endDate === 'string' ? selectedAd.endDate.split('T')[0] : new Date(selectedAd.endDate as any).toISOString().split('T')[0]) : ''}
          />
        </div>

        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => onShowAdvancedChange(value => !value)}
          >
            <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            Advanced
          </button>
          {showAdvanced && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Input
                name="priority"
                label="Priority (0–10)"
                type="number"
                min="0"
                max="10"
                defaultValue={selectedAd?.priority?.toString() || '5'}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Button className="flex-1" type="submit" disabled={isUploading}>
            {isUploading ? 'Uploading...' : (selectedAd ? 'Save Changes' : 'Create Partnership')}
          </Button>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
