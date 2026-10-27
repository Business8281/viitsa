import { CheckCircle2, Circle } from 'lucide-react';
import { evaluatePasswordRules } from '../lib/passwordSecurity';

interface Props {
  password?: string;
  confirmPassword?: string;
  showAlways?: boolean;
}

export function PasswordRequirementsGuide({ password = '', confirmPassword, showAlways = false }: Props) {
  if (!password && !showAlways) return null;

  const rules = evaluatePasswordRules(password);
  const passwordsMatch = confirmPassword !== undefined ? Boolean(password && confirmPassword && password === confirmPassword) : true;
  const isAllValid = rules.isValid && passwordsMatch;

  const criteria = [
    { label: 'At least 8 characters', met: rules.minLength },
    { label: 'One uppercase letter (A–Z)', met: rules.hasUpper },
    { label: 'One lowercase letter (a–z)', met: rules.hasLower },
    { label: 'One number (0–9)', met: rules.hasNumber },
    { label: 'One special character (!@#$%^&*)', met: rules.hasSpecial },
    ...(confirmPassword !== undefined ? [{ label: 'Passwords match', met: passwordsMatch }] : []),
  ];

  return (
    <div className="mt-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1.5 transition-all">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-ink-muted uppercase tracking-wider text-[10px]">
          Password Requirements
        </span>
        <span className={`text-[10px] font-bold ${isAllValid ? 'text-emerald-600' : 'text-ink-subtle'}`}>
          {isAllValid ? 'All criteria met' : 'Strict security required'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {criteria.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            {item.met ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            )}
            <span className={`${item.met ? 'text-emerald-800 font-medium' : 'text-slate-500'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
        • Passwords must be completely unique and cannot match any other account.
      </p>
    </div>
  );
}
