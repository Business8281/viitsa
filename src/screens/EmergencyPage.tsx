import { PatientLanding } from '../patient/PatientLanding';
import { PatientAuthProvider, usePatientAuth } from '../lib/patientAuth';

function EmergencyContent() {
  const { clinic } = usePatientAuth();
  return <PatientLanding clinic={clinic} />;
}

export function EmergencyPage() {
  return (
    <PatientAuthProvider>
      <EmergencyContent />
    </PatientAuthProvider>
  );
}
