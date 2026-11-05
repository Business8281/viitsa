import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { AuditEvent } from './types';

/**
 * Recursively strips undefined fields to ensure compatibility with Firestore addDoc.
 */
function cleanUndefinedForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data
      .filter((v) => v !== undefined)
      .map((v) => cleanUndefinedForFirestore(v)) as any;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        res[k] = cleanUndefinedForFirestore(v);
      }
    }
    return res as any;
  }
  return data;
}

/**
 * Log a structured, auditable security or healthcare operational event to Firestore.
 * Always fails gracefully without crashing client or server execution.
 */
export async function logAuditEvent(
  event: Omit<AuditEvent, 'log_id' | 'timestamp'> & { timestamp?: string }
): Promise<void> {
  try {
    const cleanEvent = cleanUndefinedForFirestore(event);
    const payload = {
      ...cleanEvent,
      timestamp: event.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, 'audit_logs'), payload);
  } catch (err) {
    // Non-blocking security logging fallback to console
    console.warn('[AuditLogger] Could not persist audit log to Firestore:', err, event);
  }
}

export async function logClinicalRecordCreated(
  actorId: string,
  actorRole: AuditEvent['actor_role'],
  clinicId: string,
  patientId: string,
  recordType: 'consultation' | 'prescription' | 'health_report' | 'vital' | 'invoice' | 'appointment',
  recordId?: string
): Promise<void> {
  return logAuditEvent({
    event_type: 'CLINICAL_RECORD_CREATED',
    actor_id: actorId,
    actor_role: actorRole,
    clinic_id: clinicId,
    patient_id: patientId,
    target_resource_id: recordId,
    target_resource_type: recordType,
    status: 'success',
    metadata: {
      record_type: recordType,
      record_id: recordId,
      created_at: new Date().toISOString()
    }
  });
}

export async function logCrossClinicBlocked(
  actorId: string,
  actorRole: AuditEvent['actor_role'],
  requesterClinicId: string,
  patientId: string,
  targetClinicId: string,
  resourceId?: string
): Promise<void> {
  return logAuditEvent({
    event_type: 'CROSS_CLINIC_ACCESS_BLOCKED',
    actor_id: actorId,
    actor_role: actorRole,
    clinic_id: requesterClinicId,
    patient_id: patientId,
    target_resource_id: resourceId,
    status: 'blocked',
    metadata: {
      requester_clinic_id: requesterClinicId,
      target_clinic_id: targetClinicId,
      blocked_at: new Date().toISOString()
    }
  });
}

export async function logClinicSwitch(
  patientId: string,
  fromClinicId: string | null,
  toClinicId: string,
  status: 'success' | 'failure' = 'success'
): Promise<void> {
  return logAuditEvent({
    event_type: 'CLINIC_SWITCHED',
    actor_id: patientId,
    actor_role: 'patient',
    clinic_id: toClinicId,
    patient_id: patientId,
    target_resource_id: toClinicId,
    target_resource_type: 'clinic',
    status,
    metadata: {
      from_clinic_id: fromClinicId,
      to_clinic_id: toClinicId,
      switched_at: new Date().toISOString()
    }
  });
}

export async function logUserLogin(
  userId: string,
  role: AuditEvent['actor_role'],
  clinicId?: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  const event: any = {
    event_type: 'USER_LOGIN',
    actor_id: userId,
    actor_role: role,
    status: 'success',
    metadata: {
      logged_in_at: new Date().toISOString(),
      ...metadata
    }
  };
  if (clinicId) {
    event.clinic_id = clinicId;
  }
  return logAuditEvent(event);
}
