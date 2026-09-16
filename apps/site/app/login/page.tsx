import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
export const metadata: Metadata = { title: 'Entrar | King’s Table', robots: { index: false, follow: false } };
export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const testAccessUrl = process.env.NODE_ENV === 'development' && appUrl && ['localhost', '127.0.0.1'].includes(new URL(appUrl).hostname)
    ? `${appUrl.replace(/\/$/, '')}/?teste=1` : undefined;
  return <AuthForm mode="login" testAccessUrl={testAccessUrl} initialError={erro === 'link' ? 'Este link não é válido ou expirou. Tente entrar ou solicite um novo link.' : ''} />;
}
