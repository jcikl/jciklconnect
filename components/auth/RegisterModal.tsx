// Register Modal Component - Optimized Version
import React, { useState } from 'react';
import { Mail, Lock, User, AlertCircle, Phone, CheckCircle, ChevronRight, ChevronLeft, Sparkles, Users, Shield, Star } from 'lucide-react';
import { Modal, Button, useToast, ProgressBar } from '../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../ui/Form';
import { useAuth } from '../../hooks/useAuth';
import { JOIN_US_SURVEY_QUESTIONS } from '../../config/constants';

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
    // Step 3: Profile & Survey
    surveyAnswers: {} as Record<string, string>,
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
        // Validate all survey questions are answered
        const answeredCount = Object.keys(formData.surveyAnswers).length;
        if (answeredCount < JOIN_US_SURVEY_QUESTIONS.length) {
          setError(`Please answer all ${JOIN_US_SURVEY_QUESTIONS.length} assessment questions`);
          return false;
        }
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

      // Diagnose Persona and Tags
      const { personaType, tendencyTags } = diagnosePersona(formData.surveyAnswers);

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
          selectedHobbies: formData.selectedHobbies,
          surveyAnswers: formData.surveyAnswers,
          personaType,
          tendencyTags,
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
        surveyAnswers: {},
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

  /**
   * Helper to diagnose persona and tags based on survey responses
   */
  const diagnosePersona = (answers: Record<string, string>) => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const tags = new Set<string>();

    // Q1-Q4 map to Directions A-D
    JOIN_US_SURVEY_QUESTIONS.forEach(q => {
      const answer = answers[q.id];
      if (!answer) return;

      if (['Q1', 'Q2', 'Q3', 'Q4'].includes(q.id)) {
        counts[answer] = (counts[answer] || 0) + 1;
      }

      const option = q.options.find(opt => opt.value === answer);
      if (option && option.mapping) {
        if (option.mapping.direction !== 'None') tags.add(option.mapping.direction);
        if (option.mapping.category !== 'Engagement') tags.add(option.mapping.category);
        option.mapping.items.forEach(item => tags.add(item));
      }
    });

    // Determine dominant direction
    let dominant = 'A';
    let max = -1;
    // Tie-breaking priority: A > B > C > D
    ['A', 'B', 'C', 'D'].forEach(key => {
      if (counts[key] > max) {
        max = counts[key];
        dominant = key;
      }
    });

    const personas: Record<string, string> = {
      A: 'Learning-oriented (学习型)',
      B: 'Practical-oriented (务实型)',
      C: 'Backbone-oriented (骨干型)',
      D: 'Explorer-oriented (探索型)'
    };

    return {
      personaType: personas[dominant],
      tendencyTags: Array.from(tags)
    };
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
          <div className="space-y-6 animate-fade-in pr-1">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-4 mb-4">
              <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md">
                <Sparkles size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Personalized Assessment</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tell us more about your goals. We'll use this to match you with the best projects and growth opportunities.
                </p>
              </div>
            </div>

            {JOIN_US_SURVEY_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="space-y-4 p-1">
                <div className="flex items-start gap-3">
                  <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-jci-blue/10 text-[10px] font-bold text-jci-blue border border-jci-blue/20 mt-0.5">
                    {idx + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-900 leading-snug">{q.title}</h4>
                </div>
                <div className="grid grid-cols-1 gap-2 ml-9">
                  {q.options.map(opt => (
                    <label
                      key={opt.value}
                      className={`
                        relative flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200
                        ${formData.surveyAnswers[q.id] === opt.value
                          ? 'border-jci-blue bg-blue-50/50 shadow-sm ring-1 ring-jci-blue/20 scale-[1.01]'
                          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.value}
                        checked={formData.surveyAnswers[q.id] === opt.value}
                        onChange={() => {
                          setFormData({
                            ...formData,
                            surveyAnswers: { ...formData.surveyAnswers, [q.id]: opt.value }
                          });
                          if (error) setError(null);
                        }}
                        className="hidden"
                      />
                      <div className={`
                        w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center transition-all
                        ${formData.surveyAnswers[q.id] === opt.value ? 'border-jci-blue bg-jci-blue' : 'border-slate-300'}
                      `}>
                        {formData.surveyAnswers[q.id] === opt.value && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className={`text-xs font-medium leading-relaxed ${formData.surveyAnswers[q.id] === opt.value ? 'text-jci-blue' : 'text-slate-600'}`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Star size={16} className="text-amber-500" />
                Hobbies & Interests (Optional)
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
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
                    <span className={`
                      inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border-2 
                      ${formData.selectedHobbies.includes(opt)
                        ? 'bg-jci-blue text-white border-jci-blue shadow-md'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-jci-blue/30'
                      }
                    `}>
                      {opt}
                    </span>
                  </label>
                ))}
              </div>
              {formData.selectedHobbies.length > 0 && (
                <p className="text-[10px] font-bold text-jci-blue mt-2 ml-1 uppercase tracking-widest">
                  {formData.selectedHobbies.length} Items Selected
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
            <div className="space-y-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                <h4 className="font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
                  <Shield size={16} className="text-jci-blue" />
                  Code of Ethics
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  I commit to upholding integrity, respect, and service to the community.
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                <h4 className="font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
                  <Shield size={16} className="text-green-600" />
                  Privacy Policy
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  My data will be used only for JCI Kuala Lumpur operations.
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                <h4 className="font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
                  <Users size={16} className="text-amber-600" />
                  Membership Agreement
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  I will actively participate and contribute to JCI's goals.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className={`relative p-3 rounded-lg border-2 transition-all cursor-pointer ${formData.agreeToTerms
                ? 'border-jci-blue bg-blue-50/50'
                : 'border-slate-200 hover:border-slate-300'
                }`}>
                <Checkbox
                  checked={formData.agreeToTerms}
                  onChange={(e) => {
                    setFormData({ ...formData, agreeToTerms: e.target.checked });
                    if (error?.includes('Code of Ethics')) setError(null);
                  }}
                  label={
                    <span className="text-xs text-slate-700 leading-tight">
                      I agree to the <span className="text-jci-blue font-semibold">Code of Ethics</span> and <span className="text-jci-blue font-semibold">Membership Agreement</span>
                    </span>
                  }
                />
              </div>
              <div className={`relative p-3 rounded-lg border-2 transition-all cursor-pointer ${formData.agreeToPrivacy
                ? 'border-green-400 bg-green-50/50'
                : 'border-slate-200 hover:border-slate-300'
                }`}>
                <Checkbox
                  checked={formData.agreeToPrivacy}
                  onChange={(e) => {
                    setFormData({ ...formData, agreeToPrivacy: e.target.checked });
                    if (error?.includes('Privacy')) setError(null);
                  }}
                  label={
                    <span className="text-xs text-slate-700 leading-tight">
                      I agree to the <span className="text-green-600 font-semibold">Privacy Policy</span>
                    </span>
                  }
                />
              </div>
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      scrollInBody={false}
      variant="jci"
      title={
        <div className="flex items-center gap-4">
          <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl shadow-lg flex-shrink-0">
            <Users size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight">Join JCI Kuala Lumpur</h2>
            <p className="text-blue-100 text-[10px] font-medium uppercase tracking-wider">Young Professionals Changing the World</p>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-[650px] -mx-4 md:-mx-6 -mt-4 md:-mt-6 -mb-4 md:-mb-6 overflow-hidden">
        <form onSubmit={handleSubmit} noValidate className="flex-1 flex flex-col min-h-0">
          {/* Fixed Progress & Highlight Section */}
          <div className="flex-none px-6 py-4 space-y-4 bg-white border-b border-slate-50">
            {/* Enhanced Progress Indicator */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Step {currentStep} / {totalSteps}</span>
                  <span className="text-jci-blue">{stepTitles[currentStep - 1]}</span>
                </div>
                <span className="text-slate-400">{Math.round((currentStep / totalSteps) * 100)}%</span>
              </div>

              {/* Step Pills */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <React.Fragment key={step}>
                    <button
                      type="button"
                      onClick={() => step < currentStep && setCurrentStep(step)}
                      disabled={step > currentStep}
                      className={`
                        flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all duration-300
                        ${step === currentStep
                          ? 'bg-jci-blue text-white shadow-lg shadow-jci-blue/30 scale-110'
                          : step < currentStep
                            ? 'bg-green-500 text-white cursor-pointer hover:scale-105'
                            : 'bg-slate-100 text-slate-400'
                        }
                      `}
                    >
                      {step < currentStep ? <CheckCircle size={12} /> : step}
                    </button>
                    {step < totalSteps && (
                      <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${step < currentStep ? 'bg-green-500' : 'bg-slate-100'
                        }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Step highlight */}
              {/*<div className="bg-amber-50/70 border border-amber-100/50 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                <Sparkles size={12} className="text-amber-500" />
                <p className="text-[10px] text-amber-700 font-medium">{stepHighlights[currentStep - 1]}</p>
              </div>*/}
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 mb-5 animate-shake">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-red-700 font-medium">{error}</p>
              </div>
            )}

            <div className="min-h-[250px]">
              {renderStepContent()}
            </div>
          </div>

          {/* Fixed Footer (Navigation) */}
          <div className="flex-none px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentStep === 1 || loading}
                size="sm"
                className={currentStep === 1 ? 'invisible' : 'text-slate-500'}
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
                  size="sm"
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
          </div>
        </form>
      </div>
    </Modal>
  );
};
