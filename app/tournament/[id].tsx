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
import { emJogo } from '@/lib/torneio';
import type { TournamentPlayer } from '@/types';
import { semAnelDeFoco } from '@/components/ui/campo';

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

const dinheiro = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

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

  const encerrado = torneio.status === 'finished';
  const campeao = torneio.players.find((p) => p.position === 1);
  const adicionarJogador = () => {
    const limpo = nome.trim();
    if (!limpo) { setErroJogador('Informe o nome do jogador.'); return; }
    if (torneio.players.some(p => p.name.trim().toLocaleLowerCase('pt-BR') === limpo.toLocaleLowerCase('pt-BR'))) { setErroJogador('Já existe um jogador com esse nome. Use um sobrenome para diferenciar.'); return; }
    addPlayer(torneio.id, { userId: `guest_${Date.now()}`, name: limpo, buyIns: 1, reEntries: 0, addOns: 0, paymentStatus: 'pending' });
    setNome(''); setErroJogador('');
  };

  return (
    <KTScreen edges={['top']}>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ------------------------------------------------------ cabeçalho */}
        <View style={styles.topo}>
          <Pressable style={styles.iconeBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={19} color={Colors.text1} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <KTText papel="rotulo" color={Colors.gold500}>
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

        {!encerrado ? <>
          <KTButton label="Abrir relógio de blinds" size="lg" fullWidth onPress={() => { setActive(torneio.id); router.push(`/blinds/${torneio.id}` as never); }} icone={<Ionicons name="timer-outline" size={22} color={Colors.bg0} />} />
          <View style={{ gap: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Naipe tipo={torneio.suit ?? 'espada'} cor={torneio.color ?? Colors.gold300} tamanho={22} /><KTText papel="subtitulo">Adicionar jogadores</KTText></View><KTText papel="apoio" color={Colors.text1}>Cada nome entra com um buy-in de {dinheiro(torneio.buyIn)} e pagamento a receber.</KTText>
            <TextInput accessibilityLabel="Nome do novo jogador" value={nome} onChangeText={value => { setNome(value); setErroJogador(''); }} placeholder="Nome e sobrenome" placeholderTextColor={Colors.text2} style={styles.campo} onSubmitEditing={adicionarJogador} returnKeyType="done" maxLength={60} />
            <KTButton label="Adicionar jogador à mesa" onPress={adicionarJogador} disabled={!nome.trim()} variant="fantasma" fullWidth icone={<Ionicons name="person-add-outline" size={18} color={Colors.gold200} />} />
            {erroJogador ? <KTText accessibilityLiveRegion="polite" color={Colors.danger}>{erroJogador}</KTText> : null}
          </View>
        </> : null}

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

        {/* -------------------------------------------------- na mesa */}
        <View>
          <View style={styles.secaoTopo}>
            <KTText papel="rotulo" color={Colors.text2}>Na mesa</KTText>
            <KTText papel="rotulo" color={Colors.text3}>{naMesa.length}</KTText>
          </View>

          <View style={{ gap: Space.sm }}>
            {naMesa.map((j) => (
              <CardJogador
                key={j.id}
                jogador={j}
                emPe={naMesa.length}
                buyIn={torneio.buyIn}
                onPagamento={() => updatePlayer(torneio.id, j.id, { paymentStatus: proximoPagamento(j.paymentStatus) })}
                onContador={(campo, d) =>
                  updatePlayer(torneio.id, j.id, { [campo]: Math.max(0, j[campo] + d) })
                }
                onEliminar={() => eliminatePlayer(torneio.id, j.id)}
                onRemover={() => removePlayer(torneio.id, j.id)}
              />
            ))}
            {naMesa.length === 0 && !encerrado ? (
              <KTText papel="apoio" color={Colors.text3} style={styles.dica}>
                Ninguém sentou ainda. Escreva um nome acima para começar.
              </KTText>
            ) : null}
          </View>
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
                  <Pressable style={styles.desfazer} onPress={() => undoElimination(torneio.id, j.id)} hitSlop={8}>
                    <Ionicons name="arrow-undo" size={13} color={Colors.text2} />
                    <KTText papel="rotulo" color={Colors.text2}>Desfazer</KTText>
                  </Pressable>
                </KTSurface>
              ))}
            </View>
          </View>
        ) : null}

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
  jogador, emPe, buyIn, onPagamento, onContador, onEliminar, onRemover,
}: {
  jogador: TournamentPlayer;
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
          <KTText papel="apoio" color={Colors.text2}>
            {entriesOf(jogador)} {entriesOf(jogador) === 1 ? 'entrada' : 'entradas'} · {dinheiro(devido)}
          </KTText>
        </View>
        <Pressable onPress={onPagamento} style={[styles.selo, { borderColor: `${pago.cor}55` }]} hitSlop={6}>
          <View style={[styles.seloPonto, { backgroundColor: pago.cor }]} />
          <KTText papel="rotulo" color={pago.cor}>{pago.texto}</KTText>
        </Pressable>
      </View>

      <View style={styles.contadores}>
        <Contador rotulo="Reentrada" valor={jogador.reEntries}
          onMenos={() => onContador('reEntries', -1)} onMais={() => onContador('reEntries', 1)} />
        <Contador rotulo="Add-on" valor={jogador.addOns}
          onMenos={() => onContador('addOns', -1)} onMais={() => onContador('addOns', 1)} />
      </View>

      {/* A ação que muda o resultado, separada por um filete. */}
      <View style={styles.acaoLinha}>
        <KTText papel="apoio" color={Colors.text3} style={{ flex: 1 }}>
          {ultimo ? 'Último de pé' : `Cai agora em ${emPe}º`}
        </KTText>
        {jogador.buyIns + jogador.reEntries + jogador.addOns === 1 && ultimo ? (
          <Pressable onPress={onRemover} style={styles.removerBtn} hitSlop={6}>
            <KTText papel="rotulo" color={Colors.text2}>Remover</KTText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onEliminar}
          disabled={ultimo}
          style={[styles.eliminarBtn, ultimo && { opacity: 0.3 }]}
          hitSlop={6}
        >
          <KTText papel="rotulo" color={Colors.red}>Eliminar</KTText>
        </Pressable>
      </View>
    </KTSurface>
  );
}

function Contador({ rotulo, valor, onMenos, onMais }: {
  rotulo: string; valor: number; onMenos: () => void; onMais: () => void;
}) {
  return (
    <View style={styles.contador}>
      <KTText papel="rotulo" color={Colors.text3}>{rotulo}</KTText>
      <View style={styles.contadorBotoes}>
        <Pressable onPress={onMenos} style={styles.passoBtn} hitSlop={8}>
          <Ionicons name="remove" size={15} color={Colors.text2} />
        </Pressable>
        <KTText papel="numero" size={15} color={valor > 0 ? Colors.gold200 : Colors.text2} style={styles.contadorValor}>
          {valor}
        </KTText>
        <Pressable onPress={onMais} style={styles.passoBtn} hitSlop={8}>
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

  contadores: { flexDirection: 'row', gap: Space.md, marginTop: Space.lg },
  contador: {
    flex: 1, gap: 6, paddingVertical: Space.md, paddingHorizontal: Space.md,
    borderRadius: Radius.md, backgroundColor: 'rgba(255,250,235,0.022)',
  },
  contadorBotoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contadorValor: { minWidth: 20, textAlign: 'center' },
  passoBtn: {
    width: 28, height: 28, borderRadius: Radius.full,
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
