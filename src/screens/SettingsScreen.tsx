import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { 
  Save, Building2, Clock, Stethoscope, Users, Bell, Plus, AlertCircle, 
  RefreshCw, QrCode, Link2, Share2, FileText, Download, Eye, ExternalLink, 
  Shield, UploadCloud, Edit3, Trash2, CheckCircle2, XCircle, PhoneCall, 
  Mail, Award, Briefcase, IndianRupee, MapPin, GraduationCap, Search, 
  FileCheck, Check, Upload, X, ShieldCheck, Copy, Printer, Smartphone,
  Crown, Sparkles, Zap, MessageSquare, HardDrive, AlertTriangle, HelpCircle,
  DollarSign, PauseCircle, ArrowLeftRight, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown
} from 'lucide-react';
import { DEFAULT_PLANS, getUsageCounter, getEffectiveLimits } from '../lib/entitlementsService';
import type { UsageCounter, PlanLimits } from '../lib/types';
import { db, firebaseConfig, storage, functions } from '../lib/firebase';
import { 
  collection, query, where, getDocs, updateDoc, doc, setDoc, 
  getDoc, onSnapshot, arrayUnion, arrayRemove, addDoc, serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, updatePassword } from "firebase/auth";
import { assertPasswordUniqueness, claimPasswordHash, getPasswordValidationError } from '../lib/passwordSecurity';
import { PasswordRequirementsGuide } from '../components/PasswordRequirementsGuide';
import { sendPasswordResetNotificationEmail } from '../lib/emailService';
import { sendWhatsAppDoctorAddedViaAPI } from '../lib/whatsappClientService';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { Modal } from '../components/Modal';
import { Loading, SectionHeader, Avatar, EmptyState } from '../components/ui';
import { SubscriptionInvoiceView } from '../components/SubscriptionInvoiceView';
import { RazorpaySubscriptionButton } from '../components/RazorpaySubscriptionButton';
import type { ClinicSettings, User, Role } from '../lib/types';
import { formatDate, formatTime, parseDateArg } from '../lib/format';
import { generateReadableId } from '../lib/identityResolver';
import { 
  getSubscriptionPeriodEnd, 
  checkAndResolveSubscriptionPeriod, 
  scheduleSubscriptionPlanChange, 
  cancelScheduledPlanChange, 
  scheduleSubscriptionCancellation, 
  revertSubscriptionCancellation 
} from '../lib/subscriptionLifecycle';
import type { Clinic } from '../lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CANCELLATION_REASONS = [
  {
    id: 'cost',
    title: 'Cost is too high / Budget constraints',
    desc: 'The subscription cost is beyond our clinic budget.',
    icon: DollarSign
  },
  {
    id: 'features',
    title: 'Missing features needed for our clinic',
    desc: 'The platform lacks specific clinical or operational features we need.',
    icon: Zap
  },
  {
    id: 'alternative',
    title: 'Switching to another clinic management software',
    desc: 'We are moving to another healthcare platform or vendor.',
    icon: ArrowLeftRight
  },
  {
    id: 'complexity',
    title: 'Too difficult to use / Staff onboarding challenges',
    desc: 'Our staff or doctors found the system too complex to adopt.',
    icon: Users
  },
  {
    id: 'closure',
    title: 'Temporary closure or seasonal slowdown',
    desc: 'Our practice is temporarily closed or downsizing operations.',
    icon: PauseCircle
  },
  {
    id: 'other',
    title: 'Other reason (please specify)',
    desc: 'A different reason not listed above.',
    icon: HelpCircle
  }
];

type Tab = 'profile' | 'hours' | 'doctors' | 'staff' | 'notifications' | 'patient-access' | 'billing';
const VALID_TABS: Tab[] = ['profile', 'hours', 'doctors', 'staff', 'notifications', 'patient-access', 'billing'];

export function SettingsScreen() {
  const { clinic, user, logout } = useAuth();
  if (user?.role === 'doctor' || user?.role === 'clinic_doctor') {
    return <Navigate to="/doctor/dashboard" replace />;
  }
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as Tab | null;
  const tab: Tab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'profile';

  const setTab = (newTab: Tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    }, { replace: true });
  };
  const [loading, setLoading] = useState(true);
  const [viewingSubscription, setViewingSubscription] = useState<any | null>(null);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicCity, setClinicCity] = useState('');
  const [clinicSpeciality, setClinicSpeciality] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicEmail, setClinicEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [openHours, setOpenHours] = useState('09:00');
  const [closeHours, setCloseHours] = useState('19:00');
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [slotDuration, setSlotDuration] = useState(20);
  const [upiId, setUpiId] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserRole, setAddUserRole] = useState<Role>('doctor');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  // Account Security & Password State
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [pwdUpdating, setPwdUpdating] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const handleUpdateAccountPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    const valErr = getPasswordValidationError(pwdNew, pwdConfirm);
    if (valErr) {
      setPwdError(valErr);
      return;
    }

    const authInstance = getAuth();
    if (!authInstance.currentUser) {
      setPwdError('No active authentication session. Please sign in again.');
      return;
    }

    setPwdUpdating(true);
    try {
      const uniqCheck = await assertPasswordUniqueness(pwdNew, authInstance.currentUser.uid);
      if (!uniqCheck.ok) {
        setPwdError(uniqCheck.error || 'This password is already in use by another user.');
        setPwdUpdating(false);
        return;
      }

      await updatePassword(authInstance.currentUser, pwdNew);
      await claimPasswordHash(uniqCheck.hash, authInstance.currentUser.uid, authInstance.currentUser.email || '');

      const uid = user?.id || user?.user_id || authInstance.currentUser.uid;
      try {
        await updateDoc(doc(db, 'users', uid), {
          auth_providers: arrayUnion('password'),
          updated_at: new Date().toISOString()
        });
      } catch (docErr) {
        console.warn('Update user auth_providers warning:', docErr);
      }

      setPwdSuccess('Password updated successfully!');
      setPwdNew('');
      setPwdConfirm('');
      toast('Your account password has been updated successfully', 'success');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setPwdError('For security, please sign out and sign back in before changing your password.');
      } else {
        setPwdError(err.message || 'Failed to update password.');
      }
    } finally {
      setPwdUpdating(false);
    }
  };

  // User management modals
  const [uploadDocUser, setUploadDocUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [detailsUser, setDetailsUser] = useState<User | null>(null);

  // Clinic verification documents
  const [liveClinic, setLiveClinic] = useState<any>(clinic || null);
  const [uploadClinicDocsOpen, setUploadClinicDocsOpen] = useState(false);
  const [usageCounter, setUsageCounter] = useState<UsageCounter | null>(null);
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState<'solo' | 'clinic' | 'multispecialty'>('clinic');
  const [upgradeCycle, setUpgradeCycle] = useState<'monthly' | 'annual'>('monthly');

  // Cancel Subscription states
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelCustomReason, setCancelCustomReason] = useState<string>('');
  const [cancelFeedback, setCancelFeedback] = useState<string>('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const [scheduledCancelDate, setScheduledCancelDate] = useState<string>('');

  const activeClinic = (liveClinic || clinic) as Clinic;
  const periodInfo = useMemo(() => {
    try {
      return getSubscriptionPeriodEnd(activeClinic);
    } catch (e) {
      console.warn('Fallback computing subscription period end:', e);
      const now = new Date();
      const fallbackEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return {
        date: fallbackEnd,
        iso: fallbackEnd.toISOString(),
        formatted: '—',
        daysRemaining: 30
      };
    }
  }, [activeClinic]);

  const handleCancelSubscription = async () => {
    if (!activeClinic) return;
    if (!cancelReason) {
      toast('Please select a reason for cancelling.', 'error');
      return;
    }
    if (cancelReason === 'other' && !cancelCustomReason.trim()) {
      toast('Please specify your reason for cancelling.', 'error');
      return;
    }

    setCancelling(true);
    try {
      const selectedObj = CANCELLATION_REASONS.find(r => r.id === cancelReason);
      const reasonText = cancelReason === 'other' 
        ? `Other: ${cancelCustomReason.trim()}`
        : (selectedObj?.title || cancelReason);

      const res = await scheduleSubscriptionCancellation(
        activeClinic, 
        user, 
        reasonText, 
        cancelFeedback.trim()
      );

      if (res.ok) {
        setScheduledCancelDate(res.effectiveDate);
        setCancelSuccess(true);
        toast(`Cancellation scheduled for ${res.effectiveDate}. Your plan remains active until then.`, 'info');
      } else {
        toast(res.error || 'Failed to schedule cancellation. Please contact support.', 'error');
      }
    } catch (err: any) {
      console.error('Cancellation error:', err);
      toast(err?.message || 'Failed to cancel subscription. Please contact support.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const [changingPlan, setChangingPlan] = useState(false);

  const handleDirectPlanChange = async (targetTier: string, targetCycle: string, type: 'downgrade' | 'upgrade' | 'switch') => {
    const activeClinic = (liveClinic || clinic) as Clinic;
    if (!activeClinic) return;
    setChangingPlan(true);
    try {
      const changeType = type === 'downgrade' ? 'downgrade' : 'upgrade';
      const res = await scheduleSubscriptionPlanChange(activeClinic, user, targetTier, targetCycle, changeType);
      if (res.ok) {
        toast(`Plan ${changeType} scheduled for ${res.effectiveDate}! Full access to your current plan remains active until then.`, 'success');
        setChangePlanModalOpen(false);
      } else {
        toast(res.error || 'Failed to schedule plan change', 'error');
      }
    } catch (err: any) {
      console.error('Plan change error:', err);
      toast(err?.message || 'Failed to update plan. Please try again.', 'error');
    } finally {
      setChangingPlan(false);
    }
  };

  useEffect(() => {
    if (!clinic) return;
    setClinicName(clinic.name);
    setClinicAddress(clinic.address ?? '');
    setClinicCity(clinic.city ?? '');
    setClinicSpeciality(clinic.speciality ?? '');
    setClinicPhone(clinic.phone ?? '');
    setClinicEmail(clinic.email ?? '');
    setLogoUrl(clinic.logo_url ?? '');
    if (clinic.working_hours) {
      setOpenHours(clinic.working_hours.open ?? '09:00');
      setCloseHours(clinic.working_hours.close ?? '19:00');
      setWorkingDays(clinic.working_hours.days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    }
    const unsubs: (() => void)[] = [];

    // Live clinic document listener for verification docs and real-time status
    const unsubClinic = onSnapshot(doc(db, 'clinics', clinic.clinic_id), (snap) => {
      if (snap.exists()) {
        const cData = { clinic_id: snap.id, ...snap.data() } as Clinic;
        setLiveClinic(cData);
        if (cData.city !== undefined) setClinicCity(cData.city || '');
        if (cData.speciality !== undefined) setClinicSpeciality(cData.speciality || '');
        if (cData.working_hours) {
          if (cData.working_hours.open) setOpenHours(cData.working_hours.open);
          if (cData.working_hours.close) setCloseHours(cData.working_hours.close);
          if (cData.working_hours.days && cData.working_hours.days.length) {
            setWorkingDays(cData.working_hours.days);
          }
        }
        // Automatically check if subscription period has ended and resolve scheduled events
        checkAndResolveSubscriptionPeriod(cData, user?.user_id).catch(() => {});
      }
    });
    unsubs.push(unsubClinic);

    const unsubSettings = onSnapshot(doc(db, 'clinic_settings', clinic.clinic_id), (snap) => {
      const settingsData = snap.exists() ? snap.data() as ClinicSettings : null;
      setSettings(settingsData);
      if (settingsData) {
        setSlotDuration(settingsData.slot_duration_minutes ?? 20);
        setUpiId((settingsData as any).upi_id ?? '');
      }
    });
    unsubs.push(unsubSettings);

    // Live query for all clinic users (without orderBy so no composite index is needed)
    const usersQ = query(collection(db, 'users'), where('clinic_id', '==', clinic.clinic_id));
    const unsubUsers = onSnapshot(usersQ, async (snap) => {
      const map = new Map<string, User>();
      snap.docs.forEach((d) => {
        const data = d.data();
        map.set(d.id, { ...data, user_id: data.user_id || d.id, id: d.id } as User);
      });

      // If clinic owner user exists and wasn't returned in query, include them
      if (clinic.owner_user_id && !map.has(clinic.owner_user_id)) {
        try {
          const ownerSnap = await getDoc(doc(db, 'users', clinic.owner_user_id));
          if (ownerSnap.exists()) {
            const oData = ownerSnap.data();
            map.set(clinic.owner_user_id, { ...oData, user_id: oData.user_id || ownerSnap.id, id: ownerSnap.id } as User);
          }
        } catch (e) {
          console.warn('Owner user lookup:', e);
        }
      }

      const list = Array.from(map.values());
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setUsers(list);
    }, (err) => console.warn('Users live sync:', err));
    unsubs.push(unsubUsers);

    // Live subscriptions
    const subsQ = query(collection(db, 'subscriptions'), where('clinic_id', '==', clinic.clinic_id));
    const unsubSubs = onSnapshot(subsQ, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const ta = parseDateArg(a.created_at).getTime() || 0;
        const tb = parseDateArg(b.created_at).getTime() || 0;
        return tb - ta;
      });
      setSubscriptions(list);
    }, (err) => console.warn('Subs live sync:', err));
    unsubs.push(unsubSubs);

    // Fetch monthly usage counters (AI intakes, WhatsApp, storage)
    getUsageCounter(clinic.clinic_id).then(counter => {
      setUsageCounter(counter);
    }).catch(e => console.warn('Failed to load usage counter:', e));

    setLoading(false);

    return () => unsubs.forEach(u => u());
  }, [clinic]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'clinics', clinic!.clinic_id), {
        name: clinicName,
        address: clinicAddress,
        city: clinicCity,
        speciality: clinicSpeciality,
        phone: clinicPhone,
        email: clinicEmail,
        logo_url: logoUrl
      });
      toast('Clinic profile updated.', 'success');
    } catch(error) {
      toast('Unable to update clinic profile. Please try again.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clinic) return;
    
    setUploadingLogo(true);
    try {
      const storageRef = ref(storage, `clinics/${clinic.clinic_id}/logo_${Date.now()}`);
      const uploadTask = await uploadBytesResumable(storageRef, file);
      const url = await getDownloadURL(uploadTask.ref);
      setLogoUrl(url);
      await updateDoc(doc(db, 'clinics', clinic.clinic_id), { logo_url: url });
      toast('Logo uploaded successfully.', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to upload logo.', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveHours = async () => {
    setSavingHours(true);
    const wh = { open: openHours, close: closeHours, days: workingDays };
    try {
      await updateDoc(doc(db, 'clinics', clinic!.clinic_id), { working_hours: wh });
      const upsertData = { clinic_id: clinic!.clinic_id, setting_id: clinic!.clinic_id, slot_duration_minutes: slotDuration, upi_id: upiId || null };
      await setDoc(doc(db, 'clinic_settings', clinic!.clinic_id), upsertData, { merge: true });
      setSettings(prev => prev ? { ...prev, ...upsertData } : upsertData as any);
      toast('Working hours & slots updated.', 'success');
    } catch (e) {
      toast('Unable to save configuration.', 'error');
    } finally {
      setSavingHours(false);
    }
  };

  const toggleDay = (d: string) => setWorkingDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const toggleReminder = async (key: 'whatsapp_reminders_enabled' | 'sms_reminders_enabled', val: boolean) => {
    if (!settings) return;
    try {
      await updateDoc(doc(db, 'clinic_settings', clinic!.clinic_id), { [key]: val });
      setSettings({ ...settings, [key]: val });
      toast(`${key === 'whatsapp_reminders_enabled' ? 'WhatsApp' : 'SMS'} reminders ${val ? 'enabled' : 'disabled'}.`, 'success');
    } catch(e) {
      toast('Unable to update settings. Please try again.', 'error');
    }
  };

  const addUser = async (data: { 
    name: string; 
    email: string; 
    role: Role; 
    phone: string; 
    specialisation: string; 
    designation: string;
    experience_years: number | null;
    consultation_fee: number | null;
    qualifications: string;
    password: string;
  }) => {
    try {
      const planCode = (clinic?.subscription_plan as any) || 'solo';
      const matchedPlan = DEFAULT_PLANS.find(p => p.id === planCode) || DEFAULT_PLANS[0];
      const limits = getEffectiveLimits(matchedPlan);
      const isDoc = data.role === 'clinic_doctor' || data.role === 'doctor';

      if (isDoc) {
        const currentDocCount = users.filter(u => u.role === 'doctor' || u.role === 'clinic_doctor').length;
        if (currentDocCount >= limits.doctors_included) {
          toast(`Doctor seat limit reached (${limits.doctors_included} max on ${matchedPlan.name} plan). Please upgrade your tier.`, 'error');
          return;
        }
      } else {
        const currentStaffCount = users.filter(u => u.role === 'staff' || u.role === 'clinic_staff' || u.role === 'clinic_admin').length;
        if (currentStaffCount >= limits.staff_seats_included) {
          toast(`Staff seat limit reached (${limits.staff_seats_included} max on ${matchedPlan.name} plan). Please upgrade your tier.`, 'error');
          return;
        }
      }

      // create user with secondary app to avoid logging out the current user
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email.toLowerCase(), data.password);
      const userId = userCredential.user.uid;
      
      const resolvedRole: Role = isDoc ? 'clinic_doctor' : (data.role === 'admin' ? 'clinic_admin' : 'clinic_staff');
      const prefix = isDoc ? 'DOC' : 'STF';
      const displayId = generateReadableId(prefix, userId);

      const newUser: User = {
        user_id: userId,
        clinic_id: clinic!.clinic_id,
        clinic_name: clinic!.name,
        name: data.name,
        full_name: data.name,
        email: data.email.toLowerCase(),
        role: resolvedRole,
        user_type: resolvedRole,
        display_id: displayId,
        id_number: displayId,
        phone: data.phone || null,
        specialisation: data.specialisation || (isDoc ? 'General Medicine' : null),
        designation: data.designation || (isDoc ? 'Consulting Physician' : 'Staff Member'),
        experience_years: data.experience_years ?? (isDoc ? 1 : 0),
        consultation_fee: data.consultation_fee ?? (isDoc ? 300 : null),
        qualifications: data.qualifications || null,
        active: isDoc ? false : true,
        verification_status: isDoc ? 'pending' : 'approved',
        avatar_color: isDoc ? '#05C994' : resolvedRole === 'clinic_admin' ? '#0F6E56' : '#E08600',
        certificates: [],
        onboarding_documents: [],
        created_at: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', userId), newUser);
      await secondaryAuth.signOut();
      
      // 1. Send password setup email to new user
      try {
        await sendPasswordResetNotificationEmail(data.email.toLowerCase(), '/clinic/login', 'clinic');
      } catch (emailErr) {
        console.warn('Failed to dispatch password setup email:', emailErr);
      }

      // 2. If user is a doctor and has phone number, dispatch WhatsApp registration notice
      if (isDoc && data.phone) {
        try {
          await sendWhatsAppDoctorAddedViaAPI({
            to: data.phone,
            doctorName: data.name,
            clinicName: clinic!.name,
            email: data.email.toLowerCase(),
            clinicPhone: clinic!.phone || '+91 73961 11081',
            clinicId: clinic!.clinic_id,
          });
        } catch (waErr) {
          console.warn('Failed to dispatch WhatsApp doctor added notice:', waErr);
        }
      }

      toast(`${data.name} added successfully. ${isDoc ? 'Doctor verification submitted to platform administration.' : ''}`, 'success');
      setAddUserOpen(false);
      setUsers(prev => [...prev.filter(x => x.user_id !== userId), newUser]);
    } catch (e: any) {
      console.error('Error adding user:', e);
      toast(e.message || 'Unable to add this user. Please try again.', 'error');
    }
  };

  const resetPassword = async (u: User) => {
    try {
      const res = await sendPasswordResetNotificationEmail(u.email, '/clinic/login', 'clinic');
      if (res.success) {
        toast(`Password reset email sent to ${u.email}`, 'success');
      } else {
        toast(res.error || 'Unable to send reset email. Please try again.', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Unable to send reset email. Please try again.', 'error');
    }
  };

  const toggleActive = async (u: User) => {
    try {
      const newStatus = !u.active;
      await updateDoc(doc(db, 'users', u.user_id), { active: newStatus });
      setUsers(users.map(x => x.user_id === u.user_id ? { ...x, active: newStatus } : x));
      toast(`${u.name} ${newStatus ? 'activated' : 'deactivated'}.`, 'success');
    } catch(e) {
      toast('Unable to update user status. Please try again.', 'error');
    }
  };

  const handleSaveEditedUser = async (targetUserId: string, updatedFields: Partial<User>) => {
    try {
      await updateDoc(doc(db, 'users', targetUserId), {
        ...updatedFields,
        updated_at: new Date().toISOString()
      });
      setUsers(prev => prev.map(u => u.user_id === targetUserId ? { ...u, ...updatedFields } : u));
      if (detailsUser && detailsUser.user_id === targetUserId) {
        setDetailsUser(prev => prev ? { ...prev, ...updatedFields } : null);
      }
      toast('Profile updated successfully.', 'success');
      setEditUser(null);
    } catch (e: any) {
      console.error(e);
      toast('Failed to update profile.', 'error');
    }
  };

  const handleDeleteDocument = async (targetUser: User, docItem: { name: string; url: string }) => {
    if (!window.confirm(`Are you sure you want to remove the document "${docItem.name}"?`)) return;
    try {
      await updateDoc(doc(db, 'users', targetUser.user_id), {
        certificates: arrayRemove(docItem),
        onboarding_documents: arrayRemove(docItem)
      });
      setUsers(prev => prev.map(u => {
        if (u.user_id !== targetUser.user_id) return u;
        return {
          ...u,
          certificates: (u.certificates || []).filter(c => c.url !== docItem.url),
          onboarding_documents: (u.onboarding_documents || []).filter(c => c.url !== docItem.url)
        };
      }));
      if (detailsUser && detailsUser.user_id === targetUser.user_id) {
        setDetailsUser(prev => prev ? {
          ...prev,
          certificates: (prev.certificates || []).filter(c => c.url !== docItem.url),
          onboarding_documents: (prev.onboarding_documents || []).filter(c => c.url !== docItem.url)
        } : null);
      }
      toast(`Document "${docItem.name}" removed.`, 'success');
    } catch (e: any) {
      console.error(e);
      toast('Failed to remove document.', 'error');
    }
  };

  const clinicDocs = useMemo(() => {
    const list: any[] = [];
    const rawOnboarding = liveClinic?.onboarding_documents || clinic?.onboarding_documents;
    if (Array.isArray(rawOnboarding)) {
      rawOnboarding.forEach(d => {
        if (d && (d.url || d.file_url)) {
          list.push({ ...d, url: d.url || d.file_url, name: d.name || 'Clinic Document' });
        }
      });
    }
    const rawDocs = liveClinic?.documents || clinic?.documents;
    if (Array.isArray(rawDocs)) {
      rawDocs.forEach(d => {
        if (d && (d.url || d.file_url) && !list.some(x => x.url === (d.url || d.file_url))) {
          list.push({ ...d, url: d.url || d.file_url, name: d.name || 'Clinic Document' });
        }
      });
    }
    return list;
  }, [liveClinic, clinic]);

  const handleDeleteClinicDoc = async (docItem: any) => {
    if (!clinic?.clinic_id) return;
    if (!window.confirm(`Are you sure you want to remove the verification document "${docItem.name}"?`)) return;
    try {
      await updateDoc(doc(db, 'clinics', clinic.clinic_id), {
        onboarding_documents: arrayRemove(docItem),
        updated_at: new Date().toISOString()
      });
      toast(`Clinic document "${docItem.name}" removed.`, 'success');
    } catch (e: any) {
      console.error(e);
      toast('Failed to remove clinic document.', 'error');
    }
  };

  if (loading || !clinic) return <Loading label="Loading settings…" />;

  const tabs: { key: Tab; label: string; Icon: any }[] = [
    { key: 'profile', label: 'Clinic profile', Icon: Building2 },
    { key: 'hours', label: 'Working hours', Icon: Clock },
    { key: 'doctors', label: 'Doctors', Icon: Stethoscope },
    { key: 'staff', label: 'Staff', Icon: Users },
    { key: 'notifications', label: 'Notifications', Icon: Bell },
    { key: 'patient-access', label: 'Patient Access', Icon: QrCode },
    { key: 'billing', label: 'Subscription & Billing', Icon: Save },
  ];

  if (viewingSubscription && clinic) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm p-4 overflow-auto flex items-center justify-center">
        <div className="bg-white w-full max-w-[210mm] min-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
          <SubscriptionInvoiceView
            subscription={viewingSubscription}
            clinic={clinic}
            onClose={() => setViewingSubscription(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-ink-muted">Manage clinic profile, staff, and configuration</p>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-primary-50/60 p-0.5 overflow-x-auto">
        {tabs.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${tab === key ? 'bg-white text-primary shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-5 max-w-3xl">
          <div className="card space-y-3">
            <SectionHeader title="Clinic profile" subtitle="Basic clinic information shown across the app" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Clinic name</label><input className="input" value={clinicName} onChange={e => setClinicName(e.target.value)} /></div>
              <div><label className="label">Speciality / Department</label><input className="input" value={clinicSpeciality} onChange={e => setClinicSpeciality(e.target.value)} placeholder="e.g. General Practice, Paediatrics" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Address</label><input className="input" value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} /></div>
              <div><label className="label">City</label><input className="input" value={clinicCity} onChange={e => setClinicCity(e.target.value)} placeholder="e.g. Bangalore" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Phone</label><input className="input" value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} /></div>
              <div><label className="label">Email</label><input className="input" value={clinicEmail} onChange={e => setClinicEmail(e.target.value)} /></div>
            </div>
            <div>
              <label className="label">Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden shrink-0">
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <Building2 className="text-gray-400" size={32} />}
                </div>
                <div className="flex-1">
                  <label className="btn-secondary cursor-pointer inline-flex w-auto">
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  </label>
                  <p className="text-[10px] text-ink-subtle mt-2">Maximum file size 2MB. Recommended size: 500x500px. (PNG or JPG)</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button onClick={saveProfile} disabled={savingProfile} className="btn-primary"><Save size={14} /> {savingProfile ? 'Saving…' : 'Save profile'}</button>
              <button onClick={logout} className="btn-ghost text-danger">Sign out</button>
            </div>
          </div>

          {/* Clinic Verification & Legal Documents Card */}
          <div className="card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-ink flex items-center gap-2">
                    <ShieldCheck size={18} className="text-teal-600" />
                    Clinic Verification & Legal Documents
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    (liveClinic?.verification_status || clinic?.verification_status) === 'approved' 
                      ? 'bg-teal-100 text-teal-800 border border-teal-200' 
                      : (liveClinic?.verification_status || clinic?.verification_status) === 'rejected'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {liveClinic?.verification_status || clinic?.verification_status || 'Pending Verification'}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  Establishment licenses, registration certificates, GST records, and compliance records ({clinicDocs.length} attached)
                </p>
              </div>

              <button 
                onClick={() => setUploadClinicDocsOpen(true)}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shrink-0"
              >
                <UploadCloud size={14} /> + Upload Verification Documents
              </button>
            </div>

            {clinicDocs.length === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-black/15 bg-slate-50/50 text-center space-y-2">
                <FileText size={28} className="mx-auto text-ink-subtle opacity-60" />
                <p className="text-xs font-semibold text-ink">No legal or regulatory documents attached yet</p>
                <p className="text-[11px] text-ink-muted max-w-sm mx-auto">
                  Upload multiple licenses, tax registrations, and clinical establishment certificates at once for real-time verification.
                </p>
                <button 
                  onClick={() => setUploadClinicDocsOpen(true)}
                  className="btn-secondary text-xs inline-flex items-center gap-1.5 mt-2"
                >
                  <UploadCloud size={14} /> Upload Documents (Multiple)
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clinicDocs.map((docItem, idx) => (
                  <div key={idx} className="p-3 bg-white border border-black/10 rounded-xl flex items-center justify-between gap-3 hover:border-primary/40 transition shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink truncate" title={docItem.name}>
                          {docItem.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-teal-700 font-semibold uppercase">
                            {docItem.type || 'Clinic Legal Doc'}
                          </span>
                          {docItem.uploaded_at && (
                            <span className="text-[10px] text-ink-subtle">
                              • {formatDate(docItem.uploaded_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <a 
                        href={docItem.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="p-1.5 rounded-lg bg-gray-50 hover:bg-primary-50 text-primary transition"
                        title="View Document"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <a 
                        href={docItem.url} 
                        download 
                        className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-slate-700 transition"
                        title="Download File"
                      >
                        <Download size={14} />
                      </a>
                      <button 
                        onClick={() => handleDeleteClinicDoc(docItem)}
                        className="p-1.5 rounded-lg bg-gray-50 hover:bg-rose-50 text-danger transition"
                        title="Remove Document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account Security & Password Card */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <ShieldCheck size={18} className="text-teal-600" />
                  Account Security & Password
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Update your authentication password for {user?.email || 'your account'}
                </p>
              </div>
            </div>

            {pwdSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            {pwdError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <span>{pwdError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateAccountPassword} className="space-y-4 max-w-md">
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <input
                    type={showPwdNew ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Enter new password (min. 8 characters)"
                    value={pwdNew}
                    onChange={e => setPwdNew(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwdNew(!showPwdNew)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPwdNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showPwdConfirm ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Re-enter new password"
                    value={pwdConfirm}
                    onChange={e => setPwdConfirm(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwdConfirm(!showPwdConfirm)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPwdConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <PasswordRequirementsGuide password={pwdNew} />

              <button
                type="submit"
                disabled={pwdUpdating || !pwdNew}
                className="btn-primary"
              >
                {pwdUpdating ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {pwdUpdating ? 'Updating Password…' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'hours' && (
        <div className="card max-w-2xl space-y-5">
          <SectionHeader title="Working hours & slots" subtitle="Set open/close time, days, and appointment slot duration" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Opens</label><input type="time" className="input" value={openHours} onChange={e => setOpenHours(e.target.value)} /></div>
            <div><label className="label">Closes</label><input type="time" className="input" value={closeHours} onChange={e => setCloseHours(e.target.value)} /></div>
          </div>
          <div>
            <label className="label">Working days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => {
                const active = workingDays.includes(d);
                return (
                  <button key={d} onClick={() => toggleDay(d)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${active ? 'bg-primary border-primary text-white' : 'border-ink-subtle/30 text-ink-muted hover:border-primary/50'}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label">Appointment slot duration</label>
            <div className="flex items-center gap-2">
              {[15, 20, 30].map(d => (
                <button key={d} onClick={() => setSlotDuration(d)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold border transition ${slotDuration === d ? 'bg-primary border-primary text-white' : 'border-ink-subtle/30 text-ink-muted hover:border-primary/50'}`}>
                  {d} min
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Clinic UPI ID (for invoices)</label>
            <input className="input" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="clinic@upi" />
          </div>
          <button onClick={saveHours} disabled={savingHours} className="btn-primary"><Save size={14} /> {savingHours ? 'Saving…' : 'Save configuration'}</button>
        </div>
      )}

      {(tab === 'doctors' || tab === 'staff') && (
        <UserManagement 
          tab={tab} 
          users={users} 
          clinic={clinic}
          onAdd={() => {
            const planCode = (clinic.subscription_plan as any) || 'solo';
            const matchedPlan = DEFAULT_PLANS.find(p => p.id === planCode) || DEFAULT_PLANS[0];
            const limits = getEffectiveLimits(matchedPlan);

            if (tab === 'doctors') {
              const currentDocCount = users.filter(u => u.role === 'doctor' || u.role === 'clinic_doctor').length;
              if (currentDocCount >= limits.doctors_included) {
                toast(`Doctor seat limit reached (${limits.doctors_included} max on ${matchedPlan.name} plan). Please upgrade your tier or add a doctor seat.`, 'error');
                return;
              }
              setAddUserRole('doctor');
            } else {
              const currentStaffCount = users.filter(u => u.role === 'staff' || u.role === 'clinic_staff' || u.role === 'clinic_admin').length;
              if (currentStaffCount >= limits.staff_seats_included) {
                toast(`Staff seat limit reached (${limits.staff_seats_included} max on ${matchedPlan.name} plan). Please upgrade your tier to add more staff.`, 'error');
                return;
              }
              setAddUserRole('staff');
            }
            setAddUserOpen(true);
          }} 
          onReset={resetPassword} 
          onToggle={toggleActive} 
          onEdit={(u) => setEditUser(u)}
          onUploadDoc={(u) => setUploadDocUser(u)}
          onDeleteDoc={handleDeleteDocument}
          onViewDetails={(u) => setDetailsUser(u)}
        />
      )}

      {tab === 'notifications' && settings && (
        <div className="card max-w-2xl space-y-4">
          <SectionHeader title="Notification settings" subtitle="Configure patient reminders" />
          <ToggleRow title="WhatsApp reminders" description="Send WhatsApp appointment reminders to patients when clicking the Remind button." checked={settings.whatsapp_reminders_enabled} onChange={v => toggleReminder('whatsapp_reminders_enabled', v)} />
          <ToggleRow title="SMS reminders (future)" description="SMS gateway integration is on the roadmap. Toggle is for future use only." checked={settings.sms_reminders_enabled} onChange={v => toggleReminder('sms_reminders_enabled', v)} />
          <div className="flex items-start gap-2 text-xs text-ink-subtle rounded-lg bg-primary-50/50 p-3 mt-2">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>Reminders open WhatsApp web with a pre-filled message — no API key required for MVP.</span>
          </div>
        </div>
      )}

      {tab === 'patient-access' && (
        <PatientAccessTab clinicId={clinic.clinic_id} clinicName={clinic.name} clinicPhone={clinic.phone} />
      )}

      {tab === 'billing' && (
        <div className="space-y-6">
          {(() => {
            const activeClinic = (liveClinic || clinic) as Clinic;
            const planCode = (activeClinic.subscription_plan as any) || 'solo';
            const matchedPlan = DEFAULT_PLANS.find(p => p.id === planCode) || DEFAULT_PLANS[0];
            const limits = getEffectiveLimits(matchedPlan);
            const periodInfo = getSubscriptionPeriodEnd(activeClinic);
            const doctorsCount = users.filter(u => u.role === 'doctor' || u.role === 'clinic_doctor').length;
            const staffCount = users.filter(u => u.role === 'staff' || u.role === 'clinic_staff' || u.role === 'clinic_admin').length;
            const aiUsed = usageCounter?.ai_intakes_used || 0;
            const whatsappUsed = usageCounter?.whatsapp_messages_used || 0;
            const storageGbUsed = Number(((usageCounter?.storage_bytes_used || 0) / (1024 * 1024 * 1024)).toFixed(1));

            return (
              <>
                {activeClinic.subscription_status !== 'active' && !activeClinic.cancel_at_period_end && (
                  <div className="bg-gradient-to-r from-primary to-[#0A4B3A] rounded-2xl p-5 sm:p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold">Upgrade Your Clinic Plan</h2>
                      <p className="text-white/80 text-sm mt-1">
                        Unlock more doctor seats, higher AI triage intake allowances, and automated WhatsApp patient CRM.
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setUpgradeTier((activeClinic.subscription_plan as any) || 'clinic');
                        setChangePlanModalOpen(true);
                      }}
                      className="shrink-0 bg-white text-primary px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 transition-colors"
                    >
                      View Plans & Upgrade
                    </button>
                  </div>
                )}

                <div className="card">
                  <SectionHeader title="Live Subscription & Tier" subtitle="Current plan and operational entitlements" />
                  
                  <div className="p-5 border border-primary/20 bg-primary-50/20 rounded-2xl mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Crown size={20} className="text-accent" />
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">Active Plan</span>
                        </div>
                        <h3 className="text-2xl font-bold text-ink mt-1">
                          {matchedPlan.name} Plan
                        </h3>
                        <p className="text-sm text-ink-muted mt-1">
                          Status:{' '}
                          {activeClinic.subscription_status === 'cancelled' ? (
                            <span className="font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wide">
                              Cancelled
                            </span>
                          ) : activeClinic.cancel_at_period_end ? (
                            <span className="font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wide">
                              Active (Cancelling on {periodInfo.formatted})
                            </span>
                          ) : activeClinic.change_scheduled ? (
                            <span className="font-semibold text-teal-800 bg-teal-100 border border-teal-300 px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wide">
                              Active (Switching on {periodInfo.formatted})
                            </span>
                          ) : activeClinic.subscription_status === 'trial' ? (
                            <span className="font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wide">
                              🌟 30-Day Free Trial Active
                            </span>
                          ) : (
                            <span className="font-semibold text-primary capitalize">
                              {activeClinic.subscription_status === 'free_plan' ? 'Active (30-Day Free Trial)' : (activeClinic.subscription_status || 'Active')}
                            </span>
                          )}
                        </p>
                        
                        <p className="text-xs text-ink-muted mt-1.5 font-medium">
                          Billing Cycle: <strong className="text-ink capitalize">{activeClinic.subscription_billing_cycle || 'monthly'}</strong>
                          {activeClinic.subscription_status !== 'cancelled' && (
                            <> • Active Until: <strong className="text-primary">{periodInfo.formatted}</strong> ({periodInfo.daysRemaining} days remaining)</>
                          )}
                        </p>

                        {activeClinic.trial_ends_at && activeClinic.subscription_status === 'trial' && (
                          <p className="text-xs text-emerald-700 mt-1 font-semibold">
                            Auto-Debit Mandate: Active • First charge on {formatDate(activeClinic.trial_ends_at)} via UPI/Card
                          </p>
                        )}

                        {activeClinic.subscription_activated_at && activeClinic.subscription_status !== 'cancelled' && activeClinic.subscription_status !== 'trial' && (
                          <p className="text-xs text-ink-muted mt-1">
                            Activated on: {formatDate(activeClinic.subscription_activated_at)}
                          </p>
                        )}

                        {activeClinic.subscription_cancelled_at && activeClinic.subscription_status === 'cancelled' && (
                          <p className="text-xs text-rose-600 mt-1 font-medium">
                            Cancelled on: {formatDate(activeClinic.subscription_cancelled_at)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button 
                          type="button"
                          onClick={() => {
                            setUpgradeTier((activeClinic.subscription_plan as any) || 'clinic');
                            setChangePlanModalOpen(true);
                          }}
                          className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <Zap size={14} />
                          <span>{activeClinic.subscription_status === 'cancelled' ? 'Reactivate / Upgrade Plan' : 'Change Plan'}</span>
                        </button>

                        {activeClinic.subscription_status !== 'cancelled' && !activeClinic.cancel_at_period_end && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelReason('');
                              setCancelCustomReason('');
                              setCancelFeedback('');
                              setCancelSuccess(false);
                              setCancelModalOpen(true);
                            }}
                            className="btn-ghost text-xs py-2 px-3 inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 transition-colors"
                          >
                            <XCircle size={14} className="text-rose-500" />
                            <span>Cancel Subscription</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Pending Cancellation Banner */}
                    {activeClinic.cancel_at_period_end && (
                      <div className="mt-4 p-4 rounded-xl border border-amber-300 bg-amber-50/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 animate-fade-in">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                              Subscription Cancellation Scheduled
                            </p>
                            <p className="text-xs text-amber-800 mt-0.5">
                              Your <strong>{matchedPlan.name} Plan</strong> remains <strong>100% active</strong> with all {limits.doctors_included} doctor seats and features until{' '}
                              <strong className="underline decoration-amber-500 font-bold">{periodInfo.formatted}</strong>. Auto-renewal is turned off.
                            </p>
                            {activeClinic.cancellation_reason && (
                              <p className="text-[11px] text-amber-700 mt-1 italic">
                                Reason: {activeClinic.cancellation_reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await revertSubscriptionCancellation(activeClinic.clinic_id);
                            if (ok) {
                              toast('Cancellation cancelled! Your subscription will continue renewing seamlessly.', 'success');
                            } else {
                              toast('Failed to restore subscription. Please try again.', 'error');
                            }
                          }}
                          className="shrink-0 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-950 font-bold text-xs py-2 px-3.5 rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>Keep / Resume Subscription</span>
                        </button>
                      </div>
                    )}

                    {/* Scheduled Plan Change Banner */}
                    {activeClinic.change_scheduled && activeClinic.scheduled_plan && (
                      <div className="mt-4 p-4 rounded-xl border border-teal-300 bg-teal-50/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-teal-950 animate-fade-in">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-teal-900">
                              {activeClinic.scheduled_change_type === 'downgrade' ? 'Plan Downgrade Scheduled' : 'Plan Upgrade Scheduled'}
                            </p>
                            <p className="text-xs text-teal-800 mt-0.5">
                              Switching to <strong className="text-teal-950 uppercase">{activeClinic.scheduled_plan} Plan ({activeClinic.scheduled_billing_cycle || 'monthly'})</strong> on{' '}
                              <strong className="underline decoration-teal-500 font-bold">{formatDate(activeClinic.scheduled_effective_date)}</strong>. Your current plan remains fully active until then.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await cancelScheduledPlanChange(activeClinic.clinic_id);
                            if (ok) {
                              toast('Scheduled plan change cancelled. You will remain on your current plan.', 'info');
                            } else {
                              toast('Failed to cancel scheduled change. Please try again.', 'error');
                            }
                          }}
                          className="shrink-0 bg-white hover:bg-teal-100/60 border border-teal-300 text-teal-950 font-bold text-xs py-2 px-3.5 rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5"
                        >
                          <X size={14} className="text-rose-600" />
                          <span>Cancel Scheduled Change</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Usage & Metering Grid */}
                  <div>
                    <h4 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
                      <Sparkles size={16} className="text-primary" />
                      Monthly Allowance & Live Consumption
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Doctor Seats */}
                      <div className="p-4 bg-surface-subtle border border-black/5 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-ink-subtle flex items-center gap-1.5">
                            <Stethoscope size={14} className="text-primary" />
                            Doctor Seats
                          </span>
                          <span className="text-xs font-bold text-ink">{doctorsCount} / {limits.doctors_included}</span>
                        </div>
                        <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${doctorsCount >= limits.doctors_included ? 'bg-amber-500' : 'bg-primary'}`} 
                            style={{ width: `${Math.min(100, (doctorsCount / limits.doctors_included) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-ink-muted mt-1.5">
                          {Math.max(0, limits.doctors_included - doctorsCount)} seat(s) remaining
                        </p>
                      </div>

                      {/* Staff Seats */}
                      <div className="p-4 bg-surface-subtle border border-black/5 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-ink-subtle flex items-center gap-1.5">
                            <Users size={14} className="text-primary" />
                            Staff Accounts
                          </span>
                          <span className="text-xs font-bold text-ink">{staffCount} / {limits.staff_seats_included}</span>
                        </div>
                        <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${staffCount >= limits.staff_seats_included ? 'bg-amber-500' : 'bg-primary'}`} 
                            style={{ width: `${Math.min(100, (staffCount / limits.staff_seats_included) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-ink-muted mt-1.5">
                          {Math.max(0, limits.staff_seats_included - staffCount)} seat(s) remaining
                        </p>
                      </div>

                      {/* AI Intakes */}
                      <div className="p-4 bg-surface-subtle border border-black/5 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-ink-subtle flex items-center gap-1.5">
                            <Sparkles size={14} className="text-primary" />
                            AI Triage Intakes
                          </span>
                          <span className="text-xs font-bold text-ink">{aiUsed} / {limits.ai_intakes_monthly}</span>
                        </div>
                        <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${aiUsed >= limits.ai_intakes_monthly ? 'bg-amber-500' : 'bg-primary'}`} 
                            style={{ width: `${Math.min(100, (aiUsed / limits.ai_intakes_monthly) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-ink-muted mt-1.5">
                          20% soft grace allowance active
                        </p>
                      </div>

                      {/* WhatsApp Messages */}
                      <div className="p-4 bg-surface-subtle border border-black/5 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-ink-subtle flex items-center gap-1.5">
                            <MessageSquare size={14} className="text-primary" />
                            WhatsApp Messages
                          </span>
                          <span className="text-xs font-bold text-ink">{whatsappUsed} / {limits.whatsapp_messages_monthly}</span>
                        </div>
                        <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${whatsappUsed >= limits.whatsapp_messages_monthly ? 'bg-amber-500' : 'bg-primary'}`} 
                            style={{ width: `${Math.min(100, (whatsappUsed / limits.whatsapp_messages_monthly) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-ink-muted mt-1.5">
                          {Math.max(0, limits.whatsapp_messages_monthly - whatsappUsed)} messages left this cycle
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          <div className="card">
            <SectionHeader title="Payment History" subtitle="Past payments for your subscription" />
            {subscriptions.length > 0 ? (
              <div className="space-y-2">
                {subscriptions.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-3 border border-black/5 rounded-lg bg-gray-50/50 hover:bg-white transition">
                    <div>
                      <p className="text-sm font-bold text-ink">{sub.plan_name}</p>
                      <p className="text-xs text-ink-muted">
                        Date: {formatDate(sub.created_at)} at {
                          (() => {
                            try {
                              const d = parseDateArg(sub.created_at);
                              return !isNaN(d.getTime())
                                ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
                                : '—';
                            } catch {
                              return '—';
                            }
                          })()
                        }
                      </p>
                      {sub.payment_id && <p className="text-xs text-ink-muted font-mono mt-0.5">Method: Online | Txn: {sub.payment_id}</p>}
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${sub.status === 'cancelled' ? 'bg-danger-bg text-danger' : 'bg-primary/10 text-primary'}`}>
                        {sub.status}
                      </span>
                      <button onClick={() => setViewingSubscription(sub)} className="text-xs text-primary font-semibold hover:underline">
                        View Invoice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No payment history" description="You haven't made any subscription payments yet." />
            )}
          </div>

          {/* Change / Upgrade Plan Modal */}
          {changePlanModalOpen && (() => {
            const directPaymentLinks: Record<string, Record<string, string>> = {
              solo: {
                annual: 'https://rzp.io/rzp/xlfXiVqg',
              },
              clinic: {
                monthly: 'https://rzp.io/rzp/OhKLJYzS',
                annual: 'https://rzp.io/rzp/9OYAB40N',
              },
              multispecialty: {
                monthly: 'https://rzp.io/rzp/XDAYYlHQ',
                annual: 'https://rzp.io/rzp/0PqwSVE',
              },
            };

            const handleExecutePlanAction = (targetTier: string, targetCycle: 'monthly' | 'annual') => {
              const TIER_ORDER: Record<string, number> = { solo: 1, clinic: 2, multispecialty: 3, hospital: 4 };
              const currentPlanCode = ((activeClinic?.subscription_plan as string) || 'solo').toLowerCase();
              const currentBillingCycle = (((activeClinic as any)?.subscription_billing_cycle as string) || 'monthly').toLowerCase();
              
              if (currentPlanCode === targetTier.toLowerCase() && currentBillingCycle === targetCycle.toLowerCase()) {
                return;
              }

              const currentRank = TIER_ORDER[currentPlanCode] || 1;
              const targetRank = TIER_ORDER[targetTier.toLowerCase()] || 1;
              const isDowngrade = targetRank < currentRank;

              const directUrl = directPaymentLinks[targetTier]?.[targetCycle];
              if (directUrl) {
                try {
                  localStorage.setItem('viitsa_pending_upgrade', JSON.stringify({
                    clinic_id: activeClinic.clinic_id,
                    user_id: user?.user_id,
                    tier: targetTier,
                    cycle: targetCycle,
                    timestamp: Date.now()
                  }));
                } catch {
                  // localStorage may not be available, ignore
                }
                window.open(directUrl, '_blank', 'noopener,noreferrer');
                setChangePlanModalOpen(false);
                return;
              }

              handleDirectPlanChange(targetTier, targetCycle, isDowngrade ? 'downgrade' : 'upgrade');
            };

            const TIER_ORDER: Record<string, number> = { solo: 1, clinic: 2, multispecialty: 3, hospital: 4 };
            const currentPlanCode = ((activeClinic?.subscription_plan as string) || 'solo').toLowerCase();
            const currentBillingCycle = (((activeClinic as any)?.subscription_billing_cycle as string) || 'monthly').toLowerCase();
            const currentRank = TIER_ORDER[currentPlanCode] || 1;
            const targetRank = TIER_ORDER[upgradeTier.toLowerCase()] || 1;
            const isDowngrade = targetRank < currentRank;
            const isSamePlan = currentPlanCode === upgradeTier.toLowerCase() && currentBillingCycle === upgradeCycle.toLowerCase();

            const planPrices: Record<string, { monthly: string; annual: string }> = {
              solo: { monthly: '₹2,999', annual: '₹29,990' },
              clinic: { monthly: '₹5,999', annual: '₹59,990' },
              multispecialty: { monthly: '₹11,999', annual: '₹1,19,990' },
            };
            const currentSelectedPriceStr = upgradeCycle === 'annual' ? planPrices[upgradeTier]?.annual : planPrices[upgradeTier]?.monthly;

            return (
              <Modal 
                open={changePlanModalOpen} 
                onClose={() => setChangePlanModalOpen(false)}
                title="Change Clinic Subscription Tier"
                size="2xl"
              >
                <div className="space-y-6 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-ink">Select New Plan</h3>
                      <p className="text-xs text-ink-subtle">
                        Upgrade or switch tiers. Changes and limits take effect immediately.
                      </p>
                    </div>
                    
                    {/* Billing Cycle Toggle */}
                    <div className="inline-flex items-center gap-1.5 p-1 bg-surface-subtle border border-black/5 rounded-xl self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setUpgradeCycle('monthly')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                          upgradeCycle === 'monthly' ? 'bg-white text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpgradeCycle('annual')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                          upgradeCycle === 'annual' ? 'bg-primary text-white shadow-sm' : 'text-ink-subtle hover:text-ink'
                        }`}
                      >
                        <span>Annual</span>
                        <span className={`text-[9px] font-bold px-1 rounded-full ${
                          upgradeCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                        }`}>
                          2 Mo Free
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Plans Selection Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        id: 'solo',
                        name: 'Solo',
                        desc: 'Single-doctor practices and consultants.',
                        priceMonthly: '₹2,999',
                        priceAnnual: '₹29,990',
                        features: ['1 Doctor included', '3 Staff seats', '1 Location', '300 AI Intakes/mo', '800 WhatsApp/mo', 'Unlimited document storage'],
                      },
                      {
                        id: 'clinic',
                        name: 'Clinic',
                        desc: 'Growing multi-doctor clinics with high patient volume.',
                        priceMonthly: '₹5,999',
                        priceAnnual: '₹59,990',
                        popular: true,
                        features: ['Up to 3 Doctors', '6 Staff seats', '1 Location', '1,000 AI Intakes/mo', '2,500 WhatsApp/mo', 'Unlimited document storage'],
                      },
                      {
                        id: 'multispecialty',
                        name: 'Multi-Specialty',
                        desc: 'Polyclinics and busy specialty centres.',
                        priceMonthly: '₹11,999',
                        priceAnnual: '₹1,19,990',
                        features: ['Up to 8 Doctors', '20 Staff seats', '1 Location', '2,000 AI Intakes/mo', '5,000 WhatsApp/mo', 'Unlimited document storage'],
                      }
                    ].map((tier) => {
                      const isSelected = upgradeTier === tier.id;
                      const isCurrent = currentPlanCode === tier.id.toLowerCase() && currentBillingCycle === upgradeCycle.toLowerCase();
                      const tierRank = TIER_ORDER[tier.id.toLowerCase()] || 1;
                      const tierIsDowngrade = tierRank < currentRank;
                      const tierIsUpgrade = tierRank > currentRank;
                      const tierPriceStr = upgradeCycle === 'annual' ? tier.priceAnnual : tier.priceMonthly;

                      return (
                        <div 
                          key={tier.id}
                          onClick={() => setUpgradeTier(tier.id as any)}
                          className={`bg-white border rounded-xl p-4 cursor-pointer transition-all relative flex flex-col justify-between ${
                            isCurrent
                              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10'
                              : isSelected 
                                ? (tierIsDowngrade ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md' : 'border-primary ring-2 ring-primary/20 shadow-md')
                                : 'border-black/10 hover:border-black/30'
                          }`}
                        >
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                            {isCurrent && (
                              <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                Active Plan
                              </span>
                            )}
                            {!isCurrent && tier.popular && (
                              <span className="text-[9px] font-bold bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full uppercase">
                                Popular
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-ink flex items-center gap-1.5">
                              <Crown size={15} className={tier.popular ? "text-accent" : (tierIsDowngrade ? "text-amber-500" : "text-primary")} />
                              {tier.name}
                            </h4>
                            <p className="text-[11px] text-ink-subtle mt-0.5 mb-3">{tier.desc}</p>
                            
                            <div className="mb-3 pb-3 border-b border-black/5">
                              <span className="text-xl font-bold text-ink">
                                {tierPriceStr}
                              </span>
                              <span className="text-[10px] text-ink-subtle">
                                /{upgradeCycle === 'annual' ? 'year' : 'month'}
                              </span>
                            </div>

                            <ul className="space-y-1.5 mb-4 text-[11px]">
                              {tier.features.map((f, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-ink">
                                  <CheckCircle2 size={12} className="text-primary shrink-0" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="pt-2">
                            {isCurrent ? (
                              <button
                                type="button"
                                disabled
                                className="w-full py-2.5 px-3 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 size={14} className="text-emerald-600" />
                                Current Active Plan
                              </button>
                            ) : tierIsDowngrade ? (
                              <button
                                type="button"
                                disabled={changingPlan}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUpgradeTier(tier.id as any);
                                  handleExecutePlanAction(tier.id, upgradeCycle);
                                }}
                                className="w-full py-2.5 px-3 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                              >
                                <ArrowDownRight size={14} />
                                {changingPlan && upgradeTier === tier.id ? 'Processing...' : `Downgrade to ${tier.name} (${tierPriceStr})`}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={changingPlan}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUpgradeTier(tier.id as any);
                                  handleExecutePlanAction(tier.id, upgradeCycle);
                                }}
                                className={`w-full py-2.5 px-3 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-primary text-white hover:bg-primary-dark ring-2 ring-primary/30'
                                    : 'btn-primary'
                                }`}
                              >
                                <ArrowUpRight size={14} />
                                {changingPlan && upgradeTier === tier.id
                                  ? 'Processing...'
                                  : tierIsUpgrade
                                    ? `Upgrade to ${tier.name} (${tierPriceStr})`
                                    : `Switch to ${tier.name} (${tierPriceStr})`}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Upgrade vs Downgrade contextual notices */}
                  {targetRank < currentRank && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 animate-fade-in">
                      <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong className="text-amber-950 font-bold">Downgrading from {currentPlanCode.toUpperCase()} to {upgradeTier.toUpperCase()}:</strong>
                        <p className="mt-0.5 text-amber-800">
                          Your plan entitlements will adjust to the {upgradeTier.toUpperCase()} allowances in real time. All existing patient records, prescriptions, and clinical data remain safely stored.
                        </p>
                      </div>
                    </div>
                  )}

                  {targetRank > currentRank && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-900 animate-fade-in">
                      <Sparkles size={16} className="shrink-0 text-emerald-600 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong className="text-emerald-950 font-bold">Upgrading from {currentPlanCode.toUpperCase()} to {upgradeTier.toUpperCase()}:</strong>
                        <p className="mt-0.5 text-emerald-800">
                          Instantly unlock more doctor seats, expanded staff accounts, and higher monthly AI triage capacity.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeClinic?.subscription_status === 'cancelled' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 animate-fade-in">
                      <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong className="text-amber-950 font-bold">Reactivating Subscription:</strong>
                        <p className="mt-0.5 text-amber-800">
                          The 30-day free trial has already been utilized for this clinic account. Subscribing to your chosen plan will activate it directly upon payment confirmation.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bottom Action Footer */}
                  <div className="bg-surface-subtle border border-black/5 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-ink-subtle">
                        Selected Plan: <strong className="text-ink uppercase">{upgradeTier}</strong> ({upgradeCycle})
                      </p>
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        Activates on <strong className="text-primary">{periodInfo.formatted}</strong> after your current cycle ends. Full current plan access remains active until then.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setChangePlanModalOpen(false)}
                        className="btn-ghost text-xs px-3 py-2 flex-1 sm:flex-none"
                      >
                        Close
                      </button>
                      
                      {isSamePlan ? (
                        <button
                          type="button"
                          disabled
                          className="btn-ghost text-xs py-2 px-4 flex-1 sm:flex-none bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 cursor-not-allowed opacity-80"
                        >
                          ✓ Current Active Plan
                        </button>
                      ) : isDowngrade ? (
                        <button
                          type="button"
                          disabled={changingPlan}
                          onClick={() => handleExecutePlanAction(upgradeTier, upgradeCycle)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs py-2.5 px-4 flex-1 sm:flex-none justify-center shadow-sm text-center font-bold rounded-xl inline-flex items-center gap-1.5 transition-all"
                        >
                          {changingPlan ? (
                            <>
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                              <span>Scheduling Downgrade...</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownRight size={15} />
                              <span>Schedule Downgrade to {upgradeTier.toUpperCase()} ({currentSelectedPriceStr})</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={changingPlan}
                          onClick={() => handleExecutePlanAction(upgradeTier, upgradeCycle)}
                          className="btn-primary text-xs py-2.5 px-4 flex-1 sm:flex-none justify-center shadow-sm text-center font-bold rounded-xl inline-flex items-center gap-1.5"
                        >
                          {changingPlan ? (
                            <>
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={15} />
                              <span>Upgrade to {upgradeTier.toUpperCase()} ({currentSelectedPriceStr})</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Modal>
            );
          })()}


          {/* Cancel Subscription Modal */}
          {cancelModalOpen && (
            <Modal
              open={cancelModalOpen}
              onClose={() => {
                if (!cancelling) setCancelModalOpen(false);
              }}
              title={cancelSuccess ? "Cancellation Scheduled" : "Cancel Clinic Subscription"}
              size="lg"
            >
              {cancelSuccess ? (
                <div className="py-6 px-2 text-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-sm">
                    <CheckCircle2 size={32} />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Subscription Cancellation Scheduled</h3>
                    <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                      Your current plan and doctor seats remain <strong>100% active until {scheduledCancelDate || periodInfo.formatted}</strong>.
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                      An official confirmation statement with PDF details has been sent to{' '}
                      <strong className="text-slate-800">{user?.email || activeClinic.email || 'your registered email'}</strong>.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left max-w-md mx-auto text-xs space-y-2 text-slate-600">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                      <ShieldCheck size={16} /> Full Access & Data Preservation Guarantee
                    </div>
                    <p>
                      Your clinic doctor accounts, patient records, appointments, and files remain completely safe and active until <strong>{scheduledCancelDate || periodInfo.formatted}</strong>.
                    </p>
                    <p>
                      Automatic renewal is turned off. You will not be charged again. You can also resume your subscription at any time from this dashboard before the end date.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setCancelModalOpen(false)}
                      className="btn-primary w-full max-w-xs py-2.5 text-sm mx-auto"
                    >
                      Done & Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 pt-1">
                  {/* Warning alert */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                        Active Period Lifecycle Guarantee
                      </h4>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        Cancelling your <strong>{((activeClinic.subscription_plan as string) || 'Clinic').toUpperCase()} Plan</strong> turns off auto-renewal. Your subscription and all doctor seats <strong>remain 100% active and unrestricted until {periodInfo.formatted}</strong>. No further recurring charges will occur.
                      </p>
                    </div>
                  </div>

                  {/* Survey question */}
                  <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2">
                      Please let us know why you are cancelling <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-xs text-ink-subtle mb-3">
                      Your feedback helps our product and clinical support team improve the platform.
                    </p>

                    <div className="space-y-2">
                      {CANCELLATION_REASONS.map((reason) => {
                        const Icon = reason.icon;
                        const isSelected = cancelReason === reason.id;
                        return (
                          <label
                            key={reason.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-rose-500 bg-rose-50/50 ring-1 ring-rose-500/30'
                                : 'border-black/10 hover:border-black/20 bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="cancelReason"
                              value={reason.id}
                              checked={isSelected}
                              onChange={() => setCancelReason(reason.id)}
                              className="mt-1 text-rose-600 focus:ring-rose-500 h-4 w-4"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 font-semibold text-xs text-ink">
                                <Icon size={14} className={isSelected ? 'text-rose-600' : 'text-ink-subtle'} />
                                <span>{reason.title}</span>
                              </div>
                              <p className="text-[11px] text-ink-muted mt-0.5">{reason.desc}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Other Reason Text Area */}
                  {cancelReason === 'other' && (
                    <div className="animate-fade-in">
                      <label className="block text-xs font-bold text-ink mb-1.5">
                        Please specify your reason <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        value={cancelCustomReason}
                        onChange={(e) => setCancelCustomReason(e.target.value)}
                        placeholder="Tell us what prompted your decision to cancel..."
                        rows={3}
                        className="w-full text-xs p-3 rounded-xl border border-black/10 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all resize-none"
                      />
                    </div>
                  )}

                  {/* Optional Additional Feedback */}
                  <div>
                    <label className="block text-xs font-semibold text-ink-subtle mb-1">
                      Anything else we could have done better? (Optional)
                    </label>
                    <textarea
                      value={cancelFeedback}
                      onChange={(e) => setCancelFeedback(e.target.value)}
                      placeholder="Share any additional thoughts, suggested features, or feedback..."
                      rows={2}
                      className="w-full text-xs p-3 rounded-xl border border-black/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                    />
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="border-t border-black/5 pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={() => setCancelModalOpen(false)}
                      className="btn-ghost text-xs py-2 px-4 w-full sm:w-auto"
                    >
                      Keep My Subscription
                    </button>

                    <button
                      type="button"
                      disabled={
                        cancelling || 
                        !cancelReason || 
                        (cancelReason === 'other' && !cancelCustomReason.trim())
                      }
                      onClick={handleCancelSubscription}
                      className="btn-danger text-xs py-2.5 px-4 w-full sm:w-auto justify-center inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelling ? (
                        <>
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span>Scheduling Cancellation & Sending Email...</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={15} />
                          <span>Schedule Cancellation (Active Until {periodInfo.formatted})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </Modal>
          )}
        </div>
      )}

      {/* Add New Doctor / Staff Account Modal */}
      <AddUserModal 
        open={addUserOpen} 
        initialRole={addUserRole} 
        onClose={() => setAddUserOpen(false)} 
        onSaved={addUser} 
      />

      {/* Upload Document / Certificate Modal (Supports Multiple Files) */}
      {uploadDocUser && clinic && (
        <UploadStaffDocsModal 
          open={!!uploadDocUser} 
          user={uploadDocUser} 
          clinicId={clinic.clinic_id} 
          onClose={() => setUploadDocUser(null)} 
          onSuccess={(newDocs) => {
            setUsers(prev => prev.map(u => {
              if (u.user_id !== uploadDocUser.user_id) return u;
              return {
                ...u,
                certificates: [...(u.certificates || []), ...newDocs]
              };
            }));
            if (detailsUser && detailsUser.user_id === uploadDocUser.user_id) {
              setDetailsUser(prev => prev ? {
                ...prev,
                certificates: [...(prev.certificates || []), ...newDocs]
              } : null);
            }
            setUploadDocUser(null);
          }} 
        />
      )}

      {/* Upload Clinic Verification Documents Modal (Supports Multiple Files) */}
      {uploadClinicDocsOpen && (liveClinic || clinic) && (
        <UploadClinicDocsModal
          open={uploadClinicDocsOpen}
          clinic={liveClinic || clinic}
          onClose={() => setUploadClinicDocsOpen(false)}
        />
      )}

      {/* Edit Doctor / Staff Profile Modal */}
      {editUser && (
        <EditUserModal 
          open={!!editUser} 
          user={editUser} 
          onClose={() => setEditUser(null)} 
          onSave={(data) => handleSaveEditedUser(editUser.user_id, data)} 
        />
      )}

      {/* View Full Dossier & Credentials Modal */}
      {detailsUser && (
        <UserDetailsModal 
          open={!!detailsUser} 
          user={detailsUser} 
          clinic={clinic}
          onClose={() => setDetailsUser(null)} 
          onEdit={() => {
            const u = detailsUser;
            setDetailsUser(null);
            setEditUser(u);
          }}
          onUploadDoc={() => {
            const u = detailsUser;
            setUploadDocUser(u);
          }}
          onDeleteDoc={(docItem) => handleDeleteDocument(detailsUser, docItem)}
        />
      )}
    </div>
  );
}

function drawCanvasRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function PatientAccessTab({ clinicId, clinicName, clinicPhone }: { clinicId: string; clinicName: string; clinicPhone: string }) {
  const { toast } = useToast();
  const patientLink = `https://viitsa.com/patient?clinic=${clinicId}`;
  // High-res 600x600 QR image source
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=png&data=${encodeURIComponent(patientLink)}`;
  const imgRef = useRef<HTMLImageElement>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadingA4, setDownloadingA4] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copyingImg, setCopyingImg] = useState(false);
  const [showA4Modal, setShowA4Modal] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(patientLink).then(() => toast('Patient booking link copied!', 'success'));
  };

  const getCleanFilename = (suffix = 'qr') => {
    const clean = (clinicName || 'clinic').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${clean}_patient_${suffix}.png`;
  };

  // Helper to retrieve raw QR PNG as Blob
  const getRawQrBlob = async (): Promise<Blob> => {
    try {
      const res = await fetch(qrUrl, { mode: 'cors' });
      if (res.ok) {
        const b = await res.blob();
        if (b && b.size > 0) return b;
      }
    } catch (e) {
      console.warn('Direct fetch failed, falling back to canvas draw:', e);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 600;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas not supported');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas blob generation failed'));
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load QR image'));
      img.src = qrUrl;
    });
  };

  // Generates high-res branded QR Card: TOP = Clinic Name, CENTER = Big QR, BOTTOM = BOOK APPOINTMENT
  const getBrandedQrBlob = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1440;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas not supported');

          // 1. Background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 1080, 1440);

          // 2. Top Accent Bar (Brand Emerald #0F6E56)
          ctx.fillStyle = '#0F6E56';
          ctx.fillRect(0, 0, 1080, 20);

          // 3. Subtle Outer Border
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 4;
          ctx.strokeRect(28, 28, 1080 - 56, 1440 - 56);

          // 4. Top Header Badge
          ctx.fillStyle = '#E1F5EE';
          drawCanvasRoundRect(ctx, 380, 70, 320, 42, 21);
          ctx.fill();
          ctx.fillStyle = '#0F6E56';
          ctx.font = 'bold 18px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('VERIFIED CLINIC APPOINTMENTS', 540, 97);

          // 5. TOP: Clinic Name (Big, Bold, Prominent)
          ctx.fillStyle = '#0F1B2C';
          const nameToDisplay = (clinicName || 'Clinic Name').trim();
          let fontSize = 48;
          if (nameToDisplay.length > 32) fontSize = 34;
          else if (nameToDisplay.length > 22) fontSize = 40;
          ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
          ctx.fillText(nameToDisplay, 540, 175);

          // Subtitle below clinic name
          ctx.fillStyle = '#5A6B7B';
          ctx.font = '500 22px Inter, system-ui, sans-serif';
          ctx.fillText('Official Patient Access & Online Booking', 540, 220);

          // Divider
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(140, 255);
          ctx.lineTo(940, 255);
          ctx.stroke();

          // 6. CENTER: The Big QR Code in framed container
          ctx.fillStyle = '#F8FAFC';
          drawCanvasRoundRect(ctx, 190, 295, 700, 700, 36);
          ctx.fill();
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Camera target corner accents on QR container
          ctx.strokeStyle = '#0F6E56';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          // Top-left
          ctx.beginPath(); ctx.moveTo(215, 345); ctx.lineTo(215, 320); ctx.lineTo(240, 320); ctx.stroke();
          // Top-right
          ctx.beginPath(); ctx.moveTo(840, 320); ctx.lineTo(865, 320); ctx.lineTo(865, 345); ctx.stroke();
          // Bottom-left
          ctx.beginPath(); ctx.moveTo(215, 945); ctx.lineTo(215, 970); ctx.lineTo(240, 970); ctx.stroke();
          // Bottom-right
          ctx.beginPath(); ctx.moveTo(840, 970); ctx.lineTo(865, 970); ctx.lineTo(865, 945); ctx.stroke();

          // Draw QR Code image
          ctx.drawImage(img, 240, 345, 600, 600);

          // 7. BOTTOM: BOOK APPOINTMENT (Big, Bold, Eye-catching)
          ctx.fillStyle = '#0F6E56';
          drawCanvasRoundRect(ctx, 140, 1040, 800, 105, 24);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 44px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('BOOK APPOINTMENT', 540, 1107);

          // Scan guide
          ctx.fillStyle = '#1E293B';
          ctx.font = '600 24px Inter, system-ui, sans-serif';
          ctx.fillText('Scan with any Smartphone Camera or QR App', 540, 1195);

          ctx.fillStyle = '#64748B';
          ctx.font = '500 20px Inter, system-ui, sans-serif';
          ctx.fillText('Google Lens · Phone Camera · WhatsApp · Paytm · PhonePe', 540, 1245);

          // Footer
          ctx.fillStyle = '#94A3B8';
          ctx.font = '500 16px Inter, system-ui, sans-serif';
          ctx.fillText('Instant Doctor Confirmation · Zero Queue · Powered by VIITSA Healthcare', 540, 1340);

          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create branded QR blob'));
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load QR image for branded generation'));
      img.src = qrUrl;
    });
  };

  // Generates ultra high-res A4 Poster image (1240 x 1754 px at standard A4 proportion)
  const getA4PosterBlob = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1240;
          canvas.height = 1754;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas not supported');

          // White background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 1240, 1754);

          // Top accent strip
          ctx.fillStyle = '#0F6E56';
          ctx.fillRect(0, 0, 1240, 24);

          // Outer frame
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 6;
          ctx.strokeRect(36, 36, 1240 - 72, 1754 - 72);

          // Header Badge
          ctx.fillStyle = '#E1F5EE';
          drawCanvasRoundRect(ctx, 420, 80, 400, 48, 24);
          ctx.fill();
          ctx.fillStyle = '#0F6E56';
          ctx.font = 'bold 20px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('OFFICIAL APPOINTMENT PORTAL', 620, 111);

          // TOP: Huge Clinic Name
          ctx.fillStyle = '#0F1B2C';
          const nameToDisplay = (clinicName || 'Clinic Name').trim();
          let fontSize = 56;
          if (nameToDisplay.length > 30) fontSize = 42;
          else if (nameToDisplay.length > 20) fontSize = 48;
          ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
          ctx.fillText(nameToDisplay, 620, 195);

          // Subtitle & Contact
          ctx.fillStyle = '#475569';
          ctx.font = '600 24px Inter, system-ui, sans-serif';
          ctx.fillText(clinicPhone ? `Direct Helpline: ${clinicPhone} · Online Booking Desk` : 'Online Doctor Consultations & Appointments', 620, 245);

          // Divider
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(120, 280);
          ctx.lineTo(1120, 280);
          ctx.stroke();

          // Banner text: SCAN TO BOOK
          ctx.fillStyle = '#0F6E56';
          ctx.font = 'bold 30px Inter, system-ui, sans-serif';
          ctx.fillText('SCAN WITH YOUR PHONE CAMERA', 620, 335);

          // CENTER: Huge Fitted QR Card
          ctx.fillStyle = '#F8FAFC';
          drawCanvasRoundRect(ctx, 220, 370, 800, 800, 40);
          ctx.fill();
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 4;
          ctx.stroke();

          // Camera brackets
          ctx.strokeStyle = '#0F6E56';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(250, 430); ctx.lineTo(250, 400); ctx.lineTo(280, 400); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(960, 400); ctx.lineTo(990, 400); ctx.lineTo(990, 430); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(250, 1110); ctx.lineTo(250, 1140); ctx.lineTo(280, 1140); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(960, 1140); ctx.lineTo(990, 1140); ctx.lineTo(990, 1110); ctx.stroke();

          // Big fitted QR Code
          ctx.drawImage(img, 270, 420, 700, 700);

          // BOTTOM: Huge BOOK APPOINTMENT Button
          ctx.fillStyle = '#0F6E56';
          drawCanvasRoundRect(ctx, 160, 1220, 920, 115, 28);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 50px Inter, system-ui, sans-serif';
          ctx.fillText('BOOK APPOINTMENT', 620, 1297);

          // 3-Step Instruction Row
          const stepY = 1390;
          ctx.fillStyle = '#0F1B2C';
          ctx.font = 'bold 22px Inter, system-ui, sans-serif';
          ctx.fillText('1. Open Camera / Google Lens', 300, stepY);
          ctx.fillText('2. Point at QR Code', 620, stepY);
          ctx.fillText('3. Book Slot in 30 Secs', 940, stepY);

          // Bottom features
          ctx.fillStyle = '#64748B';
          ctx.font = '500 20px Inter, system-ui, sans-serif';
          ctx.fillText('✓ Instant Token Numbers    ✓ Live Queue Tracking    ✓ Verified Doctors', 620, 1490);

          // Footer
          ctx.fillStyle = '#94A3B8';
          ctx.font = '500 16px Inter, system-ui, sans-serif';
          ctx.fillText('VIITSA Healthcare Digital Clinic Network · Reception Display Standee', 620, 1620);

          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create A4 poster blob'));
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load QR image for A4 poster'));
      img.src = qrUrl;
    });
  };

  // Live direct download of branded QR (Top Clinic Name + Bottom BOOK APPOINTMENT)
  const downloadQR = async () => {
    try {
      setDownloading(true);
      const blob = await getBrandedQrBlob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = getCleanFilename('branded_qr');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
      toast('Branded QR image downloaded successfully!', 'success');
    } catch (err) {
      console.error('Download error:', err);
      window.open(qrUrl, '_blank');
      toast('Opened direct QR image.', 'info');
    } finally {
      setDownloading(false);
    }
  };

  // Direct download of Plain QR Code
  const downloadPlainQR = async () => {
    try {
      setDownloading(true);
      const blob = await getRawQrBlob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = getCleanFilename('raw_code');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
      toast('Plain QR code downloaded!', 'success');
    } catch (err) {
      window.open(qrUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  // Direct download of A4 Standee Poster
  const downloadA4Poster = async () => {
    try {
      setDownloadingA4(true);
      const blob = await getA4PosterBlob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = getCleanFilename('A4_poster');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
      toast('A4 Standee poster image downloaded successfully!', 'success');
    } catch (err) {
      console.error('A4 poster download error:', err);
      toast('Could not generate A4 poster image. You can still print directly.', 'error');
    } finally {
      setDownloadingA4(false);
    }
  };

  // Live direct image share via Web Share API with image file
  const shareQRImage = async () => {
    try {
      setSharing(true);
      const blob = await getBrandedQrBlob();
      const filename = getCleanFilename('branded_qr');
      const file = new File([blob], filename, { type: 'image/png' });
      const shareData = {
        title: `${clinicName} - Appointment Booking QR`,
        text: `Book your appointment at ${clinicName} using this link or scan the attached QR code:\n${patientLink}\n\nPowered by VIITSA`,
        files: [file],
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast('QR image shared successfully!', 'success');
        return;
      }

      // If Web Share with files is unavailable, copy image directly to clipboard
      if (navigator.clipboard && 'ClipboardItem' in window) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          toast('Branded QR image copied to clipboard! Paste it directly into WhatsApp or email.', 'success');
          return;
        } catch {
          // fall through
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: `${clinicName} - Appointment Booking`,
          text: `Book your appointment at ${clinicName}: ${patientLink}`,
          url: patientLink,
        });
        toast('Booking link shared!', 'success');
        return;
      }

      shareWA();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Share error:', err);
        shareWA();
      }
    } finally {
      setSharing(false);
    }
  };

  // Direct image copy to clipboard
  const copyQRImage = async () => {
    try {
      setCopyingImg(true);
      const blob = await getBrandedQrBlob();
      if (navigator.clipboard && 'ClipboardItem' in window) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        toast('Branded QR image copied to clipboard! Paste (Ctrl+V / Cmd+V) directly into chat.', 'success');
      } else {
        await navigator.clipboard.writeText(patientLink);
        toast('Image clipboard not supported in this browser. Link copied.', 'info');
      }
    } catch (err) {
      console.error('Clipboard image error:', err);
      toast('Could not copy image. Use Download or Share instead.', 'error');
    } finally {
      setCopyingImg(false);
    }
  };

  const shareWA = () => {
    const msg = `Book your appointment at ${clinicName} using this link: ${patientLink}\n\nPowered by VIITSA`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const triggerA4Print = () => {
    window.print();
  };

  return (
    <>
      <div className="card max-w-2xl space-y-5">
        <SectionHeader title="Patient access" subtitle="Give patients a direct link to book appointments at your clinic" />

        <div className="flex items-start gap-4 flex-col sm:flex-row">
          {/* QR Preview Card with Top Clinic Name and Bottom BOOK APPOINTMENT banner */}
          <div className="rounded-xl border border-primary-200/80 p-3 bg-white shadow-card shrink-0 flex flex-col items-center gap-1.5 w-56 text-center">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider line-clamp-1 max-w-[200px]" title={clinicName}>
              {clinicName || 'Clinic Name'}
            </span>
            <div className="relative p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <img 
                ref={imgRef} 
                crossOrigin="anonymous" 
                src={qrUrl} 
                alt="Patient QR code" 
                className="w-44 h-44 object-contain" 
              />
            </div>
            <div className="w-full bg-primary text-white text-[11px] font-bold py-1 px-2 rounded-md tracking-wide uppercase shadow-2xs">
              BOOK APPOINTMENT
            </div>
            <a
              href={qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-ink-muted hover:text-primary transition flex items-center gap-1 pt-0.5"
            >
              <ExternalLink size={11} /> Open raw QR
            </a>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <label className="label">Patient booking link</label>
              <div className="flex items-center gap-2">
                <input readOnly className="input text-xs font-mono flex-1" value={patientLink} />
                <button onClick={copyLink} className="btn-secondary shrink-0" title="Copy URL">
                  <Link2 size={14} /> Copy
                </button>
              </div>
              <p className="text-xs text-ink-muted mt-1">Share this link or QR code — patients open it to book appointments.</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button 
                onClick={downloadQR} 
                disabled={downloading}
                className="btn-primary"
                title="Download direct QR card with Clinic Name on Top and BOOK APPOINTMENT on Bottom"
              >
                <Download size={14} /> {downloading ? 'Downloading…' : 'Download QR (PNG)'}
              </button>

              <button 
                onClick={() => setShowA4Modal(true)} 
                className="btn-secondary text-primary font-semibold border-primary-200 hover:bg-primary-50"
                title="Open big and fitted A4 Standee / Poster ready to print or save"
              >
                <Printer size={14} /> Print A4 Poster
              </button>

              <button 
                onClick={shareQRImage} 
                disabled={sharing}
                className="btn-secondary"
                title="Share QR image directly with Clinic Name & BOOK APPOINTMENT"
              >
                <Share2 size={14} /> {sharing ? 'Sharing…' : 'Share QR Image'}
              </button>

              <button 
                onClick={copyQRImage} 
                disabled={copyingImg}
                className="btn-outline"
                title="Copy direct PNG image to clipboard to paste into WhatsApp Web or emails"
              >
                <Copy size={14} /> {copyingImg ? 'Copying…' : 'Copy Image'}
              </button>

              <button 
                onClick={shareWA} 
                className="btn-outline text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                title="Share booking link and message on WhatsApp"
              >
                <Share2 size={14} /> Share on WhatsApp
              </button>

              <button 
                onClick={downloadPlainQR} 
                disabled={downloading}
                className="btn-ghost text-xs text-ink-muted hover:text-ink"
                title="Download raw plain QR code image without branding"
              >
                <QrCode size={13} /> Raw QR
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-primary-50/60 p-4 text-sm space-y-1.5">
          <p className="font-semibold text-primary">How it works</p>
          <ul className="text-xs text-ink-muted space-y-1">
            <li>• Patient scans QR code or opens the link on their phone</li>
            <li>• They enter their mobile number and verify with OTP (OTP via SMS)</li>
            <li>• They see your clinic's doctors and available slots</li>
            <li>• Booking appears instantly on your clinic dashboard</li>
          </ul>
        </div>
      </div>

      {/* A4 STAND-UP POSTER & PRINT MODAL */}
      {showA4Modal && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex justify-center p-2 sm:p-4 md:p-6 animate-fade-in no-print-backdrop">
          <div className="relative max-w-3xl w-full my-auto space-y-4">
            
            {/* Action Bar (Hidden during printing) */}
            <div className="no-print flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl shadow-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <Printer className="text-primary" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-ink">A4 Clinic Reception Standee & Poster</h3>
                  <p className="text-[11px] text-ink-muted">Fitted to full A4 paper (210mm × 297mm) ready for standees or walls</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={triggerA4Print} 
                  className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={14} /> Print Now (A4)
                </button>
                <button 
                  onClick={downloadA4Poster} 
                  disabled={downloadingA4}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Download size={14} /> {downloadingA4 ? 'Preparing…' : 'Download A4 PNG'}
                </button>
                <button 
                  onClick={() => setShowA4Modal(false)} 
                  className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-slate-100 transition"
                  title="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* LIVE A4 STANDEE SHEET (BIG & FITTED) */}
            <div className="overflow-x-auto pb-4 flex justify-center">
              <div 
                id="qr-standee-print-area"
                className="w-[210mm] min-h-[297mm] max-h-[297mm] bg-white p-8 md:p-12 shadow-2xl rounded-2xl border border-slate-200 flex flex-col justify-between items-center text-center relative select-none"
              >
                {/* Top Clinic Branding Header */}
                <div className="w-full space-y-3">
                  <div className="h-2 w-full bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 rounded-full mb-4" />
                  
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
                    <ShieldCheck size={14} className="text-emerald-700" />
                    Verified Clinic Online Access
                  </div>

                  {/* CLINIC NAME (HUGE AND BOLD AT TOP) */}
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase px-4 leading-tight">
                    {clinicName || 'Clinic Name'}
                  </h1>

                  <p className="text-sm sm:text-base font-semibold text-slate-600 tracking-wide">
                    {clinicPhone ? `Helpline: ${clinicPhone} · Online Appointment Booking` : 'Instant Doctor Appointments & Digital Token Booking'}
                  </p>

                  <div className="w-full border-b-2 border-dashed border-slate-200 pt-2" />
                </div>

                {/* Main QR Code Section (HUGE & FITTED IN CENTER) */}
                <div className="my-auto py-4 flex flex-col items-center space-y-4 w-full">
                  <p className="text-base sm:text-lg font-extrabold text-teal-800 tracking-wider uppercase">
                    SCAN WITH YOUR PHONE CAMERA
                  </p>

                  {/* Framed QR with camera targeting corner brackets */}
                  <div className="relative p-6 sm:p-8 bg-slate-50 border-2 border-slate-200 rounded-3xl shadow-inner">
                    {/* Corner Target Accents */}
                    <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />

                    <img 
                      crossOrigin="anonymous" 
                      src={qrUrl} 
                      alt="A4 Standee QR Code" 
                      className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 object-contain rounded-xl"
                    />
                  </div>

                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    No special app needed · Works with Camera, Google Lens, Paytm, WhatsApp
                  </p>
                </div>

                {/* BOTTOM: HUGE BOOK APPOINTMENT BANNER & INSTRUCTIONS */}
                <div className="w-full space-y-4 pt-2">
                  <div className="w-full bg-[#0F6E56] text-white text-center font-black text-2xl sm:text-3xl md:text-4xl py-4 px-8 rounded-2xl tracking-wider uppercase shadow-lg">
                    BOOK APPOINTMENT
                  </div>

                  {/* 3 Step Guide */}
                  <div className="grid grid-cols-3 gap-3 text-center pt-1">
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                      <div className="text-lg mb-0.5">📱</div>
                      <p className="text-xs font-bold text-slate-800">1. Open Camera</p>
                      <p className="text-[10px] text-slate-500">Camera or Google Lens</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                      <div className="text-lg mb-0.5">🎯</div>
                      <p className="text-xs font-bold text-slate-800">2. Point at QR</p>
                      <p className="text-[10px] text-slate-500">Tap the link banner</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                      <div className="text-lg mb-0.5">⏱️</div>
                      <p className="text-xs font-bold text-slate-800">3. Book in 30 Secs</p>
                      <p className="text-[10px] text-slate-500">Pick doctor & time slot</p>
                    </div>
                  </div>


                  {/* Footer Tag */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                    <span>✓ Zero Waiting in Lines</span>
                    <span className="font-semibold text-slate-500">VIITSA Smart Clinic System</span>
                    <span>✓ Instant SMS Confirmation</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

interface UserManagementProps {
  tab: 'doctors' | 'staff';
  users: User[];
  clinic: any;
  onAdd: () => void;
  onReset: (u: User) => void;
  onToggle: (u: User) => void;
  onEdit: (u: User) => void;
  onUploadDoc: (u: User) => void;
  onDeleteDoc: (u: User, docItem: { name: string; url: string }) => void;
  onViewDetails: (u: User) => void;
}

function UserManagement({ 
  tab, 
  users, 
  clinic,
  onAdd, 
  onReset, 
  onToggle, 
  onEdit, 
  onUploadDoc, 
  onDeleteDoc, 
  onViewDetails 
}: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Comprehensive role matching
  const isDoctor = (u: User) => {
    const r = (u.role || '').toLowerCase();
    const ut = ((u as any).user_type || '').toLowerCase();
    return r === 'clinic_doctor' || r === 'doctor' || ut === 'clinic_doctor' || (Boolean(u.specialisation) && r !== 'patient');
  };

  const isStaff = (u: User) => {
    const r = (u.role || '').toLowerCase();
    const ut = ((u as any).user_type || '').toLowerCase();
    return r === 'clinic_staff' || r === 'staff' || r === 'clinic_admin' || r === 'admin' || r === 'receptionist' || ut === 'clinic_staff' || ut === 'clinic_admin';
  };

  const filtered = useMemo(() => {
    const base = users.filter(tab === 'doctors' ? isDoctor : isStaff);
    if (!searchTerm.trim()) return base;
    const term = searchTerm.toLowerCase().trim();
    return base.filter(u => 
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.phone && u.phone.includes(term)) ||
      (u.specialisation && u.specialisation.toLowerCase().includes(term)) ||
      (u.display_id && u.display_id.toLowerCase().includes(term)) ||
      (u.id_number && u.id_number.toLowerCase().includes(term))
    );
  }, [users, tab, searchTerm]);

  const activeCount = filtered.filter(u => u.active).length;
  const docsCount = filtered.reduce((acc, u) => acc + (u.certificates?.length || 0) + (u.onboarding_documents?.length || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Banner & Stats */}
      <div className="card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
              {tab === 'doctors' ? <Stethoscope className="text-primary" size={20} /> : <Users className="text-primary" size={20} />}
              {tab === 'doctors' ? 'Doctor & Medical Specialist Management' : 'Clinic Staff & Administrative Accounts'}
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {tab === 'doctors' 
                ? 'Manage practicing doctors, assign specialities, set consultation fees, and inspect medical credentials' 
                : 'Manage receptionists, nurse staff, clinic managers, and administrative roles'}
            </p>
          </div>
          <button onClick={onAdd} className="btn-primary shrink-0 self-start sm:self-auto flex items-center gap-1.5 shadow-sm">
            <Plus size={15} /> Add {tab === 'doctors' ? 'Doctor' : 'Staff Member'}
          </button>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="p-2.5 rounded-lg bg-gray-50 border border-black/5">
            <span className="text-[10px] font-bold text-ink-subtle uppercase block tracking-wider">Total {tab === 'doctors' ? 'Doctors' : 'Staff'}</span>
            <span className="text-lg font-bold text-ink">{filtered.length}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block tracking-wider">Active Status</span>
            <span className="text-lg font-bold text-emerald-700">{activeCount} Online</span>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100">
            <span className="text-[10px] font-bold text-blue-700 uppercase block tracking-wider">Uploaded Documents</span>
            <span className="text-lg font-bold text-blue-700">{docsCount} Files</span>
          </div>
          <div className="p-2.5 rounded-lg bg-teal-50/70 border border-teal-100">
            <span className="text-[10px] font-bold text-teal-700 uppercase block tracking-wider">Clinic Cloud Sync</span>
            <span className="text-xs font-bold text-teal-800 flex items-center gap-1 mt-1">
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" /> Live Realtime
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative pt-1">
          <Search size={15} className="absolute left-3 top-4 text-ink-subtle" />
          <input 
            type="text" 
            placeholder={`Search ${tab} by name, email, phone, specialisation, or ID...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 text-xs"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3.5 text-xs text-ink-subtle hover:text-ink font-semibold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* User Cards List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12 space-y-3">
          <div className="h-12 w-12 rounded-full bg-primary-50 text-primary flex items-center justify-center mx-auto">
            {tab === 'doctors' ? <Stethoscope size={24} /> : <Users size={24} />}
          </div>
          <h3 className="text-base font-bold text-ink">No {tab} found</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {searchTerm 
              ? `No ${tab} matched your search "${searchTerm}".` 
              : `You haven't added any ${tab} accounts yet. Click the button below to add your first ${tab === 'doctors' ? 'doctor' : 'staff member'}.`}
          </p>
          <button onClick={onAdd} className="btn-primary mx-auto inline-flex items-center gap-1.5">
            <Plus size={14} /> Add {tab === 'doctors' ? 'Doctor' : 'Staff Member'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const allDocs = [
              ...(u.certificates || []).map(c => ({ ...c, source: 'Certificate' })),
              ...(u.onboarding_documents || []).map(c => ({ ...c, source: 'Onboarding' })),
              ...(u.documents || []).map(c => ({ ...c, source: 'Credential' }))
            ];

            const displayId = u.display_id || u.id_number || (u.user_id ? `${tab === 'doctors' ? 'DOC' : 'STF'}-${u.user_id.slice(0, 6).toUpperCase()}` : 'ID');
            const isRoleAdmin = u.role === 'clinic_admin' || u.role === 'admin';
            const roleName = isRoleAdmin 
              ? 'Clinic Admin' 
              : u.role === 'clinic_doctor' || u.role === 'doctor' 
                ? 'Doctor' 
                : 'Staff / Reception';

            return (
              <div key={u.user_id} className="card p-4 sm:p-5 hover:border-primary/40 transition-all space-y-4 shadow-sm">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-black/5">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar name={u.name || 'User'} color={u.avatar_color} size={46} />
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                        u.active ? 'bg-emerald-500' : 'bg-slate-400'
                      }`} title={u.active ? 'Active' : 'Inactive'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-ink text-base">{u.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isRoleAdmin 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : u.role === 'clinic_doctor' || u.role === 'doctor'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {roleName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                          {displayId}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5 font-medium flex items-center gap-2 flex-wrap">
                        {u.specialisation && <span className="text-primary font-semibold">{u.specialisation}</span>}
                        {u.designation && <span>· {u.designation}</span>}
                        {u.experience_years ? <span>· {u.experience_years} yrs exp</span> : null}
                      </p>
                    </div>
                  </div>

                  {/* Top Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                    <button 
                      onClick={() => onViewDetails(u)} 
                      className="px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary hover:bg-primary hover:text-white text-xs font-semibold flex items-center gap-1 transition"
                      title="View full profile & credentials"
                    >
                      <Eye size={13} /> View Profile
                    </button>
                    <button 
                      onClick={() => onEdit(u)} 
                      className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-slate-700 hover:bg-gray-200 text-xs font-semibold flex items-center gap-1 transition"
                      title="Edit doctor/staff profile data"
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button 
                      onClick={() => onReset(u)} 
                      className="p-1.5 rounded-lg bg-gray-100 text-slate-600 hover:bg-gray-200 text-xs transition" 
                      title="Send Password Reset Email"
                    >
                      <RefreshCw size={13} />
                    </button>
                    <button 
                      onClick={() => onToggle(u)} 
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                        u.active 
                          ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200' 
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {u.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>

                {/* Information & Credentials Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-gray-50/60 p-3 rounded-xl border border-black/5">
                  <div>
                    <span className="text-ink-subtle uppercase text-[10px] font-bold block mb-0.5 flex items-center gap-1">
                      <PhoneCall size={11} className="text-primary" /> Contact Phone
                    </span>
                    {u.phone ? (
                      <div className="flex items-center gap-2">
                        <a href={`tel:${u.phone}`} className="font-semibold text-primary hover:underline">{u.phone}</a>
                        <a 
                          href={`https://wa.me/${u.phone.replace(/\D/g,'')}?text=Hello%20${encodeURIComponent(u.name)}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded"
                          title="Chat on WhatsApp"
                        >
                          WA
                        </a>
                      </div>
                    ) : <span className="text-ink-subtle italic">No phone recorded</span>}
                  </div>

                  <div>
                    <span className="text-ink-subtle uppercase text-[10px] font-bold block mb-0.5 flex items-center gap-1">
                      <Mail size={11} className="text-primary" /> Email Address
                    </span>
                    {u.email ? (
                      <a href={`mailto:${u.email}`} className="font-semibold text-primary hover:underline truncate block" title={u.email}>
                        {u.email}
                      </a>
                    ) : <span className="text-ink-subtle italic">—</span>}
                  </div>

                  <div>
                    <span className="text-ink-subtle uppercase text-[10px] font-bold block mb-0.5 flex items-center gap-1">
                      <IndianRupee size={11} className="text-primary" /> Consultation Fee
                    </span>
                    <span className="font-semibold text-ink">
                      {u.consultation_fee ? `₹${u.consultation_fee} per visit` : (tab === 'doctors' ? 'Standard Clinic Fee' : 'N/A')}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-subtle uppercase text-[10px] font-bold block mb-0.5 flex items-center gap-1">
                      <GraduationCap size={11} className="text-primary" /> Qualifications
                    </span>
                    <span className="font-semibold text-ink truncate block" title={u.qualifications || 'Certified'}>
                      {u.qualifications || 'Verified Professional'}
                    </span>
                  </div>
                </div>

                {/* Attached Files & Documents Live Section */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink uppercase tracking-wide flex items-center gap-1.5">
                      <FileCheck size={14} className="text-primary" /> 
                      Attached Files & Medical Certificates ({allDocs.length})
                    </span>
                    <button 
                      onClick={() => onUploadDoc(u)} 
                      className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 hover:bg-primary-100 transition"
                    >
                      <UploadCloud size={13} /> + Upload Document / Certificate
                    </button>
                  </div>

                  {allDocs.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-black/10 bg-white flex items-center justify-between text-xs text-ink-muted">
                      <span>No certificates, licenses, or verification files attached yet.</span>
                      <button 
                        onClick={() => onUploadDoc(u)} 
                        className="text-primary font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <Plus size={12} /> Upload now
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {allDocs.map((docItem, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-black/10 rounded-lg hover:border-primary/40 transition gap-2 shadow-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                              <FileText size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-ink truncate" title={docItem.name}>
                                {docItem.name}
                              </p>
                              <span className="text-[10px] text-teal-700 uppercase font-semibold">
                                {docItem.type || docItem.source}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <a 
                              href={docItem.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="p-1 rounded text-primary hover:bg-primary-50 transition"
                              title="View Document"
                            >
                              <ExternalLink size={13} />
                            </a>
                            <a 
                              href={docItem.url} 
                              download 
                              className="p-1 rounded text-slate-600 hover:bg-gray-100 transition"
                              title="Download File"
                            >
                              <Download size={13} />
                            </a>
                            <button 
                              onClick={() => onDeleteDoc(u, docItem)}
                              className="p-1 rounded text-danger hover:bg-danger-bg transition"
                              title="Delete Document"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-black/5 p-3">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-primary' : 'bg-ink-subtle/30'}`}
        role="switch" aria-checked={checked}>
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

// ============================================================================
// UPLOAD DOCUMENT / CERTIFICATE MODAL
// ============================================================================
// ============================================================================
// UPLOAD STAFF / DOCTOR DOCUMENTS MODAL (SUPPORTS MULTIPLE FILES AT ONCE)
// ============================================================================
interface QueuedStaffDoc {
  id: string;
  file: File;
  name: string;
  category: string;
}

function UploadStaffDocsModal({ 
  open, 
  user, 
  clinicId, 
  onClose, 
  onSuccess 
}: {
  open: boolean;
  user: User;
  clinicId: string;
  onClose: () => void;
  onSuccess: (docs: { name: string; url: string; type: string; uploaded_at: string }[]) => void;
}) {
  const { toast } = useToast();
  const [queuedFiles, setQueuedFiles] = useState<QueuedStaffDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQueuedFiles([]);
      setUploading(false);
      setProgress(0);
      setCurrentUploadIndex(0);
    }
  }, [open]);

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: QueuedStaffDoc[] = Array.from(files).map((f, i) => ({
      id: `${Date.now()}_${i}_${Math.random()}`,
      file: f,
      name: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      category: 'Medical License / Registration'
    }));
    setQueuedFiles(prev => [...prev, ...newItems]);
  };

  const removeQueuedFile = (id: string) => {
    setQueuedFiles(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: 'name' | 'category', val: string) => {
    setQueuedFiles(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queuedFiles.length === 0) {
      toast('Please choose at least one document file to upload.', 'error');
      return;
    }

    setUploading(true);
    setProgress(0);
    setCurrentUploadIndex(0);

    const uploadedList: { name: string; url: string; type: string; uploaded_at: string }[] = [];
    const total = queuedFiles.length;

    try {
      for (let i = 0; i < total; i++) {
        const item = queuedFiles[i];
        setCurrentUploadIndex(i + 1);

        const ext = item.file.name.split('.').pop() || 'pdf';
        const cleanFileName = (item.name || item.file.name).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const storagePath = `clinics/${clinicId}/staff_documents/${user.user_id}/${cleanFileName}_${Date.now()}_${i}.${ext}`;
        const storageRef = ref(storage, storagePath);

        const uploadTask = uploadBytesResumable(storageRef, item.file, {
          contentType: item.file.type || 'application/pdf'
        });

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snap) => {
              const filePct = snap.bytesTransferred / (snap.totalBytes || 1);
              const overall = Math.round(((i + filePct) / total) * 100);
              setProgress(Math.min(99, overall));
            },
            (err) => {
              console.error(err);
              reject(err);
            },
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                uploadedList.push({
                  name: item.name.trim() || item.file.name,
                  url: downloadUrl,
                  type: item.category,
                  uploaded_at: new Date().toISOString()
                });
                resolve();
              } catch (e) {
                reject(e);
              }
            }
          );
        });
      }

      // Batch save to Firestore user doc
      await updateDoc(doc(db, 'users', user.user_id), {
        certificates: arrayUnion(...uploadedList),
        onboarding_documents: arrayUnion(...uploadedList),
        updated_at: new Date().toISOString()
      });

      setProgress(100);
      toast(`Successfully uploaded ${uploadedList.length} document(s) for ${user.name}!`, 'success');
      setUploading(false);
      onSuccess(uploadedList);
    } catch (err: any) {
      console.error('Batch upload error:', err);
      setUploading(false);
      toast('Failed to upload document(s): ' + (err.message || 'Error occurred'), 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Upload Verification Documents: ${user.name}`} subtitle="Select and upload multiple medical licenses, certificates, degrees, or ID proofs at once">
      <form onSubmit={handleUpload} className="space-y-4 pt-2">
        <input 
          ref={fileInputRef}
          type="file" 
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" 
          className="hidden" 
          id="staff-docs-multi-input"
          onChange={(e) => handleFilesAdded(e.target.files)} 
        />

        {queuedFiles.length === 0 ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-black/15 rounded-2xl p-8 text-center hover:border-primary/50 transition cursor-pointer bg-slate-50/50 hover:bg-teal-50/30"
          >
            <UploadCloud size={36} className="mx-auto text-primary mb-2" />
            <p className="text-sm font-bold text-ink">Click or Drag & Drop multiple documents</p>
            <p className="text-xs text-ink-muted mt-1">Select multiple PDF certificates, JPG/PNG scans, or degree records</p>
            <button type="button" className="btn-secondary text-xs mt-3 inline-flex items-center gap-1.5 pointer-events-none">
              <Plus size={14} /> Browse Files (Multiple)
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-black/5">
              <span className="text-xs font-bold text-ink uppercase tracking-wide">
                Selected Documents ({queuedFiles.length})
              </span>
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> + Add More Documents
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {queuedFiles.map((item, idx) => (
                <div key={item.id} className="p-3 bg-white border border-black/10 rounded-xl space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink truncate" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <span className="text-[10px] text-ink-subtle">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => removeQueuedFile(item.id)}
                      disabled={uploading}
                      className="text-ink-subtle hover:text-danger p-1 rounded-lg transition"
                      title="Remove file from queue"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-black/5">
                    <div>
                      <label className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Document Title</label>
                      <input 
                        required
                        disabled={uploading}
                        className="input text-xs py-1.5"
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                        placeholder="E.g. MBBS Certificate, Council License"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Category</label>
                      <select 
                        disabled={uploading}
                        className="select text-xs py-1.5"
                        value={item.category}
                        onChange={e => updateItem(item.id, 'category', e.target.value)}
                      >
                        <option value="Medical License / Registration">Medical License / Council Registration</option>
                        <option value="Degree / Academic Certificate">Degree / Academic Certificate</option>
                        <option value="Government ID Proof (Aadhaar / Passport)">Government ID Proof (Aadhaar / Passport)</option>
                        <option value="Clinical Experience Proof">Clinical Experience Proof</option>
                        <option value="Employment Contract">Employment Contract</option>
                        <option value="Other Credential">Other Credential / File</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <div className="space-y-1.5 p-3 bg-teal-50/60 rounded-xl border border-teal-100">
            <div className="flex justify-between text-xs font-bold text-ink">
              <span>Uploading document {currentUploadIndex} of {queuedFiles.length}...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-teal-200/50 h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-black/5">
          <button type="button" onClick={onClose} disabled={uploading} className="btn-ghost">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {queuedFiles.length > 0 && !uploading && (
              <button 
                type="button" 
                onClick={() => setQueuedFiles([])} 
                className="btn-ghost text-xs text-danger"
              >
                Clear all
              </button>
            )}
            <button 
              type="submit" 
              disabled={uploading || queuedFiles.length === 0} 
              className="btn-primary flex items-center gap-1.5"
            >
              <Upload size={14} /> {uploading ? `Uploading (${currentUploadIndex}/${queuedFiles.length})…` : `Upload All (${queuedFiles.length}) Documents`}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// UPLOAD CLINIC LEGAL & VERIFICATION DOCUMENTS (SUPPORTS MULTIPLE FILES AT ONCE)
// ============================================================================
interface QueuedClinicDoc {
  id: string;
  file: File;
  name: string;
  category: string;
}

function UploadClinicDocsModal({ 
  open, 
  clinic, 
  onClose, 
  onSuccess 
}: {
  open: boolean;
  clinic: any;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const [queuedFiles, setQueuedFiles] = useState<QueuedClinicDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQueuedFiles([]);
      setUploading(false);
      setProgress(0);
      setCurrentUploadIndex(0);
    }
  }, [open]);

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: QueuedClinicDoc[] = Array.from(files).map((f, i) => ({
      id: `${Date.now()}_${i}_${Math.random()}`,
      file: f,
      name: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      category: 'Clinical Establishment Act License'
    }));
    setQueuedFiles(prev => [...prev, ...newItems]);
  };

  const removeQueuedFile = (id: string) => {
    setQueuedFiles(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: 'name' | 'category', val: string) => {
    setQueuedFiles(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queuedFiles.length === 0) {
      toast('Please select at least one document to upload.', 'error');
      return;
    }

    setUploading(true);
    setProgress(0);
    setCurrentUploadIndex(0);

    const folderName = clinic.name ? clinic.name.replace(/[^a-zA-Z0-9 -]/g, '').trim() : clinic.clinic_id;
    const uploadedList: { name: string; url: string; type: string; uploaded_at: string }[] = [];
    const total = queuedFiles.length;

    try {
      for (let i = 0; i < total; i++) {
        const item = queuedFiles[i];
        setCurrentUploadIndex(i + 1);

        const ext = item.file.name.split('.').pop() || 'pdf';
        const cleanFileName = (item.name || item.file.name).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const storagePath = `clinics onboarding files/${folderName}/${cleanFileName}_${Date.now()}_${i}.${ext}`;
        const storageRef = ref(storage, storagePath);

        const uploadTask = uploadBytesResumable(storageRef, item.file, {
          contentType: item.file.type || 'application/pdf'
        });

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snap) => {
              const filePct = snap.bytesTransferred / (snap.totalBytes || 1);
              const overall = Math.round(((i + filePct) / total) * 100);
              setProgress(Math.min(99, overall));
            },
            (err) => {
              console.error(err);
              reject(err);
            },
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                uploadedList.push({
                  name: item.name.trim() || item.file.name,
                  url: downloadUrl,
                  type: item.category,
                  uploaded_at: new Date().toISOString()
                });
                resolve();
              } catch (e) {
                reject(e);
              }
            }
          );
        });
      }

      // Batch save to Firestore clinic doc
      await updateDoc(doc(db, 'clinics', clinic.clinic_id), {
        onboarding_documents: arrayUnion(...uploadedList),
        documents_uploaded: true,
        updated_at: new Date().toISOString()
      });

      setProgress(100);
      toast(`Successfully uploaded ${uploadedList.length} clinic verification document(s)!`, 'success');
      setUploading(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Batch upload error:', err);
      setUploading(false);
      toast('Failed to upload clinic documents: ' + (err.message || 'Error occurred'), 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Upload Clinic Verification Documents" subtitle="Upload multiple clinical establishment licenses, tax certificates, pollution clearances, and accreditations">
      <form onSubmit={handleUpload} className="space-y-4 pt-2">
        <input 
          ref={fileInputRef}
          type="file" 
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" 
          className="hidden" 
          id="clinic-docs-multi-input"
          onChange={(e) => handleFilesAdded(e.target.files)} 
        />

        {queuedFiles.length === 0 ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-black/15 rounded-2xl p-8 text-center hover:border-primary/50 transition cursor-pointer bg-slate-50/50 hover:bg-teal-50/30"
          >
            <UploadCloud size={36} className="mx-auto text-primary mb-2" />
            <p className="text-sm font-bold text-ink">Click or Drag & Drop multiple documents</p>
            <p className="text-xs text-ink-muted mt-1">Select multiple PDF licenses, GST records, or establishment certificates at once</p>
            <button type="button" className="btn-secondary text-xs mt-3 inline-flex items-center gap-1.5 pointer-events-none">
              <Plus size={14} /> Browse Files (Multiple)
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-black/5">
              <span className="text-xs font-bold text-ink uppercase tracking-wide">
                Selected Documents ({queuedFiles.length})
              </span>
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> + Add More Documents
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {queuedFiles.map((item, idx) => (
                <div key={item.id} className="p-3 bg-white border border-black/10 rounded-xl space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink truncate" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <span className="text-[10px] text-ink-subtle">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => removeQueuedFile(item.id)}
                      disabled={uploading}
                      className="text-ink-subtle hover:text-danger p-1 rounded-lg transition"
                      title="Remove file from queue"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-black/5">
                    <div>
                      <label className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Document Title</label>
                      <input 
                        required
                        disabled={uploading}
                        className="input text-xs py-1.5"
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                        placeholder="E.g. Clinical Establishment Act License"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Category</label>
                      <select 
                        disabled={uploading}
                        className="select text-xs py-1.5"
                        value={item.category}
                        onChange={e => updateItem(item.id, 'category', e.target.value)}
                      >
                        <option value="Clinical Establishment Act License">Clinical Establishment Act License</option>
                        <option value="Clinic Registration Certificate">Clinic Registration Certificate</option>
                        <option value="GST Registration Certificate">GST Registration Certificate</option>
                        <option value="Bio-Medical Waste Management (BMWM) Authorization">Bio-Medical Waste Management Authorization</option>
                        <option value="Pollution Control Board NOC">Pollution Control Board NOC</option>
                        <option value="NABH / NABL Accreditation Certificate">NABH / NABL Accreditation Certificate</option>
                        <option value="Trade License / Municipal Certificate">Trade License / Municipal Certificate</option>
                        <option value="Clinic PAN / Tax Registration">Clinic PAN / Tax Registration</option>
                        <option value="Other Legal / Regulatory Document">Other Legal / Regulatory Document</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <div className="space-y-1.5 p-3 bg-teal-50/60 rounded-xl border border-teal-100">
            <div className="flex justify-between text-xs font-bold text-ink">
              <span>Uploading document {currentUploadIndex} of {queuedFiles.length}...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-teal-200/50 h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-black/5">
          <button type="button" onClick={onClose} disabled={uploading} className="btn-ghost">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {queuedFiles.length > 0 && !uploading && (
              <button 
                type="button" 
                onClick={() => setQueuedFiles([])} 
                className="btn-ghost text-xs text-danger"
              >
                Clear all
              </button>
            )}
            <button 
              type="submit" 
              disabled={uploading || queuedFiles.length === 0} 
              className="btn-primary flex items-center gap-1.5"
            >
              <Upload size={14} /> {uploading ? `Uploading (${currentUploadIndex}/${queuedFiles.length})…` : `Upload All (${queuedFiles.length}) Documents`}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// EDIT DOCTOR / STAFF PROFILE MODAL
// ============================================================================
function EditUserModal({ 
  open, 
  user, 
  onClose, 
  onSave 
}: {
  open: boolean;
  user: User;
  onClose: () => void;
  onSave: (data: Partial<User>) => void;
}) {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [specialisation, setSpecialisation] = useState(user.specialisation || '');
  const [designation, setDesignation] = useState(user.designation || '');
  const [experienceYears, setExperienceYears] = useState(user.experience_years ? String(user.experience_years) : '');
  const [consultationFee, setConsultationFee] = useState(user.consultation_fee ? String(user.consultation_fee) : '');
  const [qualifications, setQualifications] = useState(user.qualifications || '');
  const [address, setAddress] = useState(user.address || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      phone: phone.trim() || null,
      specialisation: specialisation.trim() || null,
      designation: designation.trim() || null,
      experience_years: experienceYears ? Number(experienceYears) : 0,
      consultation_fee: consultationFee ? Number(consultationFee) : null,
      qualifications: qualifications.trim() || null,
      address: address.trim() || null
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Details — ${user.name}`} subtitle="Update contact numbers, clinical designations, and fees" size="md">
      <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Full Name *</label>
            <input required className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Specialisation / Department</label>
            <input className="input" value={specialisation} onChange={e => setSpecialisation(e.target.value)} placeholder="General Medicine, Pediatrics" />
          </div>
          <div>
            <label className="label">Designation / Role Title</label>
            <input className="input" value={designation} onChange={e => setDesignation(e.target.value)} placeholder="Senior Consultant Physician" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Experience (Years)</label>
            <input type="number" min="0" className="input" value={experienceYears} onChange={e => setExperienceYears(e.target.value)} placeholder="5" />
          </div>
          <div>
            <label className="label">Consultation Fee (₹)</label>
            <input type="number" min="0" className="input" value={consultationFee} onChange={e => setConsultationFee(e.target.value)} placeholder="500" />
          </div>
        </div>

        <div>
          <label className="label">Qualifications & Degrees</label>
          <input className="input" value={qualifications} onChange={e => setQualifications(e.target.value)} placeholder="MBBS, MD, DNB" />
        </div>

        <div>
          <label className="label">Residential / Office Address</label>
          <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="City, State" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-black/5">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" className="btn-primary">Save Changes</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// FULL USER DOSSIER & CREDENTIALS MODAL
// ============================================================================
function UserDetailsModal({ 
  open, 
  user, 
  clinic,
  onClose, 
  onEdit, 
  onUploadDoc, 
  onDeleteDoc 
}: {
  open: boolean;
  user: User;
  clinic: any;
  onClose: () => void;
  onEdit: () => void;
  onUploadDoc: () => void;
  onDeleteDoc: (doc: { name: string; url: string }) => void;
}) {
  const allDocs = [
    ...(user.certificates || []).map(c => ({ ...c, source: 'Certificate' })),
    ...(user.onboarding_documents || []).map(c => ({ ...c, source: 'Onboarding Document' })),
    ...(user.documents || []).map(c => ({ ...c, source: 'Credential' }))
  ];

  const displayId = user.display_id || user.id_number || (user.user_id ? `DOC-${user.user_id.slice(0, 6).toUpperCase()}` : '—');

  return (
    <Modal open={open} onClose={onClose} title={user.name} subtitle={`Complete Profile & Credentials · ID: ${displayId}`} size="lg">
      <div className="space-y-4 pt-1">
        {/* Profile Header Box */}
        <div className="flex items-start justify-between bg-primary-50/50 p-4 rounded-xl border border-primary/15 gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={user.name} color={user.avatar_color} size={52} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-ink text-base">{user.name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  user.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {user.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Role: <strong className="text-ink">{user.role}</strong> · {clinic?.name || 'Clinic'}
              </p>
            </div>
          </div>
          <button onClick={onEdit} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0">
            <Edit3 size={13} /> Edit Profile
          </button>
        </div>

        {/* Detailed Demographics Table */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white p-3 rounded-lg border border-black/10">
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Official ID / Code</span>
            <span className="font-semibold text-ink font-mono">{displayId}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-black/10">
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Contact Phone</span>
            {user.phone ? (
              <a href={`tel:${user.phone}`} className="font-semibold text-primary hover:underline">{user.phone}</a>
            ) : <span className="text-ink-subtle italic">—</span>}
          </div>

          <div className="bg-white p-3 rounded-lg border border-black/10">
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Email Address</span>
            <span className="font-semibold text-ink truncate block" title={user.email}>{user.email}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-black/10">
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Specialisation</span>
            <span className="font-semibold text-ink">{user.specialisation || 'General Medicine'}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-black/10">
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Clinical Designation</span>
            <span className="font-semibold text-ink">{user.designation || 'Consulting Physician'}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-black/10">
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Clinical Experience</span>
            <span className="font-semibold text-ink">{user.experience_years ? `${user.experience_years} Years` : '—'}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-black/10">
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Consultation Fee</span>
            <span className="font-semibold text-ink">{user.consultation_fee ? `₹${user.consultation_fee}` : 'Standard Clinic Fee'}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-black/10">
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Qualifications</span>
            <span className="font-semibold text-ink">{user.qualifications || 'Verified Professional'}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-black/10">
            <span className="text-[10px] text-ink-subtle uppercase font-bold block mb-0.5">Registration Date</span>
            <span className="font-semibold text-ink">{formatDate(user.created_at)}</span>
          </div>
        </div>

        {/* Documents & Verification Section */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between pb-1 border-b border-black/5">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-teal-600" />
              Verified Documents & Certificates ({allDocs.length})
            </h4>
            <button onClick={onUploadDoc} className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1">
              <Plus size={13} /> Upload New File
            </button>
          </div>

          {allDocs.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-black/10 text-center space-y-2">
              <p className="text-xs text-ink-muted">No documents or medical licenses uploaded for this account yet.</p>
              <button onClick={onUploadDoc} className="btn-secondary text-xs mx-auto inline-flex items-center gap-1">
                <UploadCloud size={14} /> Upload First Document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {allDocs.map((docItem, idx) => (
                <div key={idx} className="p-3 bg-gray-50 border border-black/10 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink truncate" title={docItem.name}>{docItem.name}</p>
                      <span className="text-[10px] text-teal-700 font-semibold uppercase">{docItem.type || docItem.source}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a 
                      href={docItem.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-1.5 rounded-lg bg-white border border-black/10 text-primary hover:bg-primary-50 transition"
                      title="Open Document"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <a 
                      href={docItem.url} 
                      download 
                      className="p-1.5 rounded-lg bg-white border border-black/10 text-slate-700 hover:bg-gray-100 transition"
                      title="Download File"
                    >
                      <Download size={14} />
                    </a>
                    <button 
                      onClick={() => onDeleteDoc(docItem)}
                      className="p-1.5 rounded-lg bg-white border border-black/10 text-danger hover:bg-danger-bg transition"
                      title="Remove Document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// ADD DOCTOR / STAFF ACCOUNT MODAL
// ============================================================================
function AddUserModal({ 
  open, 
  initialRole,
  onClose, 
  onSaved 
}: {
  open: boolean;
  initialRole?: Role;
  onClose: () => void;
  onSaved: (d: { 
    name: string; 
    email: string; 
    role: Role; 
    phone: string; 
    specialisation: string; 
    designation: string;
    experience_years: number | null;
    consultation_fee: number | null;
    qualifications: string;
    password: string;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(initialRole || 'doctor');
  const [phone, setPhone] = useState('');
  const [spec, setSpec] = useState('');
  const [designation, setDesignation] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [pw, setPw] = useState('');

  useEffect(() => {
    if (initialRole) setRole(initialRole);
  }, [initialRole]);

  const isDoc = role === 'doctor' || role === 'clinic_doctor';

  const submit = () => {
    if (!name.trim() || !email.trim()) return;
    if (!pw.trim() || pw.length < 8) return;
    onSaved({ 
      name: name.trim(), 
      email: email.trim(), 
      role, 
      phone: phone.trim(), 
      specialisation: spec.trim() || (isDoc ? 'General Medicine' : ''), 
      designation: designation.trim() || (isDoc ? 'Consulting Physician' : 'Staff Member'),
      experience_years: experienceYears ? Number(experienceYears) : (isDoc ? 1 : null),
      consultation_fee: consultationFee ? Number(consultationFee) : (isDoc ? 300 : null),
      qualifications: qualifications.trim(),
      password: pw 
    });
    setName(''); setEmail(''); setSpec(''); setPhone(''); setPw('');
    setDesignation(''); setExperienceYears(''); setConsultationFee(''); setQualifications('');
  };

  return (
    <Modal open={open} onClose={onClose} title={isDoc ? "Add New Doctor" : "Add New Staff Member"} subtitle="Create an official clinic staff account with full credentials" size="md"
      footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button onClick={submit} className="btn-primary"><Plus size={14} /> Add account</button></>}
    >
      <div className="space-y-3">
        <div>
          <label className="label">Full Legal Name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={isDoc ? "Dr. Priya Rao" : "John Mathew"} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Email Address *</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="doctor@clinic.com" /></div>
          <div><label className="label">Phone Number</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" /></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Role</label>
            <select className="select" value={role} onChange={e => setRole(e.target.value as Role)}>
              <option value="doctor">Doctor</option>
              <option value="staff">Receptionist / Staff</option>
              <option value="admin">Clinic Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Specialisation / Department</label>
            <input className="input" value={spec} onChange={e => setSpec(e.target.value)} placeholder={isDoc ? "General Medicine" : "Front Desk"} />
          </div>
        </div>

        {isDoc && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Consultation Fee (₹)</label>
              <input type="number" min="0" className="input" value={consultationFee} onChange={e => setConsultationFee(e.target.value)} placeholder="500" />
            </div>
            <div>
              <label className="label">Experience (Years)</label>
              <input type="number" min="0" className="input" value={experienceYears} onChange={e => setExperienceYears(e.target.value)} placeholder="3" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Designation</label>
            <input className="input" value={designation} onChange={e => setDesignation(e.target.value)} placeholder={isDoc ? "Senior Consultant" : "Front Desk Executive"} />
          </div>
          <div>
            <label className="label">Qualifications</label>
            <input className="input" value={qualifications} onChange={e => setQualifications(e.target.value)} placeholder={isDoc ? "MBBS, MD" : "B.Com / Healthcare Ops"} />
          </div>
        </div>

        <div>
          <label className="label">Initial Login Password *</label>
          <input type="password" className="input" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 8 characters" />
        </div>
      </div>
    </Modal>
  );
}
