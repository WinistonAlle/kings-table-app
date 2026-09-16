import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
export const metadata: Metadata = { title: 'Recuperar senha | King’s Table', robots: { index: false, follow: false } };
export default function Recuperar() { return <AuthForm mode="recuperar" />; }
