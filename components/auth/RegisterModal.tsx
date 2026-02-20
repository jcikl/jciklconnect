// Register Modal Component - Optimized Version
import React, { useState } from 'react';
import { Mail, Lock, User, AlertCircle, Phone, CheckCircle, ChevronRight, ChevronLeft, Sparkles, Users, Shield, Star } from 'lucide-react';
import { Modal, Button, useToast, ProgressBar } from '../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../ui/Form';
import { useAuth } from '../../hooks/useAuth';

// Hobbies options from MembersView
const HOBBY_OPTIONS = [
  "Art & Design", "Badminton", "Baking", "Basketball", "Car Enthusiast",
  "Cigar", "Cooking", "Cycling", "Dancing", "Diving",
  "E-Sport Mlbb", "Fashion", "Golf", "Hiking", "Leadership",
  "Liquor/ Wine Tasting", "Make Up", "Movie", "Other E-Sport", "Pickle Ball",
  "Pilates", "Public Speaking", "Reading", "Rock Climbing", "Singing",
  "Social Etiquette", "Social Service", "Travelling", "Women Empowerment", "Yoga"
];

// Nationality options
const COUNTRIES = [
  'Malaysia', 'Singapore', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines',
  'China', 'Japan', 'South Korea', 'India', 'Australia', 'New Zealand',
  'United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'Other'
];

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ 
  isOpen, 
  onClose, 
  onSwitchToLogin 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    fullName: '', // NRIC Full Name
    name: '', // English Name
    email: '',
    phone: '',
    gender: '' as 'Male' | 'Female' | '',
    dateOfBirth: '',
    nationality: 'Malaysia',
    // Step 2: Account Security
    password: '',
    confirmPassword: '',
    // Step 3: Interests
    areaOfInterest: '',
    selectedHobbies: [] as string[],
    // Step 4: Agreement
    agreeToTerms: false,
    agreeToPrivacy: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signUp } = useAuth();
  const { showToast } = useToast();

  // Step icons for visual enhancement
  const stepIcons = [
    <User key="step1" size={20} />,
    <Shield key="step2" size={20} />,
    <Star key="step3" size={20} />,
    <CheckCircle key="step4" size={20} />,
  ];

  const stepHighlights = [
    'Join 500+ young professionals in Kuala Lumpur',
    'Secure your account with a strong password',
    'Share your interests and discover opportunities',
    'Complete your membership agreement',
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const validateStep = (step: number): boolean => {
    setError(null);
    
    switch (step) {
      case 1:
        if (!formData.fullName.trim()) {
          setError('Please enter your full name (as per NRIC)');
          return false;
        }
        if (!formData.email.trim()) {
          setError('Please enter your email address');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          setError('Please enter a valid email address');
          return false;
        }
        if (!formData.phone.trim()) {
          setError('Please enter your phone number');
          return false;
        }
        if (!formData.gender) {
          setError('Please select your gender');
          return false;
        }
        if (!formData.dateOfBirth) {
          setError('Please select your date of birth');
          return false;
        }
        return true;
      case 2:
        if (!formData.password || formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        return true;
      case 3:
        // Step 3 is optional, always valid
        return true;
      case 4:
        if (!formData.agreeToTerms) {
          setError('Please agree to the Code of Ethics and Membership Agreement');
          return false;
        }
        if (!formData.agreeToPrivacy) {
          setError('Please agree to the Privacy Policy');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep < totalSteps) {
      handleNext();
      return;
    }

    setLoading(true);

    try {
      // Record digital agreement signatures
      const agreementSignatures = {
        codeOfEthics: {
          signed: formData.agreeToTerms,
          timestamp: new Date().toISOString(),
          memberName: formData.name,
          memberEmail: formData.email,
        },
        privacyPolicy: {
          signed: formData.agreeToPrivacy,
          timestamp: new Date().toISOString(),
          memberName: formData.name,
          memberEmail: formData.email,
        },
      };

      await signUp(
        formData.email,
        formData.password,
        formData.name,
        {
          fullName: formData.fullName,
          phone: formData.phone,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth,
          nationality: formData.nationality,
          areaOfInterest: formData.areaOfInterest,
          hobbies: formData.selectedHobbies,
          agreementSignatures,
        }
      );
      showToast('Welcome to JCI Kuala Lumpur! 🎉 Your membership has been created successfully!', 'success');
      onClose();
      // Reset form
      setCurrentStep(1);
      setFormData({
        fullName: '',
        name: '',
        email: '',
        phone: '',
        gender: '' as 'Male' | 'Female' | '',
        dateOfBirth: '',
        nationality: 'Malaysia',
        password: '',
        confirmPassword: '',
        areaOfInterest: '',
        selectedHobbies: [],
        agreeToTerms: false,
        agreeToPrivacy: false,
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to register. Please try again.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [
    'Basic Information',
    'Account Security',
    'Your Profile',
    'Agreement'
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-slate-500 mb-4">
              Let's get to know you better. Fill in your details below.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                name="fullName"
                label="Full Name (NRIC)"
                placeholder="CHAI KAH YEE"
                value={formData.fullName}
                onChange={handleChange}
                required
                icon={<User size={18} />}
              />
              <Input
                name="name"
                label="English Name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                name="email"
                label="Email Address"
                type="email"
                placeholder="john.doe@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                icon={<Mail size={18} />}
              />
              <Input
                name="phone"
                label="Phone Number"
                type="tel"
                placeholder="60123456789"
                value={formData.phone}
                onChange={handleChange}
                required
                icon={<Phone size={18} />}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {['Male', 'Female'].map(opt => (
                    <label key={opt} className="cursor-pointer flex-1">
                      <input
                        type="radio"
                        name="gender"
                        value={opt}
                        checked={formData.gender === opt}
                        onChange={handleChange}
                        className="hidden peer"
                        required
                      />
                      <span className="block px-3 py-2.5 rounded-lg text-sm font-medium border-2 border-slate-200 peer-checked:border-jci-blue peer-checked:bg-jci-blue/10 peer-checked:text-jci-blue text-slate-600 text-center transition-all">
                        {opt}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <Input
                name="dateOfBirth"
                label="Date of Birth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                required
              />
            </div>
            <Select
              name="nationality"
              label="Nationality"
              value={formData.nationality}
              onChange={handleChange}
              options={COUNTRIES.map(c => ({ label: c, value: c }))}
            />
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-slate-500 mb-4">
              Create a secure password to protect your account.
            </p>
            <Input
              name="password"
              label="Password"
              type="password"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={handleChange}
              required
              icon={<Lock size={18} />}
              helperText="Mix letters, numbers, and symbols for better security"
            />
            <Input
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              icon={<Lock size={18} />}
            />
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-slate-500 mb-4">
              Help us personalize your JCI experience (optional).
            </p>
            <Select
              name="areaOfInterest"
              label="Area of Interest"
              options={[
                { label: 'Select your focus area...', value: '' },
                { label: '🌱 Community Projects', value: 'projects' },
                { label: '💼 Business Networking', value: 'business' },
                { label: '📈 Personal Growth', value: 'growth' },
                { label: '👑 Leadership Development', value: 'leadership' },
                { label: '📚 Training & Education', value: 'training' },
                { label: '🌍 International Relations', value: 'international' },
              ]}
              value={formData.areaOfInterest}
              onChange={handleChange}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Hobbies & Interests (Optional)
              </label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-lg border border-slate-200">
                {HOBBY_OPTIONS.map(opt => (
                  <label key={opt} className="cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.selectedHobbies.includes(opt)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, selectedHobbies: [...formData.selectedHobbies, opt] });
                        } else {
                          setFormData({ ...formData, selectedHobbies: formData.selectedHobbies.filter(h => h !== opt) });
                        }
                      }}
                      className="hidden"
                    />
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border-2 ${formData.selectedHobbies.includes(opt) ? 'bg-jci-blue text-white border-jci-blue shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-jci-blue/30'}`}>
                      {opt}
                    </span>
                  </label>
                ))}
              </div>
              {formData.selectedHobbies.length > 0 && (
                <p className="text-xs text-jci-blue mt-2">
                  {formData.selectedHobbies.length} selected
                </p>
              )}
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-slate-500 mb-4">
              Please review and accept our agreements to complete your registration.
            </p>
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-4 rounded-xl space-y-3 max-h-56 overflow-y-auto border border-slate-200 shadow-inner">
              <div className="bg-white p-3 rounded-lg border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <Shield size={16} className="text-jci-blue" />
                  Code of Ethics
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  I commit to upholding integrity, respect, and service to the community.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <Shield size={16} className="text-green-600" />
                  Privacy Policy
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  My data will be used only for JCI Kuala Lumpur operations.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <Users size={16} className="text-amber-600" />
                  Membership Agreement
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  I will actively participate and contribute to JCI's goals.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className={`relative items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                formData.agreeToTerms 
                  ? 'border-jci-blue bg-blue-50/50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}>
                <Checkbox
                  checked={formData.agreeToTerms}
                  onChange={(e) => {
                    setFormData({ ...formData, agreeToTerms: e.target.checked });
                    if (error?.includes('Code of Ethics')) setError(null);
                  }}
                />
                <div className="text-sm text-slate-700 flex-1">
                  <span className="font-medium">I agree to the</span>{' '}
                  <span className="text-jci-blue font-medium">Code of Ethics</span>
                  {' '}and{''}
                  <span className="text-jci-blue font-medium"> Membership Agreement</span>
                </div>
              </label>
              <label className={`relative items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                formData.agreeToPrivacy 
                  ? 'border-green-400 bg-green-50/50' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}>
                <Checkbox
                  checked={formData.agreeToPrivacy}
                  onChange={(e) => {
                    setFormData({ ...formData, agreeToPrivacy: e.target.checked });
                    if (error?.includes('Privacy')) setError(null);
                  }}
                />
                <div className="text-sm text-slate-700 flex-1">
                  <span className="font-medium">I agree to the</span>{' '}
                  <span className="text-green-600 font-medium">Privacy Policy</span>
                </div>
              </label>
            </div>
            {formData.agreeToTerms && formData.agreeToPrivacy && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 flex items-center gap-3 animate-fade-in">
                <div className="bg-green-100 p-1.5 rounded-full">
                  <CheckCircle className="text-green-600" size={16} />
                </div>
                <p className="text-sm text-green-800">
                  <strong>Ready to join!</strong> Your digital signature will be recorded.
                </p>
              </div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      {/* Custom JCI Header */}
      <div className="bg-gradient-to-r from-jci-blue via-sky-600 to-blue-700 -mx-6 -mt-6 px-6 py-5 text-white rounded-t-xl">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl shadow-lg">
            <Users size={32} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Join JCI Kuala Lumpur</h2>
            <p className="text-blue-100 text-sm font-medium">Young Professionals Changing the World</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 mt-4">
        {/* Enhanced Progress Indicator */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Step {currentStep}</span>
              <span className="text-jci-blue font-semibold">{stepTitles[currentStep - 1]}</span>
            </div>
            <span className="text-xs text-slate-400">{Math.round((currentStep / totalSteps) * 100)}% complete</span>
          </div>
          
          {/* Step Pills */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <React.Fragment key={step}>
                <button
                  type="button"
                  onClick={() => step < currentStep && setCurrentStep(step)}
                  disabled={step > currentStep}
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-300
                    ${step === currentStep 
                      ? 'bg-jci-blue text-white shadow-lg shadow-jci-blue/30 scale-110' 
                      : step < currentStep 
                        ? 'bg-green-500 text-white cursor-pointer hover:scale-105'
                        : 'bg-slate-100 text-slate-400'
                    }
                  `}
                >
                  {step < currentStep ? <CheckCircle size={16} /> : step}
                </button>
                {step < totalSteps && (
                  <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                    step < currentStep ? 'bg-green-500' : 'bg-slate-100'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
          
          {/* Step highlight */}
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" />
            <p className="text-xs text-amber-700">{stepHighlights[currentStep - 1]}</p>
          </div>
        </div>

        {/* Error Message - Enhanced */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 animate-shake">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[280px]">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons - Enhanced */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentStep === 1 || loading}
            className={currentStep === 1 ? 'invisible' : ''}
          >
            <ChevronLeft size={16} className="mr-1" />
            Back
          </Button>
          
          <div className="flex gap-2">
            <Button
              type="submit"
              isLoading={loading && currentStep === totalSteps}
              disabled={loading}
              className="min-w-[100px]"
            >
              {currentStep === totalSteps ? (
                <>
                  <CheckCircle size={16} className="mr-1.5" />
                  Join Now
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight size={16} className="ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {onSwitchToLogin && (
          <div className="text-center text-sm text-slate-500 pt-3 border-t border-slate-100">
            Already a member?{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToLogin();
              }}
              className="text-jci-blue hover:text-sky-600 font-semibold transition-colors"
            >
              Sign in here
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
};

