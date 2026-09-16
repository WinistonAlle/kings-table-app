import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
export const metadata: Metadata = { title: 'Entrar | King’s Table', robots: { index: false, follow: false } };
export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <AuthForm mode="login" initialError={erro === 'link' ? 'Este link não é válido ou expirou. Tente entrar ou solicite um novo link.' : ''} />;
}
