import { useMemo, useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Space } from '@/constants/tokens';
import { KTScreen } from '@/components/ui/Screen';
import { KTSurface } from '@/components/ui/Surface';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Coroa, Filete, Naipe } from '@/components/ui/Ornamento';
import { useTournamentStore } from '@/stores/tournamentStore';
import { distribuirPremios, entriesOf, payoutLabel, prizePool } from '@/lib/payouts';
import { emJogo, podeDesfazerEliminacao } from '@/lib/torneio';
import type { TournamentPlayer } from '@/types';
import { semAnelDeFoco } from '@/components/ui/campo';
import { NightPlanning } from '@/components/NightPlanning';
import { vagaParaJogador } from '@/lib/noite';
import { SeatManager } from '@/components/SeatManager';
import { NightAudit } from '@/components/NightAudit';
import { NightExport } from '@/components/NightExport';
import { NightSettlement } from '@/components/NightSettlement';
import { confirmarAcao } from '@/lib/confirmar';
import { lugarJogador } from '@/lib/assentos';

/* A mesa por dentro: quem está jogando, quem caiu, quem pagou e quanto cada um
 * leva.
 *
 * A versão anterior empilhava tudo com o mesmo peso numa coluna só: resumo,
 * premiação, jogadores, e dentro de cada jogador mais quatro controles. Aqui a
 * tela tem três atos, na ordem em que a noite acontece: quem está na mesa,
 * quanto vale, e quem já saiu. O que muda o resultado (eliminar) fica separado
 * por um filete dentro do card — é a única ação que não dá pra fazer sem
 * querer.
 */

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FORMATOS: Record<string, string> = {
  deep: 'Deep stack', regular: 'Regular', turbo: 'Turbo',
  hyper: 'Hyper turbo', rebuy: 'Rebuy', bounty: 'Bounty',
};

const PAGAMENTO = {
  pending:   { texto: 'A receber', cor: Colors.warn },
  confirmed: { texto: 'Pago',      cor: Colors.ok },
  disputed:  { texto: 'Contestado',cor: Colors.danger },
} as const;

const proximoPagamento = (s: TournamentPlayer['paymentStatus']) =>
  s === 'pending' ? 'confirmed' : s === 'confirmed' ? 'disputed' : 'pending';

export default function Mesa() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { tournaments, addPlayer, removePlayer, updatePlayer, setActive, eliminatePlayer, undoElimination } =
    useTournamentStore();
  const [nome, setNome] = useState('');
  const [erroJogador, setErroJogador] = useState('');
  const [confirmacaoJogador, setConfirmacaoJogador] = useState('');
  const [mostrarPremios, setMostrarPremios] = useState(false);

  const torneio = tournaments.find((t) => t.id === id);

  const premiacao = useMemo(() => {
    if (!torneio) return null;
    const bolo = prizePool(torneio);
    return {
      entradas: torneio.players.reduce((s, p) => s + entriesOf(p), 0),
      bolo,
      faixas: distribuirPremios(bolo, torneio.players.length),
      pagos: torneio.players.filter((p) => p.paymentStatus === 'confirmed').length,
    };
  }, [torneio]);

  /* Na mesa primeiro, na ordem em que sentaram; eliminados embaixo, já na
     ordem de classificação. No fim da noite a metade de baixo é o resultado. */
  const { naMesa, caidos } = useMemo(() => {
    if (!torneio) return { naMesa: [], caidos: [] as TournamentPlayer[] };
    return {
      naMesa: torneio.players.filter((p) => !p.position),
      caidos: torneio.players.filter((p) => p.position).sort((a, b) => a.position! - b.position!),
    };
  }, [torneio]);

  if (!torneio || !premiacao) {
    return (
      <KTScreen edges={['top', 'bottom']}>
        <View style={styles.vazio}>
          <Naipe tipo="espada" tamanho={30} cor={Colors.gold500} />
          <KTText papel="titulo" color={Colors.gold100} style={{ marginTop: Space.lg }}>
            Mesa não encontrada
          </KTText>
          <KTButton label="Voltar" variant="fantasma" onPress={() => router.replace('/(tabs)' as any)}
            style={{ marginTop: Space.xl }} />
        </View>
      </KTScreen>
    );
  }

  const encerrado = torneio.status === 'finished' || torneio.status === 'cancelled';
  const campeao = torneio.players.find((p) => p.position === 1);
  const adicionarJogador = () => {
    const limpo = nome.trim();
    if (!limpo) { setErroJogador('Informe o nome do jogador.'); return; }
    if (!vagaParaJogador(torneio, limpo)) { setErroJogador('As vagas estão ocupadas ou reservadas pelos confirmados. Use a lista de espera ou aumente o limite.'); return; }
    if (torneio.players.some(p => p.name.trim().toLocaleLowerCase('pt-BR') === limpo.toLocaleLowerCase('pt-BR'))) { setErroJogador('Já existe um jogador com esse nome. Use um sobrenome para diferenciar.'); return; }
    addPlayer(torneio.id, { userId: `guest_${Date.now()}`, name: limpo, buyIns: 1, reEntries: 0, addOns: 0, paymentStatus: 'pending' });
    setNome(''); setErroJogador(''); setConfirmacaoJogador(`${limpo} entrou na mesa.`);
  };

  return (
    <KTScreen edges={['top']}>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ------------------------------------------------------ cabeçalho */}
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar para mesas" onPress={() => router.replace('/history')} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, minHeight: 44, alignSelf: 'flex-start' }}>
          <Ionicons name="chevron-back" size={19} color={Colors.text1} />
          <KTText color={Colors.text1}>Mesas</KTText>
        </Pressable>
        <View style={styles.topo}>
          <View style={{ flex: 1 }}>
            <KTText papel="rotulo" color={Colors.text1}>{torneio.status === 'cancelled' ? 'Noite cancelada' : encerrado ? 'Resultado da mesa' : torneio.status === 'upcoming' ? 'Noite agendada' : 'Gestão da mesa'}</KTText>
            <KTText papel="apoio" color={Colors.text1}>
              {FORMATOS[torneio.format] ?? torneio.format} · {dinheiro(torneio.buyIn)}
            </KTText>
            <KTText papel="titulo" color={torneio.color ?? Colors.gold100} numberOfLines={2}>{torneio.name}</KTText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atalho para o relógio"
            style={styles.iconeBtn}
            onPress={() => { setActive(torneio.id); router.push(`/blinds/${torneio.id}` as any); }}
            hitSlop={12}
          >
            <Ionicons name="timer-outline" size={19} color={Colors.gold200} />
          </Pressable>
        </View>

        {torneio.status === 'upcoming' && <NightPlanning tournament={torneio} />}
        {!encerrado ? <>
          <KTButton label="Abrir relógio de blinds" size="lg" fullWidth onPress={() => { setActive(torneio.id); router.push(`/blinds/${torneio.id}` as never); }} icone={<Ionicons name="timer-outline" size={22} color={Colors.bg0} />} />
          <View style={{ gap: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Naipe tipo={torneio.suit ?? 'espada'} cor={torneio.color ?? Colors.gold300} tamanho={22} /><KTText papel="subtitulo">{torneio.status === 'upcoming' ? 'Entrada sem convite' : 'Adicionar jogadores'}</KTText></View><KTText papel="apoio" color={Colors.text1}>Cada nome entra com um buy-in de {dinheiro(torneio.buyIn)} e pagamento a receber.</KTText>
            <TextInput accessibilityLabel="Nome do novo jogador" value={nome} onChangeText={value => { setNome(value); setErroJogador(''); setConfirmacaoJogador(''); }} placeholder="Nome e sobrenome" placeholderTextColor={Colors.text2} style={styles.campo} onSubmitEditing={adicionarJogador} returnKeyType="done" maxLength={60} />
            <KTButton label="Adicionar jogador à mesa" onPress={adicionarJogador} disabled={!nome.trim()} variant="fantasma" fullWidth icone={<Ionicons name="person-add-outline" size={18} color={Colors.gold200} />} />
            {erroJogador ? <KTText accessibilityLiveRegion="polite" color={Colors.danger}>{erroJogador}</KTText> : null}
            {confirmacaoJogador ? <KTText accessibilityLiveRegion="polite" color={Colors.ok}>{confirmacaoJogador}</KTText> : null}
          </View>
        </> : null}

        {!encerrado && <SeatManager tournament={torneio} />}
        {!encerrado && <View>
          <View style={styles.secaoTopo}>
            <KTText papel="corpoForte">Jogadores na mesa</KTText>
            <KTText papel="numero" color={Colors.text1}>{naMesa.length}</KTText>
          </View>
          <View style={{ gap: Space.sm }}>
            {naMesa.map((j) => (
              <CardJogador
                key={j.id}
                jogador={j}
                preparando={torneio.status === 'upcoming'}
                emPe={naMesa.length}
                buyIn={torneio.buyIn}
                onPagamento={() => confirmarAcao(`${j.name}: alterar pagamento para ${PAGAMENTO[proximoPagamento(j.paymentStatus)].texto}? Total registrado: ${dinheiro(entriesOf(j) * torneio.buyIn)}.`, () => updatePlayer(torneio.id, j.id, { paymentStatus: proximoPagamento(j.paymentStatus) }))}
                onContador={(campo, d) => confirmarAcao(`${j.name}: ${d > 0 ? 'adicionar' : 'remover'} ${campo === 'reEntries' ? 'uma reentrada' : 'um add-on'} de ${dinheiro(torneio.buyIn)}? O valor total da noite será alterado.`, () => updatePlayer(torneio.id, j.id, { [campo]: Math.max(0, j[campo] + d) }))}
                onEliminar={() => confirmarAcao(naMesa.length === 2 ? `Eliminar ${j.name} em 2º lugar? A noite será encerrada e a premiação será calculada.` : `Eliminar ${j.name} em ${naMesa.length}º lugar?`, () => eliminatePlayer(torneio.id, j.id))}
                onRemover={() => confirmarAcao(`Remover a entrada de ${j.name}? O buy-in e seu registro de pagamento serão removidos desta noite.`, () => removePlayer(torneio.id, j.id))}
              />
            ))}
            {naMesa.length === 0 && !encerrado && <KTText papel="apoio" color={Colors.text1} style={styles.dica}>Nenhum jogador adicionado</KTText>}
          </View>
        </View>}

        {/* ---------------------------------------------------- o resumo */}
        <KTSurface nivel="card" padding={0} destaque={encerrado}>
          {encerrado && campeao ? (
            <View style={styles.campeao}>
              <Coroa tamanho={26} cor={Colors.gold100} />
              <View style={{ flex: 1 }}>
                <KTText papel="rotulo" color={Colors.gold500}>Campeão da noite</KTText>
                <KTText papel="subtitulo" color={Colors.gold100}>{campeao.name}</KTText>
              </View>
              <KTText papel="numeroForte" color={Colors.gold200}>{dinheiro(campeao.prize ?? 0)}</KTText>
            </View>
          ) : null}

          <View style={styles.grade}>
            <Cel rotulo="Bolo" valor={dinheiro(premiacao.bolo)} nota={`${premiacao.entradas} entradas`} />
            <View style={styles.colDiv} />
            <Cel
              rotulo={encerrado ? 'Jogadores' : 'De pé'}
              valor={encerrado ? String(torneio.players.length) : `${naMesa.length}/${torneio.players.length}`}
              nota={encerrado ? 'no total' : 'ainda na mesa'}
            />
            <View style={styles.colDiv} />
            <Cel rotulo="Pagos" valor={`${premiacao.pagos}/${torneio.players.length}`} nota="buy-ins" />
          </View>
        </KTSurface>

        {/* -------------------------------------------------- a premiação */}
        <View>
          <View style={styles.secaoTopo}>
            <KTText papel="rotulo" color={Colors.text2}>Premiação</KTText>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: mostrarPremios }} onPress={() => setMostrarPremios(!mostrarPremios)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44 }}><KTText papel="apoio" color={Colors.gold300}>{mostrarPremios ? 'Recolher' : 'Ver distribuição'}</KTText><Ionicons name={mostrarPremios ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gold300} /></Pressable>
          </View>
          {mostrarPremios || encerrado ? <KTSurface nivel="card" padding={0}>
            {premiacao.faixas.map((f, i) => {
              const dono = torneio.players.find((p) => p.position === f.place);
              return (
                <View key={f.place} style={[styles.faixa, i > 0 && styles.faixaBorda]}>
                  <View style={[styles.lugar, f.place === 1 && styles.lugarRei]}>
                    <KTText papel="numero" size={12} color={f.place === 1 ? Colors.gold100 : Colors.text2}>
                      {f.place}º
                    </KTText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <KTText papel="corpo" color={dono ? Colors.text0 : Colors.text3}>
                      {dono ? dono.name : 'em disputa'}
                    </KTText>
                    <KTText papel="apoio" color={Colors.text3}>{f.percent}% do bolo</KTText>
                  </View>
                  <KTText papel="numero" size={16} color={f.place === 1 ? Colors.gold200 : Colors.text1}>
                    {dinheiro(f.amount)}
                  </KTText>
                </View>
              );
            })}
          </KTSurface> : null}
        </View>

        {/* -------------------------------------------------- já caíram */}
        {caidos.length ? (
          <View>
            <View style={styles.secaoTopo}>
              <KTText papel="rotulo" color={Colors.text2}>
                {encerrado ? 'Resultado' : 'Já saíram'}
              </KTText>
              <KTText papel="rotulo" color={Colors.text3}>{caidos.length}</KTText>
            </View>
            <View style={{ gap: Space.sm }}>
              {caidos.map((j) => (
                <KTSurface key={j.id} nivel="plana" padding={Space.lg} style={styles.caido}>
                  <View style={[styles.lugar, j.position === 1 && styles.lugarRei]}>
                    <KTText papel="numero" size={12} color={j.position === 1 ? Colors.gold100 : Colors.text2}>
                      {j.position}º
                    </KTText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <KTText papel="corpo" color={Colors.text1}>{j.name}</KTText>
                    <KTText papel="apoio" color={Colors.text3}>
                      {j.prize ? dinheiro(j.prize) : 'fora do ITM'}
                    </KTText>
                  </View>
                  {podeDesfazerEliminacao(torneio, j.id) && <Pressable accessibilityRole="button" accessibilityLabel={`Desfazer eliminação de ${j.name}`} style={styles.desfazer} onPress={() => confirmarAcao(`Desfazer eliminação de ${j.name}?${encerrado ? ' A noite será reaberta e os prêmios finais serão recalculados ao encerrar novamente.' : ''}`, () => undoElimination(torneio.id, j.id))} hitSlop={8}>
                    <Ionicons name="arrow-undo" size={13} color={Colors.text2} />
                    <KTText papel="rotulo" color={Colors.text2}>Desfazer</KTText>
                  </Pressable>}
                </KTSurface>
              ))}
            </View>
          </View>
        ) : null}

        <NightAudit tournament={torneio} />
        <NightSettlement tournament={torneio} />
        <NightExport tournament={torneio} />
        <View style={styles.rodapeOrn}>
          <Filete largura={100} />
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>
    </KTScreen>
  );
}

/* --------------------------------------------------------------- peças */

function Cel({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) {
  return (
    <View style={styles.cel}>
      <KTText papel="rotulo" color={Colors.text3}>{rotulo}</KTText>
      <KTText papel="numero" size={18} color={Colors.text0} style={{ marginTop: 4 }}>{valor}</KTText>
      <KTText papel="apoio" color={Colors.text3} style={{ marginTop: 1 }}>{nota}</KTText>
    </View>
  );
}

function CardJogador({
  jogador, emPe, buyIn, onPagamento, onContador, onEliminar, onRemover, preparando,
}: {
  jogador: TournamentPlayer;
  preparando?: boolean;
  emPe: number;
  buyIn: number;
  onPagamento: () => void;
  onContador: (campo: 'reEntries' | 'addOns', delta: number) => void;
  onEliminar: () => void;
  onRemover: () => void;
}) {
  const pago = PAGAMENTO[jogador.paymentStatus];
  const devido = entriesOf(jogador) * buyIn;
  const ultimo = emPe <= 1;

  return (
    <KTSurface nivel="card" padding={Space.lg}>
      <View style={styles.jogadorTopo}>
        <View style={{ flex: 1 }}>
          <KTText papel="corpoForte" color={Colors.text0}>{jogador.name}</KTText>
          <KTText papel="apoio" color={Colors.gold200}>{lugarJogador(jogador)}</KTText>
          <KTText papel="apoio" color={Colors.text2}>
            {entriesOf(jogador)} {entriesOf(jogador) === 1 ? 'entrada' : 'entradas'} · {dinheiro(devido)}
          </KTText>
        </View>
        <View style={[styles.selo, { borderColor: `${pago.cor}55` }]}>
          <View style={[styles.seloPonto, { backgroundColor: pago.cor }]} />
          <KTText papel="rotulo" color={pago.cor}>{pago.texto}</KTText>
        </View>
      </View>

      <View style={styles.contadores}>
        <Contador rotulo="Reentrada" jogador={jogador.name} valor={jogador.reEntries}
          onMenos={() => onContador('reEntries', -1)} onMais={() => onContador('reEntries', 1)} />
        <Contador rotulo="Add-on" jogador={jogador.name} valor={jogador.addOns}
          onMenos={() => onContador('addOns', -1)} onMais={() => onContador('addOns', 1)} />
      </View>

      <KTButton label={jogador.paymentStatus === 'pending' ? 'Confirmar pagamento' : jogador.paymentStatus === 'confirmed' ? 'Contestar pagamento' : 'Marcar como pendente'} fullWidth variant="fantasma" size="sm" onPress={onPagamento} icone={<Ionicons name="wallet-outline" size={16} color={Colors.gold200} />} style={{ marginTop: Space.md }} />

      {/* A ação que muda o resultado, separada por um filete. */}
      <View style={styles.acaoLinha}>
        <KTText papel="apoio" color={Colors.text3} style={{ flex: 1 }}>
          {preparando ? 'Entrada registrada' : ultimo ? 'Último de pé' : `Cai agora em ${emPe}º`}
        </KTText>
        {jogador.buyIns + jogador.reEntries + jogador.addOns === 1 && (ultimo || preparando) ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Remover entrada de ${jogador.name}`} onPress={onRemover} style={styles.removerBtn} hitSlop={6}>
            <KTText papel="rotulo" color={Colors.text2}>Remover</KTText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Eliminar ${jogador.name}`}
          onPress={onEliminar}
          disabled={ultimo || preparando}
          style={[styles.eliminarBtn, (ultimo || preparando) && { opacity: 0.3 }]}
          hitSlop={6}
        >
          <KTText papel="rotulo" color={Colors.red}>Eliminar</KTText>
        </Pressable>
      </View>
    </KTSurface>
  );
}

function Contador({ rotulo, jogador, valor, onMenos, onMais }: {
  rotulo: string; jogador: string; valor: number; onMenos: () => void; onMais: () => void;
}) {
  return (
    <View style={styles.contador}>
      <KTText papel="rotulo" color={Colors.text1}>{rotulo}</KTText>
      <View style={styles.contadorBotoes}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Diminuir ${rotulo.toLowerCase()} de ${jogador}`} onPress={onMenos} disabled={valor === 0} style={[styles.passoBtn, valor === 0 && { opacity: 0.4 }]} hitSlop={4}>
          <Ionicons name="remove" size={15} color={Colors.text2} />
        </Pressable>
        <KTText papel="numero" size={15} color={valor > 0 ? Colors.gold200 : Colors.text2} style={styles.contadorValor}>
          {valor}
        </KTText>
        <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar ${rotulo.toLowerCase()} de ${jogador}`} onPress={onMais} style={styles.passoBtn} hitSlop={4}>
          <Ionicons name="add" size={15} color={Colors.text2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: Space.xl, paddingTop: Space.md, gap: Space.xl, paddingBottom: Space.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xxl },

  topo: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  iconeBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg1,
  },

  campeao: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    padding: Space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  grade: { flexDirection: 'row', alignItems: 'stretch' },
  cel: { flex: 1, alignItems: 'center', paddingVertical: Space.lg },
  colDiv: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: Space.md },

  secaoTopo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Space.md,
  },

  faixa: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
  faixaBorda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  lugar: {
    width: 34, height: 34, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg2,
  },
  lugarRei: { borderColor: Colors.borderHot, backgroundColor: Colors.gold800 },

  adicionar: { flexDirection: 'row', gap: Space.sm, marginBottom: Space.lg },
  campo: {
    height: 50, borderRadius: Radius.sm, paddingHorizontal: Space.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    backgroundColor: Colors.bg1, color: Colors.text0,
    fontFamily: 'InterTight_400Regular', fontSize: 15,
  },
  adicionarBtn: {
    width: 48, height: 48, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderStrong, backgroundColor: Colors.bg2,
  },
  dica: { textAlign: 'center', paddingVertical: Space.lg },

  jogadorTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  selo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Space.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth,
  },
  seloPonto: { width: 5, height: 5, borderRadius: 3 },

  contadores: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md, marginTop: Space.lg },
  contador: {
    flex: 1, minWidth: 140, gap: 6, paddingVertical: Space.md, paddingHorizontal: Space.md,
    borderRadius: Radius.md, backgroundColor: 'rgba(255,250,235,0.022)',
  },
  contadorBotoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contadorValor: { minWidth: 20, textAlign: 'center' },
  passoBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },

  acaoLinha: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    marginTop: Space.lg, paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  eliminarBtn: {
    paddingHorizontal: Space.lg, paddingVertical: Space.sm,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(200,90,90,0.35)',
  },
  removerBtn: {
    paddingHorizontal: Space.md, paddingVertical: Space.sm,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },

  caido: { flexDirection: 'row', alignItems: 'center', gap: Space.md, opacity: 0.78 },
  desfazer: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  rodapeOrn: { alignItems: 'center' },
});
