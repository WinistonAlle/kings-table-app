import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
export const metadata: Metadata = { title: 'Nova senha | King’s Table', robots: { index: false, follow: false } };
export default function NovaSenha() { return <AuthForm mode="nova-senha" />; }
