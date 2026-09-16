import { useMemo } from 'react';
import { ScrollView, View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Space } from '@/constants/tokens';
import { KTScreen } from '@/components/ui/Screen';
import { KTSurface } from '@/components/ui/Surface';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Coroa, Filete, Naipe } from '@/components/ui/Ornamento';
import { useTournamentStore } from '@/stores/tournamentStore';
import { calcularClassificacao } from '@/lib/standings';
import { AccountDetails } from '@/components/AccountDetails';
import { CloudBackup } from '@/components/CloudBackup';

/* Perfil.
 *
 * A versão antiga era um museu de números inventados: 14 torneios, 3 vitórias,
 * +42% de ROI, sequência de 7 dias, seis conquistas com ícone — nada disso
 * saía de dado nenhum. Numa demonstração enche o olho; no uso real, é a
 * primeira tela que denuncia que o app é casca.
 *
 * Agora mostra o que existe de verdade, e diz com franqueza o que ainda não
 * existe. Sem conta criada, não tem histórico pessoal: em vez de fingir, a
 * tela explica o que a conta vai destravar.
 */

/* Forma compacta: numa célula de um terço de tela, "R$ 10.500" não cabe e
   `adjustsFontSizeToFit` encolhe o número até ficar ilegível. Acima de mil,
   abrevia. */
const dinheiro = (v: number) => {
  const a = Math.abs(v);
  const sinal = v < 0 ? '−' : '';
  if (a >= 1000) {
    const mil = a / 1000;
    return `${sinal}${mil.toFixed(mil >= 100 ? 0 : 1).replace('.', ',')} mil`;
  }
  return `${sinal}${a.toLocaleString('pt-BR')}`;
};

export default function Perfil() {
  const tournaments = useTournamentStore((s) => s.tournaments);
  const classificacao = useMemo(() => calcularClassificacao(tournaments), [tournaments]);

  const noites = tournaments.filter((t) => t.status === 'finished').length;
  const abertas = tournaments.filter((t) => t.status !== 'finished').length;
  /* Somas da liga inteira: é o dado honesto que existe sem conta. */
  const jogadores = classificacao.length;
  const movimentado = classificacao.reduce((s, p) => s + p.ganhos, 0);

  return (
    <KTScreen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        {/* ---------------------------------------------------- a insígnia */}
        <View style={styles.insignia}>
          <View style={styles.selo}>
            {/* zIndex negativo: sem ele a camada absoluta cobre o ícone no web. */}
            <LinearGradient
              colors={[Colors.gold700, Colors.gold800]}
              style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
            />
            <View style={styles.seloLuz} />
            <Coroa tamanho={34} cor={Colors.gold100} />
          </View>
          <KTText papel="titulo" color={Colors.gold100} style={{ marginTop: Space.lg }}>
            King&apos;s Table
          </KTText>
          <KTText papel="apoio" color={Colors.text2}>Seu clube privado</KTText>
          <AccountDetails />
          <View style={{ marginTop: Space.lg }}>
            <Filete largura={92} />
          </View>
        </View>

        <CloudBackup />

        {/* -------------------------------------------------- o que existe */}
        <KTSurface nivel="card" padding={0}>
          <View style={styles.grade}>
            <Cel valor={String(noites)} rotulo={noites === 1 ? 'noite' : 'noites'} />
            <View style={styles.div} />
            <Cel valor={String(jogadores)} rotulo={jogadores === 1 ? 'jogador' : 'jogadores'} />
            <View style={styles.div} />
            {/* O "R$" vai para o rótulo: na largura de um terço de tela ele
                roubava espaço do número, que é o que interessa ler. */}
            <Cel valor={dinheiro(movimentado)} rotulo="em prêmios (R$)" />
          </View>
        </KTSurface>

        {abertas ? (
          <Pressable onPress={() => router.push('/(tabs)' as any)}>
            <KTSurface nivel="plana" padding={Space.lg} style={styles.linha}>
              <Naipe tipo="espada" tamanho={15} cor={Colors.gold400} />
              <KTText papel="corpo" color={Colors.text1} style={{ flex: 1 }}>
                {abertas === 1 ? 'Uma mesa aberta' : `${abertas} mesas abertas`}
              </KTText>
              <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
            </KTSurface>
          </Pressable>
        ) : null}

        {/* --------------------------------------------- o que a conta traz */}
        <View>
          <KTText papel="rotulo" color={Colors.text2} style={styles.secao}>Em desenvolvimento</KTText>
          <KTSurface nivel="card" padding={0}>
            {[
              { icone: 'cloud-outline',      titulo: 'A liga em todos os aparelhos', nota: 'Por enquanto, suas mesas ficam salvas neste aparelho' },
              { icone: 'people-outline',     titulo: 'Cada jogador com seu histórico', nota: 'Ranking pessoal, ROI e evolução por temporada' },
              { icone: 'receipt-outline',    titulo: 'Comprovante conferido por IA',  nota: 'Foto do PIX, valor e destinatário confirmados' },
              { icone: 'sparkles-outline',   titulo: 'A Rainha com memória',          nota: 'Análise das suas mãos, não respostas genéricas' },
            ].map((item, i) => (
              <View key={item.titulo} style={[styles.recurso, i > 0 && styles.recursoBorda]}>
                <View style={styles.recursoIcone}>
                  <Ionicons name={item.icone as never} size={17} color={Colors.gold400} />
                </View>
                <View style={{ flex: 1 }}>
                  <KTText papel="corpo" color={Colors.text0}>{item.titulo}</KTText>
                  <KTText papel="apoio" color={Colors.text2}>{item.nota}</KTText>
                </View>
              </View>
            ))}
          </KTSurface>
          <KTButton
            label="Ver minhas mesas"
            onPress={() => router.push('/history' as never)}
            size="lg"
            fullWidth
            style={{ marginTop: Space.lg }}
          />
          <KTText papel="apoio" color={Colors.text3} style={styles.nota}>
            Suas mesas ficam salvas neste aparelho. A sincronização entre
            aparelhos será adicionada em uma próxima etapa.
          </KTText>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </KTScreen>
  );
}

function Cel({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <View style={styles.cel}>
      <KTText papel="numero" size={19} color={Colors.gold200} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </KTText>
      <KTText papel="rotulo" color={Colors.text3} style={{ marginTop: 5 }}>{rotulo}</KTText>
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: Space.xl, paddingTop: Space.xl, gap: Space.xxl },

  insignia: { alignItems: 'center' },
  selo: {
    width: 96, height: 96, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderHot,
  },
  seloLuz: { position: 'absolute', top: 0, left: 18, right: 18, height: 1, backgroundColor: 'rgba(231,208,172,0.4)' },

  grade: { flexDirection: 'row', alignItems: 'stretch' },
  cel: { flex: 1, alignItems: 'center', paddingVertical: Space.xl, paddingHorizontal: Space.sm },
  div: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: Space.lg },

  linha: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  secao: { marginBottom: Space.md },

  recurso: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
  recursoBorda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  recursoIcone: {
    width: 36, height: 36, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg2,
  },
  nota: { textAlign: 'center', marginTop: Space.md, lineHeight: 18 },
});
