import { useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Colors, Fonts, Radius, Space } from '@/constants/tokens';
import { useTournamentStore } from '@/stores/tournamentStore';
import { useBlindsStore } from '@/stores/blindsStore';
import { dataAgendada, textoConvite } from '@/lib/noite';
import type { Attendance, Tournament } from '@/types';
import { confirmarAcao } from '@/lib/confirmar';

const ESTADOS: { value: Attendance; label: string; color: string }[] = [
  { value: 'confirmed', label: 'Confirmado', color: Colors.ok },
  { value: 'maybe', label: 'Talvez', color: Colors.warn },
  { value: 'absent', label: 'Não vai', color: Colors.text2 },
  { value: 'waiting', label: 'Espera', color: Colors.gold200 },
];

export function NightPlanning({ tournament: t }: { tournament: Tournament }) {
  const { invite, setAttendance, removeInvite, checkIn, startTournament, updateTournament } = useTournamentStore();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Attendance>('confirmed');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const date = new Date(t.startTime);
  const [day, setDay] = useState(date.toLocaleDateString('pt-BR'));
  const [time, setTime] = useState(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
  const [location, setLocation] = useState(t.location ?? '');
  const [capacity, setCapacity] = useState(t.capacity ? String(t.capacity) : '');
  const guests = t.invitees ?? [];
  const confirm = confirmarAcao;
  const share = async (whatsapp: boolean) => {
    try {
      const text = textoConvite(t);
      if (whatsapp) await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
      else { await Share.share({ message: text }); }
    } catch { setMessage('Não foi possível compartilhar. Tente novamente ou use o WhatsApp.'); }
  };
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(textoConvite(t)); setMessage('Convite copiado.'); }
    catch { setMessage('Não foi possível copiar o convite. Compartilhe pelo WhatsApp.'); }
  };
  const save = () => {
    const startTime = dataAgendada(day, time);
    const limit = capacity.trim() ? Number(capacity) : undefined;
    const occupied = new Set([...t.players.map(p => p.name.toLocaleLowerCase('pt-BR')), ...guests.filter(g => g.status === 'confirmed').map(g => g.name.toLocaleLowerCase('pt-BR'))]).size;
    if (!startTime) { setMessage('Informe uma data futura válida e horário HH:MM.'); return; }
    if (limit !== undefined && (!Number.isInteger(limit) || limit < Math.max(2, occupied) || limit > 1000)) { setMessage(`O limite deve comportar os participantes e ter entre ${Math.max(2, occupied)} e 1.000 vagas.`); return; }
    updateTournament(t.id, { startTime, location: location.trim(), capacity: limit });
    setEditing(false); setMessage('Agendamento atualizado.');
  };
  return <View style={styles.section}>
    <View style={styles.heading}><Ionicons name="calendar-outline" size={24} color={Colors.gold300} /><KTText papel="subtitulo">Organizar a noite</KTText></View>
    <KTText papel="corpoForte">{date.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}</KTText>
    <KTText color={Colors.text1}>{t.location || 'Local a combinar'} · {t.capacity ? `${t.capacity} vagas` : 'Sem limite de vagas'}</KTText>
    <View style={styles.actions}>
      <KTButton label="WhatsApp" variant="fantasma" onPress={() => share(true)} icone={<Ionicons name="logo-whatsapp" size={18} color={Colors.gold200} />} />
      {Platform.OS === 'web' && <KTButton label="Copiar convite" variant="fantasma" onPress={copyInvite} icone={<Ionicons name="copy-outline" size={18} color={Colors.gold200} />} />}
      {Platform.OS !== 'web' && <KTButton label="Compartilhar convite" variant="fantasma" onPress={() => share(false)} />}
      <KTButton label={editing ? 'Fechar edição' : 'Editar agendamento'} variant="fantasma" onPress={() => { setEditing(!editing); setMessage(''); }} />
    </View>
    {editing && <View style={styles.section}>
      <KTText color={Colors.text1}>Data e horário</KTText>
      <TextInput accessibilityLabel="Editar data da noite" value={day} onChangeText={setDay} style={styles.input} maxLength={10} />
      <TextInput accessibilityLabel="Editar horário da noite" value={time} onChangeText={setTime} style={styles.input} maxLength={5} />
      <KTText color={Colors.text1}>Local</KTText><TextInput accessibilityLabel="Editar local" value={location} onChangeText={setLocation} style={styles.input} maxLength={120} />
      <KTText color={Colors.text1}>Vagas</KTText><TextInput accessibilityLabel="Editar limite de vagas" value={capacity} onChangeText={setCapacity} style={styles.input} keyboardType="number-pad" placeholder="Sem limite" placeholderTextColor={Colors.text2} maxLength={4} />
      <KTButton label="Salvar agendamento" onPress={save} />
    </View>}
    <View style={styles.counts}>{ESTADOS.map(s => <View key={s.value} style={{ minWidth: 70, flex: 1 }}><KTText papel="numero" size={24} color={s.color}>{guests.filter(c => c.status === s.value).length}</KTText><KTText papel="apoio" color={Colors.text1}>{s.label}</KTText></View>)}</View>
    <KTText papel="corpoForte">Convidados e presença</KTText>
    <TextInput accessibilityLabel="Nome do convidado" value={name} onChangeText={setName} placeholder="Nome e sobrenome" placeholderTextColor={Colors.text2} style={styles.input} maxLength={60} />
    <View style={styles.actions}>{ESTADOS.map(s => <Pressable key={s.value} accessibilityRole="radio" accessibilityLabel={s.label} accessibilityState={{ checked: status === s.value }} onPress={() => setStatus(s.value)} style={[styles.option, { borderColor: status === s.value ? s.color : Colors.border }]}><KTText color={status === s.value ? s.color : Colors.text1}>{s.label}</KTText></Pressable>)}</View>
    <KTButton label="Adicionar convidado" disabled={!name.trim()} variant="fantasma" fullWidth onPress={() => {
      if (guests.some(g => g.name.trim().toLocaleLowerCase('pt-BR') === name.trim().toLocaleLowerCase('pt-BR'))) { setMessage('Esse nome já está na lista. Use um sobrenome para diferenciar.'); return; }
      invite(t.id, name, status); setName(''); setMessage('Convidado adicionado. Se as vagas acabarem, a confirmação entra na espera.');
    }} />
    {!guests.length && <KTText color={Colors.text2}>Nenhum convidado ainda. Adicione os nomes para acompanhar as respostas.</KTText>}
    {[...guests].sort((a, b) => (a.status === 'waiting' ? 1 : 0) - (b.status === 'waiting' ? 1 : 0) || a.createdAt.localeCompare(b.createdAt)).map(g => <View key={g.id} style={styles.guest}>
      <View style={styles.heading}><KTText papel="corpoForte" style={{ flex: 1 }}>{g.name}</KTText>{!g.playerId && <Pressable accessibilityRole="button" accessibilityLabel={`Remover convite de ${g.name}`} onPress={() => confirm(`Remover ${g.name} dos convidados?`, () => removeInvite(t.id, g.id))} style={styles.icon}><Ionicons name="trash-outline" size={18} color={Colors.danger} /></Pressable>}</View>
      {g.playerId ? <KTText color={Colors.ok}>Já entrou na mesa · buy-in registrado</KTText> : <>
        <View style={styles.actions}>{ESTADOS.map(s => <Pressable key={s.value} accessibilityRole="radio" accessibilityLabel={`${g.name}: ${s.label}`} accessibilityState={{ checked: g.status === s.value }} onPress={() => { setAttendance(t.id, g.id, s.value); setMessage('Presença atualizada. Confirmações respeitam o limite de vagas.'); }} style={[styles.option, { borderColor: g.status === s.value ? s.color : Colors.border }]}><KTText papel="apoio" color={g.status === s.value ? s.color : Colors.text1}>{s.label}</KTText></Pressable>)}</View>
        {g.status === 'confirmed' && <KTButton label={`Dar entrada: ${g.name}`} variant="fantasma" onPress={() => confirm(`Dar entrada em ${g.name}? Será registrado um buy-in com pagamento a receber.`, () => checkIn(t.id, g.id))} />}
        {g.status === 'waiting' && <KTText papel="apoio" color={Colors.text2}>Espera #{guests.filter(c => c.status === 'waiting').findIndex(c => c.id === g.id) + 1} · confirme quando houver vaga.</KTText>}
      </>}
    </View>)}
    {!!message && <KTText accessibilityLiveRegion="polite" color={Colors.gold200}>{message}</KTText>}
    <KTButton label="Iniciar a noite" disabled={t.players.length < 2} fullWidth onPress={() => confirm('Iniciar a noite? As confirmações serão encerradas e o relógio de blinds começará.', () => { startTournament(t.id); useBlindsStore.getState().selectTournament(t.id, t.blindStructure); useBlindsStore.getState().start(); })} />
    {t.players.length < 2 && <KTText papel="apoio" color={Colors.text2}>Dê entrada em pelo menos dois jogadores para iniciar.</KTText>}
    <KTButton label="Cancelar noite" variant="perigo" fullWidth disabled={t.players.length > 0} onPress={() => confirm('Cancelar esta noite?', () => updateTournament(t.id, { status: 'cancelled' }))} />
    {t.players.length > 0 && <KTText papel="apoio" color={Colors.text2}>Remova as entradas antes de cancelar para não perder registros financeiros.</KTText>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Space.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { width: '100%', minHeight: 48, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.sm, backgroundColor: Colors.bg1, color: Colors.text0, fontFamily: Fonts.ui, fontSize: 16, padding: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderRadius: Radius.sm, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  guest: { paddingVertical: 16, borderBottomWidth: 1, borderColor: Colors.border, gap: 12 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
