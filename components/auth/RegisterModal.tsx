// Register Modal Component - Optimized Version
import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, User, AlertCircle, Phone, CheckCircle, ChevronRight, ChevronLeft, Sparkles, Users, Shield, Star } from 'lucide-react';
import { Modal, Button, useToast, ProgressBar } from '../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../ui/Form';
import { useAuth } from '../../hooks/useAuth';
import { JOIN_US_SURVEY_QUESTIONS, NATIONALITY_OPTIONS } from '../../config/constants';

// Hobbies options from MembersView
const HOBBY_OPTIONS = [
  "Art & Design", "Badminton", "Baking", "Basketball", "Car Enthusiast",
  "Cigar", "Cooking", "Cycling", "Dancing", "Diving",
  "E-Sport Mlbb", "Fashion", "Golf", "Hiking", "Leadership",
  "Liquor/ Wine Tasting", "Make Up", "Movie", "Other E-Sport", "Pickle Ball",
  "Pilates", "Public Speaking", "Reading", "Rock Climbing", "Singing",
  "Social Etiquette", "Social Service", "Travelling", "Women Empowerment", "Yoga"
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
    surveyAnswers: {} as Record<string, string[]>,
    selectedHobbies: [] as string[],
    // Step 4: Agreement
    agreeToTerms: false,
    agreeToPrivacy: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showZh, setShowZh] = useState(false);
  const { signUp } = useAuth();
  const { showToast } = useToast();

  // Real-time duplicate check for email and phone
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkField = async (field: 'email' | 'phone', value: string) => {
    if (!value) return;
    try {
      const res = await fetch('/.netlify/functions/check-member-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      });
      const data = await res.json();
      if (field === 'email') setEmailStatus(data.exists ? 'taken' : 'available');
      else setPhoneStatus(data.exists ? 'taken' : 'available');
    } catch {
      if (field === 'email') setEmailStatus('idle');
      else setPhoneStatus('idle');
    }
  };

  useEffect(() => {
    const email = formData.email;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(() => checkField('email', email), 600);
    return () => { if (emailTimer.current) clearTimeout(emailTimer.current); };
  }, [formData.email]);

  useEffect(() => {
    const phone = formData.phone;
    if (!phone || phone.length < 8) {
      setPhoneStatus('idle');
      return;
    }
    setPhoneStatus('checking');
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(() => checkField('phone', phone), 600);
    return () => { if (phoneTimer.current) clearTimeout(phoneTimer.current); };
  }, [formData.phone]);

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
        if (emailStatus === 'taken') {
          setError('此电邮已注册，请直接登录');
          return false;
        }
        if (emailStatus === 'checking') {
          setError('请稍候，正在验证电邮…');
          return false;
        }
        if (!formData.phone.trim()) {
          setError('Please enter your phone number');
          return false;
        }
        if (phoneStatus === 'taken') {
          setError('此电话号码已注册');
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
        // Validate all survey questions have at least one answer
        const answeredCount = Object.keys(formData.surveyAnswers).filter(
          k => formData.surveyAnswers[k]?.length > 0
        ).length;
        if (answeredCount < JOIN_US_SURVEY_QUESTIONS.length) {
          setError(`Please answer all ${JOIN_US_SURVEY_QUESTIONS.length} assessment questions (${answeredCount}/${JOIN_US_SURVEY_QUESTIONS.length} answered)`);
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
      showToast('Application submitted! 🎉 Our team will review your membership request within 3–5 business days.', 'success');
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
        surveyAnswers: {} as Record<string, string[]>,
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
  const diagnosePersona = (answers: Record<string, string[]>) => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const tags = new Set<string>();

    // Q1-Q4 map to Directions A-D (multi-select: each selection counts)
    JOIN_US_SURVEY_QUESTIONS.forEach(q => {
      const selectedValues = answers[q.id] || [];
      if (!selectedValues.length) return;

      selectedValues.forEach(answer => {
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
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
                {emailStatus === 'checking' && (
                  <p className="mt-1 text-xs text-slate-400">检查中…</p>
                )}
                {emailStatus === 'taken' && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} /> 此电邮已注册，请直接登录
                  </p>
                )}
                {emailStatus === 'available' && (
                  <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> 电邮可用
                  </p>
                )}
              </div>
              <div>
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
                {phoneStatus === 'checking' && (
                  <p className="mt-1 text-xs text-slate-400">检查中…</p>
                )}
                {phoneStatus === 'taken' && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} /> 此电话已注册
                  </p>
                )}
                {phoneStatus === 'available' && (
                  <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle size={12} /> 电话可用
                  </p>
                )}
              </div>
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
              options={NATIONALITY_OPTIONS.map(c => ({ label: c, value: c }))}
            />
          </div>
        );

      case 2: {
        const pwd = formData.password;
        const confirmMismatch = formData.confirmPassword.length > 0 && formData.confirmPassword !== pwd;
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
            <div>
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
              {confirmMismatch && (
                <p className="text-[11px] text-red-500 font-medium mt-1">Passwords do not match yet</p>
              )}
              {formData.confirmPassword.length > 0 && !confirmMismatch && (
                <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                  <CheckCircle size={11} /> Passwords match
                </p>
              )}
            </div>
          </div>
        );
      }

      case 3: {
        const answeredQCount = Object.keys(formData.surveyAnswers).filter(
          k => formData.surveyAnswers[k]?.length > 0
        ).length;
        return (
          <div className="space-y-3 animate-fade-in pr-1">
            {/* Header row with progress + toggle */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="font-bold text-slate-600 text-sm leading-tight truncate">Personalized Assessment</h4>
                <span className={`flex-none text-[10px] font-black px-2 py-0.5 rounded-full ${
                  answeredQCount === JOIN_US_SURVEY_QUESTIONS.length
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {answeredQCount}/{JOIN_US_SURVEY_QUESTIONS.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowZh(v => !v)}
                title={showZh ? 'Switch to English' : '切换到中文'}
                className={`flex-none flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                  showZh
                    ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className="text-[11px]">🌐</span>
                {showZh ? 'EN' : '中文'}
              </button>
            </div>
            {/* Mini progress bar */}
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${answeredQCount === JOIN_US_SURVEY_QUESTIONS.length ? 'bg-emerald-500' : 'bg-jci-blue'}`}
                style={{ width: `${(answeredQCount / JOIN_US_SURVEY_QUESTIONS.length) * 100}%` }}
              />
            </div>
            <p className="text-sm text-slate-500 mb-2">
              Select all that apply — we'll match you with the best opportunities.
            </p>
            {JOIN_US_SURVEY_QUESTIONS.map((q, idx) => {
              const selectedValues: string[] = formData.surveyAnswers[q.id] || [];
              const isAnswered = selectedValues.length > 0;
              return (
                <div key={q.id} className={`rounded-2xl border-2 overflow-hidden transition-all duration-200 ${isAnswered ? 'border-blue-200 shadow-sm' : 'border-slate-100'
                  }`}>
                  {/* Question header */}
                  <div className={`px-4 py-3 flex items-center gap-3 ${isAnswered ? 'bg-blue-50/60' : 'bg-slate-50/80'
                    }`}>
                    <span className={`flex-none flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold border-2 transition-all ${isAnswered
                      ? 'bg-jci-blue text-white border-jci-blue shadow-md'
                      : 'bg-white text-slate-400 border-slate-200'
                      }`}>
                      {isAnswered ? <CheckCircle size={13} /> : idx + 1}
                    </span>
                    <h4 className={`text-[13px] font-semibold leading-snug flex-1 ${isAnswered ? 'text-slate-800' : 'text-slate-600'
                      }`}>{showZh ? (q as any).titleZh ?? q.title : q.title}</h4>
                    {isAnswered && (
                      <span className="text-[10px] font-bold text-jci-blue bg-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                        {selectedValues.length} selected
                      </span>
                    )}
                  </div>
                  {/* Options */}
                  <div className="px-2 pb-2 grid grid-cols-1 gap-0.5">
                    {q.options.map(opt => {
                      const isSelected = selectedValues.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const current: string[] = formData.surveyAnswers[q.id] || [];
                            const updated = isSelected
                              ? current.filter(v => v !== opt.value)
                              : [...current, opt.value];
                            setFormData({
                              ...formData,
                              surveyAnswers: { ...formData.surveyAnswers, [q.id]: updated }
                            });
                            if (error) setError(null);
                          }}
                          className={`
                            w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-150 group
                            ${isSelected
                              ? 'bg-blue-50 ring-1 ring-blue-100'
                              : 'hover:bg-slate-50'
                            }
                          `}
                        >
                          {/* Checkbox indicator */}
                          <div className={`
                            flex-none w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150
                            ${isSelected ? 'bg-jci-blue border-jci-blue' : 'border-slate-300 group-hover:border-blue-300'}
                          `}>
                            {isSelected && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-[12px] font-medium leading-relaxed flex-1 ${isSelected ? 'text-jci-blue' : 'text-slate-600'
                            }`}>
                            {showZh ? (opt as any).labelZh ?? opt.label : opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Hobbies (optional) */}
            <div className="rounded-2xl border-2 border-slate-100 overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3 bg-slate-50/80">
                <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-white text-slate-400 border-2 border-slate-200">
                  <Sparkles size={13} />
                </span>
                <h4 className="text-[13px] font-semibold leading-snug flex-1 text-slate-600">
                  Your Hobbies & Interests
                </h4>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                  Optional
                </span>
              </div>
              <div className="p-3 flex flex-wrap gap-1.5">
                {HOBBY_OPTIONS.map(hobby => {
                  const isSelected = formData.selectedHobbies.includes(hobby);
                  return (
                    <button
                      key={hobby}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        selectedHobbies: isSelected
                          ? prev.selectedHobbies.filter(h => h !== hobby)
                          : [...prev.selectedHobbies, hobby],
                      }))}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                        isSelected
                          ? 'bg-jci-blue text-white border-jci-blue shadow-sm'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-jci-blue/40 hover:text-jci-blue'
                      }`}
                    >
                      {hobby}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }

      case 4: {
        const AgreementCard = ({
          checked,
          onToggle,
          icon,
          title,
          points,
          accent,
        }: {
          checked: boolean;
          onToggle: () => void;
          icon: React.ReactNode;
          title: string;
          points: string[];
          accent: 'blue' | 'green';
        }) => (
          <button
            type="button"
            onClick={onToggle}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${checked
              ? accent === 'blue'
                ? 'border-jci-blue bg-blue-50/60 shadow-sm'
                : 'border-emerald-400 bg-emerald-50/60 shadow-sm'
              : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-none p-2 rounded-xl ${checked
                ? accent === 'blue' ? 'bg-jci-blue text-white' : 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-400'
                } transition-colors`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-bold mb-1 ${checked ? 'text-slate-900' : 'text-slate-700'}`}>{title}</h4>
                <ul className="space-y-0.5">
                  {points.map((p, i) => (
                    <li key={i} className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                      <span className={`mt-1.5 w-1 h-1 rounded-full flex-none ${checked ? (accent === 'blue' ? 'bg-jci-blue' : 'bg-emerald-500') : 'bg-slate-300'}`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Check indicator */}
              <div className={`flex-none w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${checked
                ? accent === 'blue' ? 'bg-jci-blue border-jci-blue' : 'bg-emerald-500 border-emerald-500'
                : 'border-slate-300'
                }`}>
                {checked && (
                  <svg width="12" height="10" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        );
        const allAgreed = formData.agreeToTerms && formData.agreeToPrivacy;
        return (
          <div className="space-y-3 animate-fade-in">
            <p className="text-sm text-slate-500 mb-1">
              Tap each agreement to accept and complete your registration.
            </p>
            <AgreementCard
              checked={formData.agreeToTerms}
              onToggle={() => {
                setFormData(prev => ({ ...prev, agreeToTerms: !prev.agreeToTerms }));
                if (error?.includes('Code of Ethics')) setError(null);
              }}
              icon={<Shield size={18} />}
              title="Code of Ethics & Membership Agreement"
              points={[
                'I commit to upholding integrity, respect, and service to the community.',
                "I will actively participate and contribute to JCI's goals.",
              ]}
              accent="blue"
            />
            <AgreementCard
              checked={formData.agreeToPrivacy}
              onToggle={() => {
                setFormData(prev => ({ ...prev, agreeToPrivacy: !prev.agreeToPrivacy }));
                if (error?.includes('Privacy')) setError(null);
              }}
              icon={<Lock size={18} />}
              title="Privacy Policy"
              points={['My data will be used only for JCI Kuala Lumpur operations.']}
              accent="green"
            />
            {allAgreed ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-3.5 flex items-center gap-3 animate-fade-in">
                <div className="bg-green-100 p-1.5 rounded-full flex-none">
                  <CheckCircle className="text-green-600" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-green-800 font-bold">Ready to join!</p>
                  <p className="text-[11px] text-green-700 truncate">
                    Signing digitally as <strong>{formData.fullName || formData.name}</strong> ({formData.email})
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 text-center pt-1">
                Your digital signature (name, email, timestamp) will be recorded with your acceptance.
              </p>
            )}
          </div>
        );
      }

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
      <div className="flex flex-col h-[min(650px,78vh)] -mx-4 md:-mx-6 -mt-4 md:-mt-6 -mb-4 md:-mb-6 overflow-hidden">
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
              {currentStep === 1 && onSwitchToLogin ? (
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-xs text-slate-400 hover:text-jci-blue font-semibold transition-colors"
                >
                  Already a member? <span className="text-jci-blue">Log in</span>
                </button>
              ) : (
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
              )}

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
