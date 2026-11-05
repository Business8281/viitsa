interface EmailVerificationPromptProps {
  className?: string;
}

export function EmailVerificationPrompt({ className: _className = '' }: EmailVerificationPromptProps) {
  // Disabled: system uses Google Authentication and Mobile OTP for logins
  return null;
}
