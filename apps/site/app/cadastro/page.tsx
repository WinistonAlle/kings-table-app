import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
export const metadata: Metadata = { title: 'Criar conta | King’s Table', robots: { index: false, follow: false } };
export default function Cadastro() { return <AuthForm mode="cadastro" />; }
