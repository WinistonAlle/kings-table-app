'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowLeft, Eye, EyeOff, LoaderCircle, Mail, CheckCircle2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Marca } from './Marca';
import './auth.css';

export type AuthMode = 'login' | 'cadastro' | 'recuperar' | 'nova-senha';
const copy = {
  login: { title: 'Bom ter você de volta.', subtitle: 'Entre para organizar sua próxima noite.', action: 'Entrar no sistema' },
  cadastro: { title: 'Seu lugar à mesa.', subtitle: 'Crie sua conta e comece pelo plano gratuito.', action: 'Criar minha conta' },
  recuperar: { title: 'Vamos recuperar seu acesso.', subtitle: 'Enviaremos um link para você criar uma nova senha.', action: 'Enviar link de recuperação' },
  'nova-senha': { title: 'Uma nova senha.', subtitle: 'Escolha uma senha segura para sua conta.', action: 'Salvar nova senha' },
};

export function AuthForm({ mode, initialError = '', testAccessUrl }: { mode: AuthMode; initialError?: string; testAccessUrl?: string }) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState('');
  const c = copy[mode];
  const signup = mode === 'cadastro';
  const password = mode !== 'recuperar';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const senha = String(data.get('password') || '');
    const nome = String(data.get('name') || '').trim();
    setError('');
    if (signup && nome.length < 2) { setError('Informe seu nome com pelo menos dois caracteres.'); return; }
    if ((signup || mode === 'nova-senha') && senha.length < 8) { setError('Use uma senha com pelo menos 8 caracteres.'); return; }
    if ((signup || mode === 'nova-senha') && senha !== data.get('confirm')) { setError('As senhas não coincidem.'); return; }
    setPending(true);
    try {
      const client = authClient();
      const callback = `${window.location.origin}/auth/callback`;
      if (mode === 'login') {
        const { error: err } = await client.auth.signInWithPassword({ email, password: senha });
        if (err) {
          setError(err.code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.' : err.status === 429 ? 'Muitas tentativas. Aguarde um pouco e tente novamente.' : 'Não foi possível entrar. Confira seu e-mail e sua senha.');
          return;
        }
        window.location.assign('/acessar');
      } else if (signup) {
        const { data: result, error: err } = await client.auth.signUp({ email, password: senha, options: { data: { name: nome, full_name: nome }, emailRedirectTo: callback } });
        if (err) { setError(err.status === 429 ? 'Aguarde um pouco antes de tentar novamente.' : 'Não foi possível criar a conta. Tente novamente ou entre se já tiver uma conta.'); return; }
        if (result.session) { window.location.assign('/acessar'); return; }
        setSuccess('Confira seu e-mail e clique no link de confirmação para concluir seu cadastro. Se já tiver uma conta, use a opção Entrar.');
      } else if (mode === 'recuperar') {
        const { error: err } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${callback}?destino=senha` });
        if (err) { setError('Não foi possível enviar o link agora. Aguarde um pouco e tente novamente.'); return; }
        setSuccess('Se esse e-mail tiver uma conta, você receberá um link de recuperação. Confira também a pasta de spam.');
      } else {
        const { data: { user } } = await client.auth.getUser();
        if (!user) { setError('Este link expirou. Solicite um novo link de recuperação.'); return; }
        const { error: err } = await client.auth.updateUser({ password: senha });
        if (err) { setError('Não foi possível salvar a senha. Use uma senha diferente ou solicite um novo link.'); return; }
        window.location.assign('/acessar');
      }
    } catch { setError('Não foi possível conectar. Confira sua conexão e tente novamente.'); }
    finally { setPending(false); }
  }

  return <main className="auth-page">
    <Link href="/" className="auth-back"><ArrowLeft size={16} /> Voltar ao site</Link>
    <section className="auth-content" aria-labelledby="auth-title">
      <Link href="/" className="auth-brand"><Marca /><span>King’s Table</span></Link>
      <div className="auth-heading"><h1 id="auth-title">{c.title}</h1><p>{c.subtitle}</p></div>
      {success ? <div className="auth-success" role="status"><CheckCircle2 size={28} /><h2>Confira sua caixa de entrada.</h2><p>{success}</p><Link href="/login" className="auth-submit">Ir para o login <ArrowRight size={18} /></Link><button className="auth-text-button" onClick={() => setSuccess('')}>Usar outro e-mail</button></div> :
        <form onSubmit={submit} className="auth-form">
          <fieldset disabled={pending}>
            {signup && <label htmlFor="name">Seu nome<input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="Como podemos te chamar?" /></label>}
            {mode !== 'nova-senha' && <label htmlFor="email">E-mail<div className="auth-input-wrap"><Mail size={18} /><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="voce@email.com" /></div></label>}
            {password && <label htmlFor="password"><span className="auth-label-row">Senha {mode === 'login' && <Link href="/recuperar-senha">Esqueceu a senha?</Link>}</span><div className="auth-input-wrap auth-password"><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 8} maxLength={128} placeholder={mode === 'login' ? 'Sua senha' : 'Pelo menos 8 caracteres'} /><button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} title={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}
            {(signup || mode === 'nova-senha') && <label htmlFor="confirm">Confirmar senha<input id="confirm" name="confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} placeholder="Repita sua senha" /></label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="auth-submit" onClick={event => {
              if (mode !== 'login' || !testAccessUrl || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
              const form = event.currentTarget.form;
              if (!form) return;
              const data = new FormData(form);
              if (String(data.get('email') || '').trim() || String(data.get('password') || '')) return;
              event.preventDefault();
              window.location.assign(testAccessUrl);
            }}>{pending ? <><LoaderCircle size={18} className="auth-spinner" /> Aguarde...</> : <>{c.action}<ArrowRight size={18} /></>}</button>
          </fieldset>
        </form>}
      <p className="auth-switch">{mode === 'login' ? <>Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></> : <>Já tem uma conta? <Link href="/login">Entrar</Link></>}</p>
      {signup && <p className="auth-note">Gratuito para começar. Sem cartão de crédito.</p>}
    </section>
    <p className="auth-footer">Sua noite de poker, organizada.</p>
  </main>;
}
