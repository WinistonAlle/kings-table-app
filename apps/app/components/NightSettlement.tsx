import { useEffect, useState } from 'react';
import { View, Pressable, Platform, Share, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Tournament } from '@/types';
import { Colors } from '@/constants/tokens';
import { settlement, settlementSummary, ORGANIZER } from '@/lib/acerto';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';
import { useTournamentStore } from '@/stores/tournamentStore';
import { confirmarAcao } from '@/lib/confirmar';

const money = (cents: number) => (Math.abs(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function NightSettlement({ tournament }: { tournament: Tournament }) {
  const [confirmed, setConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<{ from: string; to: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const record = useTournamentStore(s => s.recordSettlement);
  const voidPayment = useTournamentStore(s => s.voidSettlement);
  const fingerprint = JSON.stringify([tournament.status, tournament.buyIn, tournament.players]);
  useEffect(() => { setConfirmed(false); setSelected(null); setMessage(''); }, [fingerprint]);
  const plan = settlement(tournament);
  const names = new Map([[ORGANIZER, 'Caixa do organizador'], ...tournament.players.map(p => [p.id, p.name] as [string, string])]);
  const payments = tournament.settlementPayments ?? [];
  const recordSelected = () => {
    if (!selected) return;
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(amount.trim())) { setMessage('Informe o valor com até duas casas decimais.'); return; }
    const cents = Math.round(Number(amount.trim().replace(',', '.')) * 100);
    confirmarAcao(`Registrar ${money(cents)} de ${names.get(selected.from)} para ${names.get(selected.to)} como realizado? Este registro não faz uma transferência bancária.`, () => {
      const error = record(tournament.id, selected.from, selected.to, cents);
      setMessage(error ?? 'Transferência registrada. Saldos restantes atualizados.');
      if (!error) { setSelected(null); setAmount(''); }
    });
  };
  const copy = async () => {
    const text = settlementSummary(tournament, plan);
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(text); setMessage('Acerto copiado para compartilhar.'); }
      else await Share.share({ message: text });
    } catch { setMessage('Não foi possível compartilhar. Selecione e copie o texto abaixo.'); setExpanded(true); }
  };
  return <View style={{ gap: 16, borderTopWidth: 1, borderColor: Colors.borderStrong, paddingTop: 24 }}>
    <KTText papel="subtitulo">Acerto da noite</KTText>
    {plan.error ? <KTText papel="apoio" color={Colors.text1}>{plan.error}</KTText> : <>
      <KTText papel="apoio" color={Colors.text1}>Entradas confirmadas ficam no caixa do organizador. Entradas pendentes são descontadas dos prêmios no acerto.</KTText>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} accessibilityLabel="Todos os acertos realizados estão registrados aqui" onPress={() => setConfirmed(!confirmed)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name={confirmed ? 'checkbox' : 'square-outline'} size={24} color={Colors.gold300} />
        <KTText papel="corpo" style={{ flex: 1 }}>Vou registrar todos os acertos realizados nesta lista</KTText>
      </Pressable>
      {confirmed && <>
        <KTText papel="rotulo" color={Colors.gold200}>Transferências sugeridas · {plan.transfers.length}</KTText>
        {!plan.transfers.length && <KTText>Não há transferências necessárias.</KTText>}
        {plan.transfers.map((x, i) => <View key={`${x.from}-${x.to}`} style={{ borderBottomWidth: 1, borderColor: Colors.border, paddingVertical: 12, gap: 8 }}>
          <KTText papel="corpoForte">{i + 1}. {names.get(x.from)}</KTText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="arrow-forward" size={18} color={Colors.gold300} />
            <KTText style={{ flex: 1 }}>Paga {money(x.cents)} para {names.get(x.to)}</KTText>
          </View>
          <KTButton label="Registrar pagamento" variant="fantasma" onPress={() => { setSelected({ from: x.from, to: x.to }); setAmount((x.cents / 100).toFixed(2).replace('.', ',')); setMessage(''); }} fullWidth />
          {selected?.from === x.from && selected.to === x.to && <View style={{ gap: 12 }}>
            <KTText papel="apoio" color={Colors.text1}>Valor pago (R$) · pode ser parcial</KTText>
            <TextInput accessibilityLabel="Valor da transferência realizada" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={16} style={{ minHeight: 48, padding: 12, fontSize: 16, color: Colors.text0, backgroundColor: Colors.bg1, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 8 }} />
            <KTButton label="Confirmar registro" onPress={recordSelected} fullWidth />
            <KTButton label="Cancelar registro" variant="fantasma" onPress={() => setSelected(null)} fullWidth />
          </View>}
        </View>)}
        <KTButton label={expanded ? 'Ocultar saldos' : 'Conferir saldos e resumo'} variant="fantasma" onPress={() => setExpanded(!expanded)} fullWidth />
        {expanded && <>
          {plan.balances.map(b => <View key={b.id} style={{ gap: 4, paddingVertical: 8 }}>
            <KTText papel="corpoForte">{b.name} · {b.cents > 0 ? 'Recebe' : b.cents < 0 ? 'Paga' : 'Zerado'} {money(b.cents)}</KTText>
            {b.id !== ORGANIZER && <KTText papel="apoio" color={Colors.text2}>Entradas {money(b.entriesCents)} · Já pago {money(b.paidCents)} · Prêmio {money(b.prizeCents)}</KTText>}
          </View>)}
          <KTText selectable papel="apoio" color={Colors.text1}>{settlementSummary(tournament, plan)}</KTText>
        </>}
        <KTButton label={Platform.OS === 'web' ? 'Copiar acerto' : 'Compartilhar acerto'} onPress={copy} fullWidth icone={<Ionicons name="share-outline" size={20} color={Colors.bg0} />} />
        <KTText papel="apoio" color={Colors.text2}>Registre os valores efetivamente pagos. Não marque novamente as entradas como pagas para registrar um acerto. Estes registros não são confirmação bancária.</KTText>
      </>}
    </>}
    {!!payments.length && <View style={{ gap: 12 }}>
      <KTButton label={historyOpen ? 'Ocultar transferências registradas' : `Ver transferências registradas (${payments.length})`} variant="fantasma" onPress={() => setHistoryOpen(!historyOpen)} fullWidth />
      {historyOpen && payments.map(p => <View key={p.id} style={{ gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderColor: Colors.border }}>
        <KTText papel="corpoForte">{names.get(p.from) ?? p.from} → {names.get(p.to) ?? p.to}</KTText>
        <KTText papel="apoio" color={p.voidedAt ? Colors.text2 : Colors.gold200}>{money(p.cents)} · {p.voidedAt ? 'Estornado' : 'Registrado'} · {new Date(p.at).toLocaleString('pt-BR')}</KTText>
        {!p.voidedAt && <KTButton label="Estornar registro" variant="fantasma" onPress={() => confirmarAcao(`Estornar o registro de ${money(p.cents)}? Ele será preservado no histórico e deixará de contar no acerto. Isso não devolve dinheiro nem cancela uma transferência bancária.`, () => { voidPayment(tournament.id, p.id); setMessage('Registro estornado.'); })} fullWidth icone={<Ionicons name="arrow-undo-outline" size={18} color={Colors.text0} />} />}
      </View>)}
    </View>}
    {!!message && <KTText accessibilityLiveRegion="polite" papel="apoio">{message}</KTText>}
  </View>;
}
