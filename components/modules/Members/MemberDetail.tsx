import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Settings, X, Sparkles, Phone, Mail,
  Award, Clock, Briefcase, GraduationCap, UserPlus,
  Zap, Coins, ArrowUpRight, Shield, UserCheck, AlertCircle, CheckCircle, MapPin,
  Linkedin, Facebook, Instagram, MessageCircle, CalendarCheck, UserCog,
  Target, Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Card, Badge, Modal, useToast, Tabs } from '../../ui/Common';
import { IntroducerSelector } from '../../ui/IntroducerSelector';
import { Combobox } from '../../ui/Combobox';
import { MultiSelectDropdown } from '../../ui/MultiSelectDropdown';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  UserRole,
  Member,
  BoardMember,
  Project,
} from '../../../types';
import type { HobbyClub } from '../../../types';
import { MembersService } from '../../../services/membersService';
import { HobbyClubsService } from '../../../services/hobbyClubsService';
import { deleteFromCloudinary, uploadMemberAvatarToCloudinary } from '../../../services/cloudinaryService';
import { BoardManagementService } from '../../../services/boardManagementService';
import { AIPredictionService, MemberChurnPrediction } from '../../../services/aiPredictionService';
import { MentorshipService, MentorMatchSuggestion } from '../../../services/mentorshipService';
import { ProjectsService } from '../../../services/projectsService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { JOIN_US_SURVEY_QUESTIONS, nationalityOptionsForValue, INDUSTRY_OPTIONS, IDEAL_REFERRAL_OPTIONS, BUSINESS_CATEGORIES_OPTIONS } from '../../../config/constants';
import { getBirthPlaceFromIC, isMalaysianIC, getDateOfBirthFromIC, getGenderFromIC } from '../../../utils/malaysianIdUtils';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';
import { MembershipTypeDisplay } from '../../shared/MembershipTypeDisplay';
import { PointsSourceRadarChart } from '../../dashboard/Analytics';
import { getAttendanceDisplay } from './MemberTable';
import { MentorMatchingModal } from './MentorMatchingModal';
import { ChurnPredictionModal } from './ChurnPredictionModal';
import { MemberDetailBasicTab } from './MemberDetailBasicTab';
import { MemberDetailProfessionalTab } from './MemberDetailProfessionalTab';
import { MemberDetailCareerTab } from './MemberDetailCareerTab';
import { MemberDetailActivitiesTab } from './MemberDetailActivitiesTab';
export const MemberDetail: React.FC<{ member: Member, onBack: () => void, isSelfView?: boolean }> = ({ member: memberProp, onBack, isSelfView = false }) => {
  const { members, updateMember, deleteMember } = useMembers();
  const { resetPassword, member: currentAuthMember } = useAuth();
  // Points columns in the Activities Log are visible to the President only
  const isPresident = (currentAuthMember?.jciCareer?.currentBoardPosition || currentAuthMember?.currentBoardPosition) === 'President';
  // Always derive the latest member data from the live members array so the UI
  // updates automatically after every save (without a page reload).
  const member = useMemo(
    () => members.find(m => m.id === memberProp.id) ?? memberProp,
    [members, memberProp]
  );
  const { isAdmin, isDeveloper, hasPermission, effectiveRole } = usePermissions();
  const canEditMembers = hasPermission('canEditMembers');
  const { showToast } = useToast();
  const [showMentorMatchModal, setShowMentorMatchModal] = useState(false);
  const [potentialMentors, setPotentialMentors] = useState<MentorMatchSuggestion[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [churnPrediction, setChurnPrediction] = useState<MemberChurnPrediction | null>(null);
  const [loadingChurnPrediction, setLoadingChurnPrediction] = useState(false);
  const [showChurnModal, setShowChurnModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [memberClubs, setMemberClubs] = useState<HobbyClub[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [editFormTab, setEditFormTab] = useState<'basic' | 'professional' | 'contact' | 'apparel'>('basic');
  const [boardPositions, setBoardPositions] = useState<BoardMember[]>([]);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    if (member.surveyAnswers) {
      Object.keys(member.surveyAnswers).forEach(key => {
        const val = member.surveyAnswers![key];
        init[key] = Array.isArray(val) ? val : (val ? [val] : []);
      });
    }
    return init;
  });
  const [assessmentShowZh, setAssessmentShowZh] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const sessionUploads = useRef<string[]>([]);

  const [activeInlineEditCard, setActiveInlineEditCard] = useState<'basic' | 'professional' | 'contact' | 'apparel' | 'career' | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [inlineValues, setInlineValues] = useState<any>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'basic' | 'professional' | 'career' | 'activities'>('basic');
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [projectRoles, setProjectRoles] = useState<any[]>([]);
  const [sponsorshipRecords, setSponsorshipRecords] = useState<any[]>([]);
  const [radarContributions, setRadarContributions] = useState<any[]>([]);
  const [recruitedMembers, setRecruitedMembers] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const currentYear = new Date().getFullYear();
  const [radarYear, setRadarYear] = useState(currentYear);
  const availableYears = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);

  const groupedRadarContributions = useMemo(() => {
    const sorted = [...radarContributions].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      const valA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const valB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
      return valB - valA;
    });

    const groups: { [year: string]: any[] } = {};
    sorted.forEach((log) => {
      const dateObj = new Date(log.date);
      const year = isNaN(dateObj.getTime()) ? 'Unknown' : String(dateObj.getFullYear());
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(log);
    });

    const sortedYears = Object.keys(groups).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return b.localeCompare(a);
    });

    return { groups, sortedYears };
  }, [radarContributions]);

  const HOBBY_OPTIONS = [
    "Art & Design", "Badminton", "Baking", "Basketball", "Car Enthusiast",
    "Cigar", "Cooking", "Cycling", "Dancing", "Diving",
    "E-Sport Mlbb", "Fashion", "Golf", "Hiking", "Leadership",
    "Liquor/ Wine Tasting", "Make Up", "Movie", "Other E-Sport", "Pickle Ball",
    "Pilates", "Public Speaking", "Reading", "Rock Climbing", "Singing",
    "Social Etiquette", "Social Service", "Travelling", "Women Empowerment", "Yoga"
  ];

  const resolveIntroducerDisplay = (introVal?: string) => {
    if (!introVal) return 'Direct Join';
    const foundMember = members.find(m => m.id === introVal);
    if (foundMember) {
      const shortName = foundMember.name || '';
      const fullName = foundMember.fullName || '';
      if (shortName && fullName && shortName !== fullName) {
        return `JCI KL Member: ${shortName} (${fullName})`;
      }
      return `JCI KL Member: ${shortName || fullName || 'Unnamed'}`;
    }
    return introVal;
  };

  const resolveIntroducerShort = (introVal?: string) => {
    if (!introVal) return 'Direct Join';
    const foundMember = members.find(m => m.id === introVal);
    if (foundMember) return foundMember.name || foundMember.fullName || 'Unnamed';
    return introVal;
  };

  const startInlineEdit = (card: 'basic' | 'professional' | 'contact' | 'apparel' | 'career') => {
    setInlineValues({
      name: member.name || '',
      avatar: member.avatar || member.avatarUrl || member.general?.avatarUrl || '',
      fullName: member.fullName || '',
      idNumber: member.idNumber || member.general?.idNumber || '',
      birthPlace: (() => { const ic = member.idNumber || member.general?.idNumber || ''; return isMalaysianIC(ic) ? (getBirthPlaceFromIC(ic) || member.birthPlace || member.general?.birthPlace || '') : (member.birthPlace || member.general?.birthPlace || ''); })(),
      dateOfBirth: (() => { const ic = member.idNumber || member.general?.idNumber || ''; return isMalaysianIC(ic) ? (getDateOfBirthFromIC(ic) || member.dateOfBirth || member.general?.dob || '') : (member.dateOfBirth || member.general?.dob || ''); })(),
      gender: (() => { const ic = member.idNumber || member.general?.idNumber || ''; return isMalaysianIC(ic) ? (getGenderFromIC(ic) || member.gender || member.general?.gender || '') : (member.gender || member.general?.gender || ''); })(),
      ethnicity: (member.general?.ethnicity ?? member.ethnicity) || '',
      dietaryPreference: (member.general?.dietaryPreference ?? member.dietaryPreference) || '',
      nationality: member.nationality || 'Malaysia',
      introducer: member.introducer || '',
      bio: member.bio || '',
      hobbies: Array.isArray(member.hobbies) ? [...member.hobbies] : [],
      skills: Array.isArray(member.skills) ? member.skills.join(', ') : (member.skills || ''),

      companyName: member.companyName || '',
      companyWebsite: member.companyWebsite || '',
      companyDescription: (member.business?.companyDescription ?? member.companyDescription) || '',
      departmentAndPosition: (member.business?.departmentAndPosition ?? member.departmentAndPosition) || '',
      acceptInternationalBusiness: member.acceptInternationalBusiness || '',
      businessCategory: Array.isArray(member.businessCategory) ? [...member.businessCategory] : [],
      industry: member.industry || '',
      interestedIndustries: Array.isArray(member.business?.interestedIndustries ?? member.interestedIndustries) ? [...(member.business?.interestedIndustries ?? member.interestedIndustries)!] : [],
      levelOfManagement: (member.business?.levelOfManagement ?? member.levelOfManagement) || '',
      idealReferralIndustry: member.idealReferralIndustry || '',
      idealReferral: member.idealReferral || (Array.isArray(member.idealReferrals) ? member.idealReferrals.join(', ') : ''),
      specialOffer: member.specialOffer || '',

      phone: member.phone || '',
      alternatePhone: member.alternatePhone || '',
      whatsappGroup: !!member.whatsappGroup,
      email: member.email || '',
      address: member.address || '',
      linkedin: member.linkedin || '',
      facebook: member.facebook || '',
      instagram: member.instagram || '',
      wechat: member.wechat || '',
      emergencyContactName: member.emergencyContactName || '',
      emergencyContactPhone: member.emergencyContactPhone || '',
      emergencyContactRelationship: member.emergencyContactRelationship || '',

      cutStyle: member.cutStyle || '',
      tshirtSize: member.tshirtSize || '',
      jacketSize: member.jacketSize || '',
      embroideredName: member.embroideredName || '',
      tshirtStatus: member.tshirtStatus || 'NA',

      senatorCertified: !!member.senatorCertified,
      senatorshipId: member.senatorshipId || '',
      senatorshipBoardValidated: !!member.senatorshipBoardValidated,
      senatorshipValidatedBy: (member.jciCareer?.senatorshipValidatedBy ?? member.senatorshipValidatedBy) || '',
      senatorshipValidatedAt: (member.jciCareer?.senatorshipValidatedAt ?? member.senatorshipValidatedAt) || '',
    });
    setActiveInlineEditCard(card);
    setIsEditMode(true);
  };

  const handleInlineAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !inlineValues) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }

    setAvatarUploading(true);
    setAvatarUploadProgress(0);
    try {
      const uploadedUrl = await uploadMemberAvatarToCloudinary(file, member, setAvatarUploadProgress);
      sessionUploads.current.push(uploadedUrl);
      setInlineValues((prev: any) => ({ ...prev, avatar: uploadedUrl, _avatarTs: Date.now() }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload avatar', 'error');
    } finally {
      setAvatarUploading(false);
      setAvatarUploadProgress(0);
    }
  };

  const handleInlineSave = async (card: 'basic' | 'professional' | 'contact' | 'apparel' | 'career', updates: Partial<Member>) => {
    try {
      await updateMember(member.id, updates);
      setActiveInlineEditCard(null);
      showToast('Profile updated successfully', 'success');
      return true;
    } catch (err) {
      showToast('Failed to update profile', 'error');
      return false;
    }
  };

  const handleGlobalSave = async () => {
    if (!inlineValues) return;
    const skillsArr = inlineValues.skills.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (updateMember as (id: string, updates: any) => Promise<void>)(member.id, {
        avatar: inlineValues.avatar || '', avatarUrl: inlineValues.avatar || '',
        name: inlineValues.name, fullName: inlineValues.fullName, idNumber: inlineValues.idNumber,
        birthPlace: inlineValues.birthPlace || undefined,
        'general.birthPlace': inlineValues.birthPlace || undefined,
        dateOfBirth: inlineValues.dateOfBirth, gender: inlineValues.gender, ethnicity: inlineValues.ethnicity,
        'general.ethnicity': inlineValues.ethnicity || undefined,
        dietaryPreference: (inlineValues.dietaryPreference as Member['dietaryPreference']) || undefined,
        'general.dietaryPreference': (inlineValues.dietaryPreference as Member['dietaryPreference']) || undefined,
        nationality: inlineValues.nationality, introducer: inlineValues.introducer, bio: inlineValues.bio,
        hobbies: inlineValues.hobbies, skills: skillsArr,
        companyName: inlineValues.companyName, companyWebsite: inlineValues.companyWebsite,
        companyDescription: inlineValues.companyDescription,
        'business.companyDescription': inlineValues.companyDescription || undefined,
        departmentAndPosition: inlineValues.departmentAndPosition,
        'business.departmentAndPosition': inlineValues.departmentAndPosition || undefined,
        acceptInternationalBusiness: inlineValues.acceptInternationalBusiness, businessCategory: inlineValues.businessCategory,
        industry: inlineValues.industry, interestedIndustries: inlineValues.interestedIndustries,
        'business.interestedIndustries': inlineValues.interestedIndustries,
        levelOfManagement: inlineValues.levelOfManagement,
        'business.levelOfManagement': inlineValues.levelOfManagement || undefined,
        idealReferralIndustry: inlineValues.idealReferralIndustry,
        idealReferral: inlineValues.idealReferral, specialOffer: inlineValues.specialOffer,
        phone: inlineValues.phone, alternatePhone: inlineValues.alternatePhone, email: inlineValues.email,
        whatsappGroup: inlineValues.whatsappGroup, address: inlineValues.address,
        emergencyContactName: inlineValues.emergencyContactName, emergencyContactRelationship: inlineValues.emergencyContactRelationship,
        emergencyContactPhone: inlineValues.emergencyContactPhone, linkedin: inlineValues.linkedin,
        facebook: inlineValues.facebook, instagram: inlineValues.instagram, wechat: inlineValues.wechat,
        cutStyle: inlineValues.cutStyle, tshirtSize: inlineValues.tshirtSize, jacketSize: inlineValues.jacketSize,
        tshirtStatus: inlineValues.tshirtStatus, embroideredName: inlineValues.embroideredName,
        senatorshipId: inlineValues.senatorshipId?.trim(), senatorCertified: inlineValues.senatorCertified,
        senatorshipBoardValidated: inlineValues.senatorshipBoardValidated,
        senatorshipValidatedBy: inlineValues.senatorshipValidatedBy?.trim(),
        'jciCareer.senatorshipValidatedBy': inlineValues.senatorshipValidatedBy?.trim(),
        senatorshipValidatedAt: inlineValues.senatorshipValidatedAt?.trim(),
        'jciCareer.senatorshipValidatedAt': inlineValues.senatorshipValidatedAt?.trim(),
      });
      const finalAvatar = inlineValues.avatar;
      const originalAvatar = member.avatar || member.avatarUrl || member.general?.avatarUrl || '';
      // Delete original saved avatar if replaced
      if (originalAvatar && originalAvatar !== finalAvatar) {
        deleteFromCloudinary(originalAvatar).catch(console.error);
      }
      // Delete any intermediate session uploads that were replaced
      sessionUploads.current.forEach(url => {
        if (url !== finalAvatar) deleteFromCloudinary(url).catch(console.error);
      });
      sessionUploads.current = [];
      setIsEditMode(false);
      setActiveInlineEditCard(null);
      setInlineValues(null);
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update profile', 'error');
    }
  };

  // Sync assessmentAnswers whenever the live member's surveyAnswers change (e.g. after save)
  useEffect(() => {
    if (!showAssessmentModal) {
      const synced: Record<string, string[]> = {};
      if (member.surveyAnswers) {
        Object.keys(member.surveyAnswers).forEach(key => {
          const val = member.surveyAnswers![key];
          synced[key] = Array.isArray(val) ? val : (val ? [val] : []);
        });
      }
      setAssessmentAnswers(synced);
    }
  }, [member.surveyAnswers, showAssessmentModal]);

  const diagnosePersona = (answers: Record<string, string[]>) => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const tags = new Set<string>();

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

    let dominant = 'A';
    let max = -1;
    ['A', 'B', 'C', 'D'].forEach(key => {
      if (counts[key] > max) {
        max = counts[key];
        dominant = key;
      }
    });

    const personas: Record<string, string> = {
      A: 'Learning-oriented (å­¦ä¹ åž‹)',
      B: 'Practical-oriented (åŠ¡å®žåž‹)',
      C: 'Backbone-oriented (éª¨å¹²åž‹)',
      D: 'Explorer-oriented (æŽ¢ç´¢åž‹)'
    };

    return {
      personaType: personas[dominant],
      tendencyTags: Array.from(tags)
    };
  };

  const handleSaveAssessment = async () => {
    setSavingAssessment(true);
    try {
      const { personaType, tendencyTags } = diagnosePersona(assessmentAnswers);
      await updateMember(member.id, {
        surveyAnswers: assessmentAnswers,
        personaType,
        tendencyTags
      });
      showToast('Personalized assessment updated successfully', 'success');
      setShowAssessmentModal(false);
    } catch (err) {
      showToast('Failed to update assessment', 'error');
    } finally {
      setSavingAssessment(false);
    }
  };
  const [commissionDirectorPositions, setCommissionDirectorPositions] = useState<BoardMember[]>([]);

  const mentor = members.find(m => m.id === member.mentorId);
  const mentees = members.filter(m => member.menteeIds?.includes(m.id));

  // Load member's hobby clubs
  useEffect(() => {
    const loadMemberClubs = async () => {
      setLoadingClubs(true);
      try {
        const allClubs = await HobbyClubsService.getAllClubs();
        const clubs = allClubs.filter(club =>
          club.memberIds?.includes(member.id)
        );
        setMemberClubs(clubs);
      } catch (err) {
        console.error('Failed to load member clubs:', err);
      } finally {
        setLoadingClubs(false);
      }
    };
    loadMemberClubs();
  }, [member.id]);

  // Load board positions for this member directly from boardMembers collection
  useEffect(() => {
    const loadBoardPositions = async () => {
      try {
        const [positions, commissionPositions] = await Promise.all([
          BoardManagementService.getMemberBoardPositions(member.id),
          BoardManagementService.getMemberCommissionDirectorPositions(member.id),
        ]);
        setBoardPositions(positions);
        setCommissionDirectorPositions(commissionPositions);
      } catch (err) {
        console.error('Failed to load board positions:', err);
      }
    };
    loadBoardPositions();
  }, [member.id]);

  // Load projects for IntroducerSelector
  useEffect(() => {
    ProjectsService.getAllProjects().then(setAllProjects).catch(() => { });
  }, []);

  // Load activities log data
  useEffect(() => {
    if (activeDetailTab !== 'activities') return;

    let cancelled = false;
    const fetchActivitiesData = async () => {
      setActivitiesLoading(true);
      try {
        // Fetch all needed collections in parallel
        const [projects, sponsorshipsSnap, contributionsSnap, allMembers] = await Promise.all([
          ProjectsService.getAllProjects(),
          getDocs(query(collection(db, 'sponsorships'), where('memberId', '==', member.id))),
          getDocs(query(collection(db, 'RadarContributions'), where('memberId', '==', member.id))),
          MembersService.getAllMembers()
        ]);

        if (cancelled) return;

        // 1. Process Project Roles (Committee & Trainers)
        const roles: any[] = [];
        projects.forEach((proj: any) => {
          // Check committee
          if (proj.committee && Array.isArray(proj.committee)) {
            proj.committee.forEach((c: any) => {
              if (c.memberId === member.id) {
                roles.push({
                  id: `comm-${proj.id}`,
                  projectName: proj.name || 'Unnamed Project',
                  role: c.role || 'Committee Member',
                  type: 'Committee',
                  date: proj.startDate || proj.proposedDate || proj.eventStartDate || '',
                });
              }
            });
          }

          // Check trainers
          if (proj.trainers && Array.isArray(proj.trainers)) {
            proj.trainers.forEach((t: any) => {
              if (t.memberId === member.id) {
                roles.push({
                  id: `trainer-${proj.id}`,
                  projectName: proj.name || 'Unnamed Project',
                  role: 'Trainer',
                  type: 'Trainer',
                  hours: parseFloat(t.durationHours) || 0,
                  date: proj.startDate || proj.proposedDate || proj.eventStartDate || '',
                });
              }
            });
          }
        });
        setProjectRoles(roles.sort((a, b) => b.date.localeCompare(a.date)));

        // 2. Process Sponsorships
        const sponsorList: any[] = [];
        sponsorshipsSnap.forEach((doc) => {
          const data = doc.data();
          const amt = parseFloat(data.amount) || 0;
          sponsorList.push({
            id: doc.id,
            projectName: data.projectName || 'General Sponsorship',
            amount: amt,
            points: Math.floor(amt / 100) * 2, // 2 points per RM100 sponsor
            date: data.createdAt?.toDate?.() || data.createdAt || '',
          });
        });
        setSponsorshipRecords(sponsorList);

        // 3. Process Radar Contributions
        const contribList: any[] = [];
        contributionsSnap.forEach((doc) => {
          const data = doc.data();
          const rawDateVal = typeof data.eventDate === 'string'
            ? data.eventDate.trim().substring(0, 11)
            : (data.eventDate || data.createdAt?.toDate?.() || data.createdAt || '');
          contribList.push({
            id: doc.id,
            description: data.eventTitle || data.description || 'Imported Radar Score',
            points: parseFloat(data.points) || 0,
            type: data.rawCategory || data.type || 'Event',
            date: rawDateVal,
          });
        });
        setRadarContributions(contribList);

        // 4. Process Recruited Members
        const recruitList: any[] = [];
        const memberName = member.name || '';
        const memberFullName = member.fullName || member.general?.name || '';
        allMembers.forEach((m: any) => {
          const intro = (m.introducer || '').trim().toLowerCase();
          if (intro) {
            if (
              intro === member.id.toLowerCase() ||
              (memberName && intro === memberName.trim().toLowerCase()) ||
              (memberFullName && intro === memberFullName.trim().toLowerCase())
            ) {
              recruitList.push({
                id: m.id,
                name: m.name,
                email: m.email,
                joinDate: m.joinDate,
                avatar: m.avatar
              });
            }
          }
        });
        setRecruitedMembers(recruitList);

      } catch (err) {
        console.error('Error fetching activities logs:', err);
      } finally {
        if (!cancelled) setActivitiesLoading(false);
      }
    };

    fetchActivitiesData();

    return () => {
      cancelled = true;
    };
  }, [activeDetailTab, member.id]);

  const handleFindMentors = async () => {
    setLoadingMatches(true);
    try {
      const matches = await MentorshipService.findPotentialMentors(member.id, {
        skills: member.skills,
      });
      setPotentialMentors(matches);
      setShowMentorMatchModal(true);
    } catch (err) {
      showToast('Failed to find potential mentors', 'error');
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleAssignMentor = async (mentorId: string) => {
    try {
      await MembersService.assignMentor(member.id, mentorId);
      showToast('Mentor assigned successfully', 'success');
      setShowMentorMatchModal(false);
    } catch (err) {
      showToast('Failed to assign mentor', 'error');
    }
  };

  const handleAnalyzeChurn = async () => {
    setLoadingChurnPrediction(true);
    try {
      const prediction = await AIPredictionService.predictMemberChurn(member.id);
      setChurnPrediction(prediction);
      setShowChurnModal(true);
    } catch (err) {
      showToast('Failed to analyze churn risk', 'error');
    } finally {
      setLoadingChurnPrediction(false);
    }
  };

  const handleEditProfile = async (updates: Partial<Member>) => {
    try {
      await updateMember(member.id, updates);
      setShowEditModal(false);
    } catch (err) {
      // Error is handled in the hook
    }
  };

  const handleSendInviteEmail = async () => {
    const email = member.contact?.email || member.email;
    if (!email) { showToast('No email address found for this member', 'error'); return; }
    try {
      const res = await fetch('/.netlify/functions/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error);
      }
      showToast(`Invitation email sent to ${email}`, 'success');
      setAuthEmailExists(true);
    } catch (err) {
      showToast(`Failed to send invite: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  // Whether this member's email already has a Firebase Auth account (Google/password) â€”
  // if so, the CTA becomes "Reset Password" instead of "Send Invite"
  const [authEmailExists, setAuthEmailExists] = useState<boolean | null>(null);
  useEffect(() => {
    const email = member.contact?.email || member.email;
    if (!email) { setAuthEmailExists(false); return; }
    let cancelled = false;
    setAuthEmailExists(null);
    fetch('/.netlify/functions/check-auth-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && data) setAuthEmailExists(!!data.exists); })
      .catch(() => { /* keep null â€” fall back to Send Invite */ });
    return () => { cancelled = true; };
  }, [member.id]);

  const handleResetPassword = async () => {
    const email = member.contact?.email || member.email;
    if (!email) { showToast('No email address found for this member', 'error'); return; }
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('../../../config/firebase');
      await sendPasswordResetEmail(auth, email);
      showToast(`Password reset email sent to ${email}`, 'success');
    } catch (err) {
      showToast(`Failed to send reset email: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDeleteMember = async () => {
    try {
      setIsDeleting(true);
      await deleteMember(member.id);
      onBack(); // Go back to directory
    } catch (err) {
      // Error is handled in the hook
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // JCI Pillar Diagnosis dynamic scoring
  const pillarDiagnosis = useMemo(() => {
    const tags = member.tendencyTags || [];

    // 1. Individual
    let indTagsScore = tags.includes('Individual') ? 10 : 0;
    const indTagItems = ['Effective Communications', 'Public Speaking', 'JCIM Inspire', 'Mentorship', 'Local Academy', 'Explore/Discover workshop', 'JCIM Empower', 'Leadership Series', 'Workshops', 'Personal Transformation', 'TOYM'];
    indTagsScore += tags.filter(t => indTagItems.includes(t)).length * 4;
    const indBase = 60;
    const indAttendance = Math.round((member.attendanceRate || 0) * 0.15);
    const indPersona = member.personaType?.includes('Learning') ? 10 : 0;
    const individual = Math.min(99, Math.max(20, indBase + Math.min(25, indTagsScore) + indAttendance + indPersona));

    // 2. Business
    let bizTagsScore = tags.includes('Business') ? 10 : 0;
    const bizTagItems = ['JIB', 'CYEA', 'CYE', 'BCP', 'Networking', 'BSP', 'BSP Supercharge'];
    bizTagsScore += tags.filter(t => bizTagItems.includes(t)).length * 5;
    const bizBase = 40;
    const bizWillingness = member.acceptInternationalBusiness === 'Yes' ? 25 : member.acceptInternationalBusiness === 'Willing to Explore' ? 12 : 0;
    const bizProfile = ((member.companyName || member.business?.position)) ? 5 : 0;
    const bizPersona = member.personaType?.includes('Practical') ? 10 : 0;
    const business = Math.min(99, Math.max(15, bizBase + Math.min(25, bizTagsScore) + bizWillingness + bizProfile + bizPersona));

    // 3. Community
    let commTagsScore = tags.includes('Community') ? 10 : 0;
    const commTagItems = ['Project Management', 'Leadership Toolkit', 'Leaders School Program', 'Chairperson', 'Zero Waste', 'Blood Donation', 'SDA'];
    commTagsScore += tags.filter(t => commTagItems.includes(t)).length * 5;
    const commBase = 50;
    const commRole = (member.role === UserRole.BOARD || member.role === UserRole.ADMIN || member.isCurrentBoardMember) ? 20 : member.role === UserRole.MEMBER ? 10 : 0;
    const commPersona = member.personaType?.includes('Backbone') ? 10 : 0;
    const community = Math.min(99, Math.max(15, commBase + Math.min(25, commTagsScore) + commRole + commPersona));

    // 4. International
    let intTagsScore = tags.includes('International') ? 15 : 0;
    const intTagItems = ['ASPAC', 'World Congress', 'Twin Chapter', 'National Convention', 'Conference'];
    intTagsScore += tags.filter(t => intTagItems.includes(t)).length * 5;
    const intBase = 30;
    const intWillingness = member.acceptInternationalBusiness === 'Yes' ? 10 : member.acceptInternationalBusiness === 'Willing to Explore' ? 5 : 0;
    const intConnections = (member.internationalConnections && member.internationalConnections.length > 0) ? 15 : 0;
    const intPersona = member.personaType?.includes('Explorer') ? 10 : 0;
    const international = Math.min(99, Math.max(15, intBase + Math.min(25, intTagsScore) + intWillingness + intConnections + intPersona));

    // Calculate dynamic dominant persona
    let dominant = 'LOCAL COMMUNITY LEADER';
    if (member.personaType) {
      if (member.personaType.includes('Learning')) dominant = 'CONTINUOUS SELF-IMPROVER';
      else if (member.personaType.includes('Practical')) dominant = 'GLOBAL ASSET HUNTER';
      else if (member.personaType.includes('Backbone')) dominant = 'COMMUNITY BACKBONE LEAD';
      else if (member.personaType.includes('Explorer')) dominant = 'GLOBAL HORIZONS EXPLORER';
    } else {
      const maxScore = Math.max(individual, business, community, international);
      if (maxScore === individual) dominant = 'CONTINUOUS SELF-IMPROVER';
      else if (maxScore === business) dominant = 'GLOBAL ASSET HUNTER';
      else if (maxScore === community) dominant = 'COMMUNITY BACKBONE LEAD';
      else if (maxScore === international) dominant = 'GLOBAL HORIZONS EXPLORER';
    }

    return { individual, business, community, international, dominant };
  }, [member]);

  // Elite Leaderboard Radar Data
  const radarData = useMemo(() => {
    const stats = (member.jciCareer?.radarStats ?? member.radarStats) || {
      training: 0,
      leadership: 0,
      events: 0,
      recruitment: 0,
      sponsorship: 0
    };
    return [
      { subject: 'Training', value: stats.training || 0 },
      { subject: 'Leadership', value: stats.leadership || 0 },
      { subject: 'Events', value: stats.events || 0 },
      { subject: 'Recruitment', value: stats.recruitment || 0 },
      { subject: 'Sponsorship', value: stats.sponsorship || 0 }
    ].map(item => ({
      ...item,
      displaySubject: `${item.subject}: ${item.value}`
    }));
  }, [member.jciCareer?.radarStats, member.radarStats]);

  const maxRadarVal = useMemo(() => {
    const vals = radarData.map(d => d.value);
    return Math.max(10, ...vals);
  }, [radarData]);

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-20 md:pb-0">
      {/* Header Card */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-md group">

        {/* â”€â”€ MOBILE hero â”€â”€ */}
        <div className="md:hidden bg-gradient-to-br from-jci-blue via-jci-blue to-jci-navy px-4 pt-4 pb-3 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          {!isSelfView && (
            <button
              onClick={onBack}
              aria-label="Close member detail"
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center text-white/80 hover:bg-white/30 hover:text-white active:scale-95 transition-all"
            >
              <X size={16} />
            </button>
          )}
          <div className="relative flex items-center gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="p-0.5 bg-white/30 rounded-full shadow-lg">
                <img
                  src={member.avatar || undefined}
                  className="w-16 h-16 rounded-full border-2 border-white/50 bg-slate-200 object-cover"
                  alt={member.name}
                />
              </div>
              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-jci-navy shadow ${(member.role === UserRole.MEMBER || member.role === UserRole.BOARD || member.role === UserRole.ADMIN) ? 'bg-green-400' : member.role === UserRole.PROBATION ? 'bg-amber-400' : 'bg-slate-400'}`} title={member.role} />
            </div>
            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-white font-black text-xl leading-tight">{member.name}</h1>
              </div>
              {(member.companyName || (member.business?.departmentAndPosition ?? member.departmentAndPosition)) && (
                <p className="text-white/70 text-xs mt-0.5 truncate">
                  <Briefcase size={10} className="inline mr-1 opacity-70" />
                  {[(member.business?.departmentAndPosition ?? member.departmentAndPosition), member.companyName].filter(Boolean).join(' Â· ')}
                </p>
              )}
              <div className="flex flex-col gap-0.5 mt-1 text-white/60 text-[10px]">
                {member.email && <span className="flex items-center gap-1"><Mail size={9} />{member.email}</span>}
                {member.phone && <span className="flex items-center gap-1"><Phone size={9} />{member.phone}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€ MOBILE contact + actions strip â”€â”€ */}
        <div className="md:hidden px-4 py-3 space-y-2.5 border-b border-slate-100">
          <div className="flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-1">
              <Shield size={10} className="text-jci-blue shrink-0" />
              <span className="text-jci-blue">{member.role}</span>
              {member.introducer && (
                <>
                  <span className="text-slate-300 mx-0.5">Â·</span>
                  <span className="text-jci-blue">Introducer: {resolveIntroducerShort(member.introducer)}</span>
                </>
              )}
            </span>
            <span className="flex items-center gap-2 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
              {member.linkedin
                ? <a href={member.linkedin} target="_blank" rel="noreferrer" className="text-[#0077B5]"><Linkedin size={13} /></a>
                : <Linkedin size={13} className="text-slate-400" />}
              {member.facebook
                ? <a href={member.facebook} target="_blank" rel="noreferrer" className="text-[#1877F2]"><Facebook size={13} /></a>
                : <Facebook size={13} className="text-slate-400" />}
              {member.instagram
                ? <a href={member.instagram} target="_blank" rel="noreferrer" className="text-[#E1306C]"><Instagram size={13} /></a>
                : <Instagram size={13} className="text-slate-400" />}
              {member.wechat
                ? <span className="text-[#07C160] flex items-center gap-1 text-[10px]"><MessageCircle size={13} /></span>
                : <MessageCircle size={13} className="text-slate-400" />}
            </span>
          </div>
          <div className="flex gap-2">
            {isEditMode ? (
              <>
                <Button variant="primary" size="sm" onClick={handleGlobalSave} className="flex-1 h-9 font-bold">Save Changes</Button>
                <Button variant="outline" size="sm" onClick={() => { setIsEditMode(false); setActiveInlineEditCard(null); setInlineValues(null); }} className="flex-1 h-9 font-bold">Cancel</Button>
              </>
            ) : (
              <>
                {(canEditMembers || isSelfView) && (
                  <Button variant="outline" size="sm" onClick={() => startInlineEdit('basic')} className="flex-1 h-9 font-bold">Edit Profile</Button>
                )}
                {(isAdmin || isDeveloper) && !isSelfView && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 h-9 font-bold ${member.role === UserRole.INACTIVE ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                    onClick={async () => {
                      const newRole = member.role === UserRole.INACTIVE ? UserRole.MEMBER : UserRole.INACTIVE;
                      try {
                        await updateMember(member.id, { role: newRole });
                        showToast(`Member ${newRole === UserRole.INACTIVE ? 'deactivated' : 'activated'} successfully`, 'success');
                      } catch (err) {
                        showToast('Failed to update member status', 'error');
                      }
                    }}
                  >
                    {member.role === UserRole.INACTIVE ? 'Activate' : 'Set Inactive'}
                  </Button>
                )}
                {(isAdmin || isDeveloper) && !isSelfView && (
                  authEmailExists ? (
                    <Button variant="outline" size="sm" className="h-9 px-3 text-amber-600 border-amber-200 hover:bg-amber-50 font-bold" onClick={handleResetPassword}>Reset Password</Button>
                  ) : (
                    <Button variant="outline" size="sm" className="h-9 px-3 text-sky-600 border-sky-200 hover:bg-sky-50 font-bold" onClick={handleSendInviteEmail}>Send Invite</Button>
                  )
                )}
                {isDeveloper && !isSelfView && (
                  <Button variant="outline" size="sm" className="h-9 px-3 text-red-500 border-red-200 hover:bg-red-50 font-bold" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* â”€â”€ DESKTOP hero + strip wrapper â”€â”€ */}
        <div className="hidden md:block relative">
          {/* åŒºå—ä¸€: banner */}
          <div className="h-40 bg-gradient-to-br from-jci-blue via-jci-blue to-jci-navy relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
            {!isSelfView && (
              <button
                onClick={onBack}
                aria-label="Close member detail"
                className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center text-white/80 hover:bg-white/30 hover:text-white active:scale-95 transition-all"
              >
                <X size={17} />
              </button>
            )}
            {/* Name, Tier Badge, position, company â€” pl-52 clears avatar */}
            <div className="absolute bottom-4 left-0 right-0 px-6 pl-52 flex flex-col justify-end gap-1">
              <div className="flex flex-row items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-white tracking-tight leading-tight break-words drop-shadow">{member.name}</h1>
              </div>
              {(member.companyName || (member.business?.departmentAndPosition ?? member.departmentAndPosition)) && (
                <p className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                  <Briefcase size={13} className="text-white/50 shrink-0" />
                  {[(member.business?.departmentAndPosition ?? member.departmentAndPosition), member.companyName].filter(Boolean).join(' Â· ')}
                </p>
              )}
            </div>
          </div>

          {/* åŒºå—äºŒ: avatar â€” absolute, straddles banner/strip boundary (top-24 = 10rem - 4rem) */}
          <div className="absolute left-6 top-24 z-20">
            <div className="relative">
              <div className="p-1 bg-white rounded-full shadow-xl">
                <img
                  src={member.avatar || undefined}
                  className="w-32 h-32 rounded-full border-4 border-slate-50 bg-slate-100 object-cover"
                  alt={member.name}
                />
              </div>
              <div className={`absolute bottom-2 right-2 w-8 h-8 rounded-full border-4 border-white shadow-sm ${(member.role === UserRole.MEMBER || member.role === UserRole.BOARD || member.role === UserRole.ADMIN) ? 'bg-green-500' : member.role === UserRole.PROBATION ? 'bg-amber-500' : 'bg-slate-500'}`} title={member.role} />
            </div>
          </div>

          {/* åŒºå—ä¸‰: contact + actions strip â€” directly below banner, pl-52 clears avatar */}
          <div className="px-6 pl-52 py-3 border-b border-slate-100 flex items-center gap-4">
            {/* å·¦ï¼šchips */}
            <div className="flex-1 flex flex-col gap-1.5">
              {/* è¡Œä¸€ï¼šemail / phone */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 text-xs font-medium text-slate-600"><Mail size={12} className="text-jci-blue shrink-0" />{member.email}</span>
                {member.phone && <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 text-xs font-medium text-slate-600"><Phone size={12} className="text-jci-blue shrink-0" />{member.phone}</span>}
              </div>
              {/* è¡ŒäºŒï¼šrole + introducer + ç¤¾äº¤åª’ä½“ */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 text-xs font-medium">
                  <Shield size={12} className="text-jci-blue shrink-0" />
                  <span className="text-jci-blue">{member.role}</span>
                  {member.introducer && (
                    <>
                      <span className="text-slate-300 mx-0.5">Â·</span>
                      <span className="text-jci-blue">Introducer: {resolveIntroducerShort(member.introducer)}</span>
                    </>
                  )}
                </span>
                <span className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                  {member.linkedin
                    ? <a href={member.linkedin} target="_blank" rel="noreferrer" className="text-[#0077B5]"><Linkedin size={14} /></a>
                    : <Linkedin size={14} className="text-slate-400" />}
                  {member.facebook
                    ? <a href={member.facebook} target="_blank" rel="noreferrer" className="text-[#1877F2]"><Facebook size={14} /></a>
                    : <Facebook size={14} className="text-slate-400" />}
                  {member.instagram
                    ? <a href={member.instagram} target="_blank" rel="noreferrer" className="text-[#E1306C]"><Instagram size={14} /></a>
                    : <Instagram size={14} className="text-slate-400" />}
                  {member.wechat
                    ? <span className="text-[#07C160] flex items-center gap-1 text-xs"><MessageCircle size={14} /></span>
                    : <MessageCircle size={14} className="text-slate-400" />}
                </span>
              </div>

            </div>
            {/* å³ï¼šæ“ä½œæŒ‰é’®ç»„ */}
            <div className="flex gap-2 shrink-0">
              {isEditMode ? (
                <>
                  <Button variant="primary" size="sm" onClick={handleGlobalSave} className="flex-none h-10 px-6 font-bold">Save Changes</Button>
                  <Button variant="outline" size="sm" onClick={() => { setIsEditMode(false); setActiveInlineEditCard(null); setInlineValues(null); }} className="flex-none h-10 px-6 font-bold">Cancel</Button>
                </>
              ) : (
                <>
                  {(canEditMembers || isSelfView) && (
                    <Button variant="outline" size="sm" onClick={() => startInlineEdit('basic')} className="flex-none h-10 px-6 font-bold">Edit Profile</Button>
                  )}
                  {(isAdmin || isDeveloper) && !isSelfView && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={`flex-none h-10 px-6 font-bold ${member.role === UserRole.INACTIVE ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                      onClick={async () => {
                        const newRole = member.role === UserRole.INACTIVE ? UserRole.MEMBER : UserRole.INACTIVE;
                        try {
                          await updateMember(member.id, { role: newRole });
                          showToast(`Member ${newRole === UserRole.INACTIVE ? 'deactivated' : 'activated'} successfully`, 'success');
                        } catch (err) {
                          showToast('Failed to update member status', 'error');
                        }
                      }}
                    >
                      {member.role === UserRole.INACTIVE ? 'Activate Member' : 'Set Inactive'}
                    </Button>
                  )}
                  {(isAdmin || isDeveloper) && !isSelfView && (
                    authEmailExists ? (
                      <Button variant="outline" size="sm" className="flex-none h-10 px-6 text-amber-600 border-amber-200 hover:bg-amber-50 font-bold" onClick={handleResetPassword}>Reset Password</Button>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-none h-10 px-6 text-sky-600 border-sky-200 hover:bg-sky-50 font-bold" onClick={handleSendInviteEmail}>Send Invite</Button>
                    )
                  )}
                  {isDeveloper && !isSelfView && (
                    <Button variant="outline" size="sm" className="flex-none h-10 px-6 text-red-600 border-red-200 hover:bg-red-50 font-bold" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
                  )}
                </>
              )}
            </div>
          </div>{/* end åŒºå—ä¸‰ */}
        </div>{/* end desktop hero wrapper */}

        <div className="grid grid-cols-4 gap-0 border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/50">
          <div className="p-2 md:p-4 text-center hover:bg-white transition-colors group">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Coins size={12} className="text-jci-blue" />
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Points</p>
            </div>
            <p className="text-lg md:text-2xl font-black text-jci-blue">{member.points.toLocaleString()}</p>
          </div>
          <div className="p-2 md:p-4 text-center hover:bg-white transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Calendar size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Join Date</p>
            </div>
            <p className="text-xs md:text-base font-black text-slate-900 leading-snug">{formatDateToDDMMMYYYY(member.joinDate)}</p>
          </div>
          <div className="p-2 md:p-4 text-center hover:bg-white transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CalendarCheck size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Attendance</p>
            </div>
            {(() => {
              const att = getAttendanceDisplay(member);
              return (
                <>
                  <p className="text-lg md:text-2xl font-black text-slate-900 whitespace-nowrap">{att.text}</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">check-ins / months</p>
                </>
              );
            })()}
          </div>
          <div className="p-2 md:p-4 text-center flex flex-col items-center justify-center hover:bg-white transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <CheckCircle size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Dues {new Date().getFullYear()}</p>
            </div>
            <Badge
              variant={
                (member.membership?.[String(new Date().getFullYear())]?.status === 'paid' ||
                  member.membership?.[String(new Date().getFullYear())]?.status === 'over paid') ? 'success' :
                  member.membership?.[String(new Date().getFullYear())]?.status === 'pending' ? 'warning' : 'error'
              }
              className="px-4 font-black capitalize"
            >
              {member.membership?.[String(new Date().getFullYear())]?.status || 'pending'}
            </Badge>
          </div>
        </div>
      </section>

      {/* NEW: Wolf-like Persona & Ambition Visualizer (Phase 1) */}
      {canEditMembers && <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Target size={120} />
          </div>
          <div className="relative z-10 p-2">
            <div className="flex justify-between items-center mb-4 gap-2">
              <h3 className="text-sm font-black text-blue-300 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={16} /> JCI Pillar Diagnosis
              </h3>
              {(canEditMembers || isSelfView) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAssessmentModal(true)}
                  className="text-[10px] bg-white/10 hover:bg-white/20 text-white border border-white/20 px-2.5 py-1 h-auto flex items-center gap-1 font-bold rounded-lg transition-all"
                >
                  <Settings size={12} />
                  Update Assessment
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Individual', val: pillarDiagnosis.individual, color: 'bg-blue-400' },
                { label: 'Business', val: pillarDiagnosis.business, color: 'bg-emerald-400' },
                { label: 'Community', val: pillarDiagnosis.community, color: 'bg-purple-400' },
                { label: 'International', val: pillarDiagnosis.international, color: 'bg-orange-400' }
              ].map((p, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                    <span>{p.label}</span>
                    <span>{p.val}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.val}%` }}
                      className={`h-full ${p.color} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] text-blue-200 font-bold uppercase mb-1">Dominant Persona</p>
              <p className="text-lg font-black italic text-white flex items-center gap-2">
                {pillarDiagnosis.dominant}
                <Badge className="bg-jci-blue text-blue text-[8px]">AI Profile</Badge>
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-2 border-slate-900 border-b-8 border-r-8 hover:translate-x-1 hover:translate-y-1 transition-all flex flex-col justify-between">
          <div className="p-2 h-full flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Target size={16} className="text-jci-blue animate-pulse" /> Elite Leaderboard Radar
              </h3>
              <div className="relative">
                <select
                  value={radarYear}
                  onChange={(e) => setRadarYear(Number(e.target.value))}
                  className="appearance-none bg-slate-100 text-jci-blue text-[10px] font-black uppercase tracking-wider rounded-full pl-2.5 pr-6 py-1 border border-slate-200 cursor-pointer hover:bg-slate-200/70 transition-all focus:outline-none focus:ring-1 focus:ring-jci-blue/50"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%230097D7' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y} className="bg-white text-slate-900">{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 min-h-[220px] w-full relative">
              <PointsSourceRadarChart memberId={member.id} year={radarYear} lightTheme={true} />
            </div>
          </div>
        </Card>
      </div>}

      {/* Tab Selector */}
      <div className="border-b border-slate-200 mb-6">
        <Tabs
          tabs={[
            { id: 'basic', label: 'Basic Information' },
            { id: 'professional', label: 'Professional & Business' },
            { id: 'career', label: 'JCI Career' },
            { id: 'activities', label: 'Activities Log' }
          ]}
          activeTab={activeDetailTab}
          onTabChange={(tabId) => setActiveDetailTab(tabId as any)}
          variant="underline"
        />
      </div>

      {activeDetailTab === 'basic' && (
        <MemberDetailBasicTab
          member={member}
          isEditMode={isEditMode}
          inlineValues={inlineValues}
          setInlineValues={setInlineValues}
          isAdmin={isAdmin}
          isDeveloper={isDeveloper}
          loadingChurnPrediction={loadingChurnPrediction}
          handleAnalyzeChurn={handleAnalyzeChurn}
          loadingClubs={loadingClubs}
          memberClubs={memberClubs}
          members={members}
          allProjects={allProjects}
          avatarUploading={avatarUploading}
          avatarUploadProgress={avatarUploadProgress}
          handleInlineAvatarUpload={handleInlineAvatarUpload}
          resolveIntroducerDisplay={resolveIntroducerDisplay}
        />
      )}
      {activeDetailTab === 'professional' && (
        <MemberDetailProfessionalTab
          member={member}
          isEditMode={isEditMode}
          inlineValues={inlineValues}
          setInlineValues={setInlineValues}
          activeInlineEditCard={activeInlineEditCard}
        />
      )}
      {activeDetailTab === 'career' && (
        <MemberDetailCareerTab
          member={member}
          isEditMode={isEditMode}
          inlineValues={inlineValues}
          setInlineValues={setInlineValues}
          boardPositions={boardPositions}
          commissionDirectorPositions={commissionDirectorPositions}
          mentor={mentor}
          mentees={mentees}
          handleFindMentors={handleFindMentors}
          loadingMatches={loadingMatches}
          setShowPaymentHistoryModal={setShowPaymentHistoryModal}
        />
      )}
      {activeDetailTab === 'activities' && (
        <MemberDetailActivitiesTab
          member={member}
          activitiesLoading={activitiesLoading}
          radarContributions={radarContributions}
          groupedRadarContributions={groupedRadarContributions}
          sponsorshipRecords={sponsorshipRecords}
          projectRoles={projectRoles}
          recruitedMembers={recruitedMembers}
          isPresident={isPresident}
        />
      )}
      {showAssessmentModal && (
        <Modal
          isOpen={showAssessmentModal}
          onClose={() => setShowAssessmentModal(false)}
          title="Personalized Assessment Update"
          size="lg"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Update member's alignment answers to recalculate JCI Pillar Diagnosis scores and tags.
              </p>
              <button
                type="button"
                onClick={() => setAssessmentShowZh(v => !v)}
                title={assessmentShowZh ? 'Switch to English' : 'Switch to Chinese'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${assessmentShowZh
                  ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                <span className="text-[11px]">ðŸŒ</span>
                {assessmentShowZh ? 'EN' : 'ä¸­æ–‡'}
              </button>
            </div>

            <div className="space-y-4">
              {JOIN_US_SURVEY_QUESTIONS.map((q, idx) => {
                const selectedValues = assessmentAnswers[q.id] || [];
                const isAnswered = selectedValues.length > 0;
                return (
                  <div
                    key={q.id}
                    className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${isAnswered ? 'border-blue-200 shadow-sm' : 'border-slate-100'
                      }`}
                  >
                    {/* Question Header */}
                    <div
                      className={`px-4 py-3 flex items-center justify-between gap-3 ${isAnswered ? 'bg-blue-50/60' : 'bg-slate-50/80'
                        }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span
                          className={`flex-none flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold border-2 transition-all ${isAnswered
                            ? 'bg-jci-blue text-white border-jci-blue shadow-sm'
                            : 'bg-white text-slate-400 border-slate-200'
                            }`}
                        >
                          {isAnswered ? <CheckCircle size={12} /> : idx + 1}
                        </span>
                        <h4
                          className={`text-xs font-bold leading-snug ${isAnswered ? 'text-slate-800' : 'text-slate-600'
                            }`}
                        >
                          {assessmentShowZh ? (q as any).titleZh ?? q.title : q.title}
                        </h4>
                      </div>
                      {isAnswered && (
                        <span className="text-[10px] font-bold text-jci-blue bg-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          {selectedValues.length} selected
                        </span>
                      )}
                    </div>
                    {/* Options */}
                    <div className="px-2 pb-2 pt-1 grid grid-cols-1 gap-0.5">
                      {q.options.map(opt => {
                        const isSelected = selectedValues.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              const current = assessmentAnswers[q.id] || [];
                              const updated = isSelected
                                ? current.filter(v => v !== opt.value)
                                : [...current, opt.value];
                              setAssessmentAnswers({
                                ...assessmentAnswers,
                                [q.id]: updated
                              });
                            }}
                            className={`
                              w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 group border-none outline-none
                              ${isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'}
                            `}
                          >
                            {/* Checkbox indicator */}
                            <div
                              className={`
                                flex-none w-4 h-4 rounded border flex items-center justify-center transition-all duration-150
                                ${isSelected
                                  ? 'bg-jci-blue border-jci-blue text-white'
                                  : 'border-slate-300 group-hover:border-blue-300 bg-white'
                                }
                              `}
                            >
                              {isSelected && (
                                <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                                  <path
                                    d="M1 4L3.5 6.5L9 1"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <span
                              className={`text-[12px] font-semibold leading-relaxed flex-1 ${isSelected ? 'text-jci-blue' : 'text-slate-600'
                                }`}
                            >
                              {assessmentShowZh ? (opt as any).labelZh ?? opt.label : opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setShowAssessmentModal(false)}
                disabled={savingAssessment}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAssessment}
                isLoading={savingAssessment}
              >
                Save & Recalculate
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showPaymentHistoryModal && (
        <Modal
          isOpen={showPaymentHistoryModal}
          onClose={() => setShowPaymentHistoryModal(false)}
          title={`Membership Dues History â€” ${member.name}`}
          size="md"
          bottomSheet
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Complete record of annual membership dues payments.
            </p>

            <div className="divide-y divide-slate-100">
              {member.membership && Object.keys(member.membership).length > 0 ? (
                Object.keys(member.membership)
                  .sort((a, b) => b.localeCompare(a))
                  .map((yr) => {
                    const record = member.membership![yr];
                    const isPaid = record.status === 'paid' || record.status === 'over paid';
                    const isPending = record.status === 'pending';
                    const statusColorClass = isPaid
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : isPending
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-red-100 text-red-800 border border-red-200';

                    const isCurrentYear = yr === String(new Date().getFullYear());

                    return (
                      <div key={yr} className={`py-4 flex items-start justify-between gap-4 first:pt-0 last:pb-0 ${isCurrentYear ? 'relative' : ''}`}>
                        {isCurrentYear && (
                          <div className="absolute -left-1 top-3 bottom-3 w-0.5 bg-jci-blue rounded-full" />
                        )}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-black ${isCurrentYear ? 'text-jci-blue' : 'text-slate-900'}`}>
                              {yr} Membership Dues
                            </span>
                            {isCurrentYear && (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-jci-blue/10 text-jci-blue px-1.5 py-0.5 rounded">
                                Current Year
                              </span>
                            )}
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColorClass}`}>
                              {record.status}
                            </span>
                          </div>
                          {record.paymentDate && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar size={11} className="text-slate-400" />
                              Paid on: {formatDateToDDMMMYYYY(record.paymentDate)}
                            </p>
                          )}
                          {record.purpose && (
                            <p className="text-xs text-slate-500 italic leading-relaxed">
                              "{record.purpose}"
                            </p>
                          )}
                          {Array.isArray(record.transactionId) && record.transactionId.length > 0 && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              {record.transactionId.length} transaction{record.transactionId.length > 1 ? 's' : ''} linked
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-base font-black ${isPaid ? 'text-green-700' : isPending ? 'text-amber-700' : 'text-red-700'}`}>
                            RM {record.amount || 0}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Target: RM {record.dues || 0}
                          </p>
                          {record.dues > 0 && record.amount >= record.dues && (
                            <p className="text-[10px] text-green-600 font-bold">âœ“ Fulfilled</p>
                          )}
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="py-10 text-center text-slate-400">
                  <Coins size={36} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-sm font-medium">No payment history found.</p>
                  <p className="text-xs mt-1">Dues records will appear here once processed.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setShowPaymentHistoryModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showMentorMatchModal && (
        <MentorMatchingModal
          mentee={member}
          potentialMentors={potentialMentors}
          onSelect={handleAssignMentor}
          onClose={() => setShowMentorMatchModal(false)}
        />
      )}

      {showChurnModal && churnPrediction && (
        <ChurnPredictionModal
          member={member}
          prediction={churnPrediction}
          onClose={() => setShowChurnModal(false)}
        />
      )}


      {showDeleteConfirm && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => !isDeleting && setShowDeleteConfirm(false)}
          title="Confirm Member Deletion"
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-900">Warning: This action is permanent.</p>
                <p className="text-sm text-red-700 mt-1">
                  Are you sure you want to delete member <strong>{member.name}</strong>? All their data, points, and history will be removed.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteMember} isLoading={isDeleting}>Delete Member</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
