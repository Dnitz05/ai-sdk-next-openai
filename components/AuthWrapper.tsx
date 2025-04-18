// components/AuthWrapper.tsx
'use client';
import SessionProvider from './SessionProvider';
import AuthForm from './AuthForm';

export default function AuthWrapper() {
  return (
    <SessionProvider>
      <AuthForm />
    </SessionProvider>
  );
}