import { useEffect, useState } from 'react';
import { View, Pressable, Platform, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Tournament } from '@/types';
import { Colors } from '@/constants/tokens';
import { settlement, settlementSummary, ORGANIZER } from '@/lib/acerto';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';

const money = (cents: number) => (Math.abs(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function NightSettlement({ tournament }: { tournament: Tournament }) {
  const [confirmed, setConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const fingerprint = JSON.stringify([tournament.status, tournament.buyIn, tournament.players]);
  useEffect(() => { setConfirmed(false); setMessage(''); }, [fingerprint]);
  const plan = settlement(tournament);
  const names = new Map(plan.balances.map(b => [b.id, b.name]));
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
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} accessibilityLabel="Confirmo que nenhum prêmio foi pago ainda" onPress={() => setConfirmed(!confirmed)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name={confirmed ? 'checkbox' : 'square-outline'} size={24} color={Colors.gold300} />
        <KTText papel="corpo" style={{ flex: 1 }}>Confirmo que nenhum prêmio foi pago ainda</KTText>
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
        <KTText papel="apoio" color={Colors.text2}>Sugestão de acerto, não comprovante. Não use esta lista se já houve pagamento de prêmios ou acertos parciais.</KTText>
      </>}
    </>}
    {!!message && <KTText accessibilityLiveRegion="polite" papel="apoio">{message}</KTText>}
  </View>;
}
