import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccount } from './AuthGate.web';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';
import { Colors, Space } from '@/constants/tokens';
import { readBackup, saveBackup, restoreBackup, hasPreviousBackup, undoRestore, type OnlineBackup } from '@/lib/account-backup';

export function CloudBackup() {
  const user = useAccount();
  const [backup, setBackup] = useState<OnlineBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [previous, setPrevious] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setBackup(null);
    setMessage('');
    setPrevious(false);
    if (user) hasPreviousBackup(user.id).then(value => { if (!cancelled) setPrevious(value); }).catch(() => {});
    if (user) readBackup(user.id).then(value => {
      if (!cancelled) { setBackup(value); setLoaded(true); }
    }).catch(error => { if (!cancelled) setMessage(error.message); });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function run(action: 'read' | 'save' | 'restore' | 'undo') {
    if (!user || busy) return;
    if (action === 'save' && backup && !window.confirm('Substituir a copia online pelos dados deste aparelho?')) return;
    if (action === 'restore' && (!backup || !window.confirm(`Restaurar ${backup.snapshot.tournaments.length} mesas da copia online? As mesas, estruturas e relogios locais serao substituidos. Uma copia local anterior sera preservada.`))) return;
    if (action === 'undo' && !window.confirm('Voltar para os dados locais anteriores a ultima restauracao?')) return;
    setBusy(true);
    setMessage('');
    try {
      if (action === 'save') await saveBackup(user.id, backup?.revision ?? 0);
      if (action === 'restore' && backup) await restoreBackup(user.id, backup);
      if (action === 'undo') await undoRestore(user.id);
      setPrevious(await hasPreviousBackup(user.id));
      const value = await readBackup(user.id);
      setBackup(value);
      setLoaded(true);
      setMessage(action === 'save' ? 'Cópia salva online.' : action === 'restore' ? 'Cópia restaurada neste aparelho.' : action === 'undo' ? 'Dados locais anteriores recuperados.' : 'Consulta atualizada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel concluir. Tente novamente.');
    } finally { setBusy(false); }
  }

  return (
    <View style={{ gap: Space.md, borderTopWidth: 1, borderColor: Colors.border, paddingTop: Space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <Ionicons name="cloud-outline" size={24} color={Colors.gold300} />
        <KTText papel="corpoForte">Cópia online</KTText>
      </View>
      <KTText papel="apoio" color={Colors.text2}>
        {user ? 'Salve suas mesas, estruturas e relógios na sua conta e restaure em outro aparelho. O salvamento é manual; não há sincronização em tempo real nesta etapa.' : 'Modo de teste: suas mesas ficam apenas neste aparelho. Entre com uma conta para salvar uma cópia online.'}
      </KTText>
      {backup && <KTText papel="apoio" color={Colors.gold200}>{backup.snapshot.tournaments.length} mesas · {backup.snapshot.presets.length} estruturas · {new Date(backup.updatedAt).toLocaleString('pt-BR')}</KTText>}
      {user && loaded && !backup && <KTText papel="apoio" color={Colors.text2}>Nenhuma cópia online salva ainda.</KTText>}
      {message !== '' && <View accessibilityLiveRegion="polite"><KTText papel="apoio">{message}</KTText></View>}
      <KTButton label={busy ? 'Aguarde...' : 'Salvar cópia online'} disabled={!user || !loaded || busy} onPress={() => void run('save')} fullWidth icone={<Ionicons name="cloud-upload-outline" size={20} color={Colors.bg0} />} />
      {user && <>
        <KTButton label="Restaurar cópia online" variant="fantasma" disabled={!backup || busy} onPress={() => void run('restore')} fullWidth />
        <KTButton label="Atualizar consulta" variant="fantasma" disabled={busy} onPress={() => void run('read')} fullWidth />
        {previous && <KTButton label="Recuperar dados locais anteriores" variant="fantasma" disabled={busy} onPress={() => void run('undo')} fullWidth />}
      </>}
    </View>
  );
}
