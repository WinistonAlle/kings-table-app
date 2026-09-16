import { useState } from 'react';
import { View, Platform, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Tournament } from '@/types';
import { Colors } from '@/constants/tokens';
import { nightSummary, tournamentCsv, exportFilename, type ExportKind } from '@/lib/exportacao';
import { KTButton } from './ui/Button';
import { KTText } from './ui/Text';

export function NightExport({ tournament }: { tournament: Tournament }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const summary = nightSummary(tournament);
  const notify = (text: string, failed = false) => { setMessage(text); setError(failed); };
  const copy = async () => {
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(summary); notify('Resumo copiado.'); }
      else { await Share.share({ message: summary }); }
    } catch { notify('Não foi possível compartilhar. Você pode selecionar e copiar o resumo abaixo.', true); setOpen(true); }
  };
  const whatsapp = async () => {
    const url = `https://wa.me/?text=${encodeURIComponent(summary)}`;
    try {
      if (Platform.OS === 'web') {
        const tab = window.open(url, '_blank', 'noopener,noreferrer');
        // Com noopener, alguns navegadores retornam null mesmo ao abrir a aba.
        void tab;
      } else await Linking.openURL(url);
    } catch { notify('Não foi possível abrir o WhatsApp. Copie o resumo para enviar.', true); }
  };
  const download = (kind: ExportKind) => {
    try {
      const url = URL.createObjectURL(new Blob([tournamentCsv(tournament, kind)], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url; link.download = exportFilename(tournament, kind);
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Arquivo CSV preparado para download.');
    } catch { notify('Não foi possível preparar o arquivo. Tente novamente.', true); }
  };
  return <View style={{ gap: 16, borderTopWidth: 1, borderTopColor: Colors.borderStrong, paddingTop: 24 }}>
    <KTText papel="subtitulo">Resumo e exportação</KTText>
    <KTText papel="apoio" color={Colors.text1}>Entradas, pagamentos e resultados registrados nesta mesa.</KTText>
    <KTButton label={open ? 'Ocultar resumo' : 'Conferir resumo'} variant="fantasma" onPress={() => setOpen(!open)} />
    {open && <KTText selectable color={Colors.text1} style={{ lineHeight: 25 }}>{summary}</KTText>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <KTButton label={Platform.OS === 'web' ? 'Copiar resumo' : 'Compartilhar resumo'} variant="fantasma" disabled={!tournament.players.length} onPress={copy} icone={<Ionicons name="copy-outline" size={18} color={Colors.text0} />} />
      <KTButton label="Enviar no WhatsApp" variant="fantasma" disabled={!tournament.players.length} onPress={whatsapp} icone={<Ionicons name="logo-whatsapp" size={18} color={Colors.ok} />} />
    </View>
    {Platform.OS === 'web' && <View style={{ gap: 12 }}>
      <KTText papel="rotulo" color={Colors.text1}>Exportar CSV</KTText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {([['players', 'Jogadores e pagamentos'], ['blinds', 'Estrutura de blinds'], ['audit', 'Histórico de alterações'], ['settlement', 'Transferências do acerto']] as const).map(([kind, label]) => <KTButton key={kind} label={label} variant="fantasma" onPress={() => download(kind)} icone={<Ionicons name="download-outline" size={18} color={Colors.text0} />} />)}
      </View>
    </View>}
    {!!message && <KTText accessibilityLiveRegion="polite" papel="apoio" color={error ? Colors.danger : Colors.ok}>{message}</KTText>}
  </View>;
}
