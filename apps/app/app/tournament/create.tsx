import { useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Space } from '@/constants/tokens';
import { KTScreen } from '@/components/ui/Screen';
import { KTSurface } from '@/components/ui/Surface';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Naipe } from '@/components/ui/Ornamento';
import { useTournamentStore } from '@/stores/tournamentStore';
import { useBlindsStore, BLIND_PRESETS } from '@/stores/blindsStore';
import type { TournamentFormat } from '@/types';
import { semAnelDeFoco } from '@/components/ui/campo';
import { StructureEditor } from '@/components/StructureEditor';
import { usePresetsStore } from '@/stores/presetsStore';
import { normalizarEstrutura, validarEstrutura, valorBuyIn } from '@/lib/estrutura';
import type { BlindLevel } from '@/types';
import { dataAgendada } from '@/lib/noite';

/* Abrir a mesa.
 *
 * Eram quatro passos com bolinhas numeradas no topo — padrão de formulário de
 * banco. Uma mesa de home game tem três decisões de verdade: como se chama,
 * quanto custa entrar e com que velocidade os blinds sobem. O resto pode ter
 * padrão bom e ser mudado depois.
 *
 * Então virou uma tela única, rolável, com as três decisões em sequência. Sem
 * passo, sem "próximo", sem perder o que escreveu ao voltar. O botão só acende
 * quando dá pra abrir.
 */

const FORMATOS: { valor: TournamentFormat; nome: string; nota: string; minutos: number }[] = [
  { valor: 'deep',    nome: 'Deep stack', nota: 'Níveis de 30 min. Noite longa, jogo de verdade.', minutos: 30 },
  { valor: 'regular', nome: 'Regular',    nota: 'Níveis de 20 min. O equilíbrio de sempre.',       minutos: 20 },
  { valor: 'turbo',   nome: 'Turbo',      nota: 'Níveis de 10 min. Pra acabar antes de tarde.',    minutos: 10 },
  { valor: 'hyper',   nome: 'Hyper',      nota: 'Níveis de 5 min. Uma partida mais rápida.',    minutos: 5 },
];

const NAIPES = ['espada', 'copas', 'ouros', 'paus'] as const;
const CORES = [Colors.gold300, '#78a885', '#8ab8d9', '#d98e9e', '#b39bd1'] as const;

export default function AbrirMesa() {
  const { createTournament, setActive, startTournament } = useTournamentStore();
  const { selectTournament } = useBlindsStore();

  const [nome, setNome] = useState('');
  const [agendar, setAgendar] = useState(false);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('20:00');
  const [local, setLocal] = useState('');
  const [vagas, setVagas] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [formato, setFormato] = useState<TournamentFormat>('regular');
  const [reentrada, setReentrada] = useState(true);
  const [naipe, setNaipe] = useState<(typeof NAIPES)[number]>('espada');
  const [cor, setCor] = useState<string>(Colors.gold300);
  const [levels, setLevels] = useState<BlindLevel[]>(BLIND_PRESETS.regular.map(n => ({ ...n })));
  const [editar, setEditar] = useState(false);
  const [nomePreset, setNomePreset] = useState('');
  const [aviso, setAviso] = useState('');
  const { presets, save, remove } = usePresetsStore();

  const valor = valorBuyIn(buyIn);
  const erroEstrutura = validarEstrutura(levels);
  const inicio = agendar ? dataAgendada(data, hora) : new Date().toISOString();
  const capacidade = vagas.trim() ? Number(vagas) : undefined;
  const erroAgenda = agendar && !inicio ? 'Informe uma data futura (DD/MM/AAAA) e horário (HH:MM).' : capacidade !== undefined && (!Number.isInteger(capacidade) || capacidade < 2 || capacidade > 1000) ? 'Escolha entre 2 e 1.000 vagas, ou deixe sem limite.' : '';
  const podeAbrir = nome.trim().length > 0 && valor > 0 && !erroEstrutura && !erroAgenda;

  const abrir = () => {
    if (!podeAbrir) return;
    const estrutura = normalizarEstrutura(levels);
    const t = createTournament({
      name: nome.trim(),
      suit: naipe,
      color: cor,
      format: formato,
      buyIn: valor,
      reEntryAllowed: reentrada,
      maxReEntries: reentrada ? 2 : 0,
      startTime: inicio!,
      location: local.trim(),
      capacity: capacidade,
      invitees: [],
      blindStructure: estrutura,
      createdBy: 'me',
    });
    selectTournament(t.id, estrutura);
    setActive(t.id);
    if (!agendar) startTournament(t.id);
    router.replace(`/tournament/${t.id}` as never);
  };

  return (
    <KTScreen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topo}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar criação da mesa" style={styles.iconeBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/history')} hitSlop={12}>
            <Ionicons name="close" size={19} color={Colors.text1} />
          </Pressable>
          <KTText papel="subtitulo">Criar mesa</KTText>
          <View style={styles.iconeBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* -------------------------------------------------------- nome */}
          <View style={styles.abertura}>
            <KTText papel="rotulo" color={Colors.text1}>Nome da mesa</KTText>
            <TextInput
              accessibilityLabel="Nome da mesa"
              value={nome}
              onChangeText={setNome}
              placeholder="Quarta da Realeza"
              placeholderTextColor={Colors.text2}
              style={[styles.campoNome, semAnelDeFoco]}
              maxLength={60}
              returnKeyType="done"
            />
          </View>

          <View style={{ gap: Space.md }}>
            <KTText papel="rotulo" color={Colors.text1}>Quando vamos jogar?</KTText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[false, true].map(v => <Pressable key={String(v)} accessibilityRole="radio" accessibilityState={{ checked: agendar === v }} onPress={() => setAgendar(v)} style={[styles.atalho, agendar === v && styles.atalhoAtivo]}><KTText color={agendar === v ? Colors.gold100 : Colors.text1}>{v ? 'Agendar noite' : 'Jogar agora'}</KTText></Pressable>)}
            </View>
            {agendar && <>
              <KTText papel="apoio" color={Colors.text1}>Data e horário local</KTText>
              <TextInput accessibilityLabel="Data da noite" value={data} onChangeText={setData} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.text2} maxLength={10} style={styles.campoNome} />
              <TextInput accessibilityLabel="Horário da noite" value={hora} onChangeText={setHora} placeholder="HH:MM" placeholderTextColor={Colors.text2} maxLength={5} style={styles.campoNome} />
            </>}
            <KTText papel="apoio" color={Colors.text1}>Local (opcional)</KTText>
            <TextInput accessibilityLabel="Local da noite" value={local} onChangeText={setLocal} placeholder="Casa do anfitrião ou clube" placeholderTextColor={Colors.text2} maxLength={120} style={styles.campoNome} />
            <KTText papel="apoio" color={Colors.text1}>Vagas (opcional)</KTText>
            <TextInput accessibilityLabel="Limite de vagas" value={vagas} onChangeText={setVagas} placeholder="Sem limite" placeholderTextColor={Colors.text2} keyboardType="number-pad" maxLength={4} style={styles.campoNome} />
            {!!erroAgenda && <KTText color={Colors.danger}>{erroAgenda}</KTText>}
          </View>

          {/* Marca da mesa: escolha pequena, e é a que dá identidade ao card
              depois. Fica junto do nome porque as duas coisas são a mesma
              pergunta. */}
          <View style={{ gap: Space.md }}>
          <KTText papel="rotulo" color={Colors.text1}>Identidade da mesa</KTText>
          <KTText papel="apoio" color={Colors.text1}>Naipe</KTText>
          <View style={styles.naipes}>
            {NAIPES.map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={`Naipe ${n}`}
                accessibilityState={{ selected: naipe === n }}
                onPress={() => setNaipe(n)}
                style={[styles.naipeBtn, naipe === n && styles.naipeBtnAtivo]}
                hitSlop={6}
              >
                <Naipe tipo={n} tamanho={18} cor={naipe === n ? Colors.gold100 : Colors.text3} />
              </Pressable>
            ))}
          </View>
          <KTText papel="apoio" color={Colors.text1}>Cor</KTText>
          <View style={styles.naipes}>{CORES.map(c => <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Cor ${c}`} accessibilityState={{ selected: c === cor }} onPress={() => setCor(c)} style={[styles.naipeBtn, { borderColor: cor === c ? c : Colors.borderStrong }]}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c }} />{cor === c ? <Ionicons name="checkmark" size={14} color={Colors.bg0} style={{ position: 'absolute' }} /> : null}</Pressable>)}</View>
          </View>

          {/* ------------------------------------------------------ buy-in */}
          <View>
            <KTText papel="rotulo" color={Colors.text1} style={styles.secao}>Valor de entrada (buy-in)</KTText>
            <KTSurface nivel="card" padding={Space.lg}>
              <View style={styles.linhaValor}>
                <KTText papel="subtitulo" color={Colors.text2}>R$</KTText>
                <TextInput
                  value={buyIn}
                  onChangeText={setBuyIn}
                  placeholder="0,00"
                  placeholderTextColor={Colors.text2}
                  accessibilityLabel="Valor do buy-in em reais"
                  keyboardType="decimal-pad"
                  style={[styles.campoValor, semAnelDeFoco]}
                  maxLength={10}
                />
              </View>
              <View style={styles.atalhos}>
                {[25, 50, 100, 200].map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setBuyIn(String(v))}
                    style={[styles.atalho, valor === v && styles.atalhoAtivo]}
                  >
                    <KTText papel="numero" size={13} color={valor === v ? Colors.gold100 : Colors.text2}>
                      {v}
                    </KTText>
                  </Pressable>
                ))}
              </View>
            </KTSurface>
          </View>

          {/* ----------------------------------------------------- formato */}
          <View>
            <KTText papel="rotulo" color={Colors.text2} style={styles.secao}>Ritmo dos blinds</KTText>
            <View style={{ gap: Space.sm }}>
              {FORMATOS.map((f) => {
                const ativo = formato === f.valor && !editar;
                return (
                  <Pressable key={f.valor} accessibilityRole="button" accessibilityState={{ selected: formato === f.valor && !editar }} onPress={() => { setFormato(f.valor); setLevels(BLIND_PRESETS[f.valor].map(n => ({ ...n }))); setEditar(false); setAviso(''); }}>
                    <KTSurface nivel={ativo ? 'card' : 'plana'} destaque={ativo} padding={Space.lg} style={styles.formato}>
                      <View style={[styles.radio, ativo && styles.radioAtivo]}>
                        {ativo ? <View style={styles.radioMiolo} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <KTText papel="corpoForte" color={ativo ? Colors.gold100 : Colors.text1}>{f.nome}</KTText>
                        <KTText papel="apoio" color={Colors.text2}>{f.nota}</KTText>
                      </View>
                      <KTText papel="numero" size={13} color={ativo ? Colors.gold300 : Colors.text3}>
                        {f.minutos}min
                      </KTText>
                    </KTSurface>
                  </Pressable>
                );
              })}
            </View>
            {presets.length ? <View style={{ marginTop: 24, gap: 12 }}><KTText papel="rotulo" color={Colors.text1}>Minhas estruturas</KTText>{presets.map(p => <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><KTButton label={p.name} variant="fantasma" onPress={() => { setLevels(p.levels.map(n => ({ ...n }))); setEditar(true); setAviso(''); }} style={{ flex: 1 }} /><Pressable accessibilityRole="button" accessibilityLabel={`Excluir estrutura ${p.name}`} onPress={() => remove(p.id)} style={styles.iconeBtn}><Ionicons name="trash-outline" size={18} color={Colors.danger} /></Pressable></View>)}</View> : null}
            <KTButton label={editar ? 'Fechar editor de blinds' : 'Personalizar blinds e intervalos'} variant="fantasma" onPress={() => setEditar(!editar)} style={{ marginTop: 20 }} icone={<Ionicons name="options-outline" size={18} color={Colors.gold200} />} />
            <KTButton label="Criar estrutura do zero" variant="fantasma" onPress={() => { setLevels([]); setEditar(true); setAviso(''); }} style={{ marginTop: 12 }} />
            <KTText papel="apoio" color={Colors.text1} style={{ marginTop: 12 }}>{levels.filter(n => !n.isBreak).length} níveis · {levels.filter(n => n.isBreak).length} intervalos · {levels.reduce((total, n) => total + (n.durationMinutes || 0), 0)} min</KTText>
            {editar ? <View style={{ marginTop: 16, gap: 16 }}><StructureEditor levels={levels} onChange={setLevels} /><TextInput accessibilityLabel="Nome da estrutura para salvar" placeholder="Nome da sua estrutura" placeholderTextColor={Colors.text2} value={nomePreset} onChangeText={setNomePreset} style={[styles.campoNome, { textAlign: 'left', fontSize: 16 }]} /><KTButton label="Salvar estrutura para outras mesas" variant="fantasma" disabled={!nomePreset.trim() || !!erroEstrutura} onPress={() => { if (save(nomePreset, levels)) { setAviso('Estrutura salva neste aparelho.'); setNomePreset(''); } }} /><KTText papel="apoio" color={Colors.text1}>Você também pode usar esta estrutura só nesta mesa, sem salvar.</KTText></View> : null}
            {erroEstrutura ? <KTText color={Colors.danger} style={{ marginTop: 12 }}>{erroEstrutura}</KTText> : null}
            {aviso ? <KTText accessibilityLiveRegion="polite" color={Colors.ok} style={{ marginTop: 12 }}>{aviso}</KTText> : null}
          </View>

          {/* --------------------------------------------------- reentrada */}
          <Pressable accessibilityRole="switch" accessibilityLabel="Permitir reentrada" accessibilityState={{ checked: reentrada }} onPress={() => setReentrada((v) => !v)}>
            <KTSurface nivel="plana" padding={Space.lg} style={styles.formato}>
              <View style={{ flex: 1 }}>
                <KTText papel="corpoForte" color={Colors.text1}>Permitir reentrada</KTText>
                <KTText papel="apoio" color={Colors.text2}>
                  Quem quebra pode comprar de novo, até duas vezes
                </KTText>
              </View>
              <View style={[styles.chave, reentrada && styles.chaveAtiva]}>
                <View style={[styles.chaveBola, reentrada && styles.chaveBolaAtiva]} />
              </View>
            </KTSurface>
          </Pressable>

          <View style={{ height: Space.xxl }} />
        </ScrollView>

        {/* Barra fixa: o botão fica sempre ao alcance do polegar, não no fim de
            uma rolagem. */}
        <View style={styles.barra}>
          {!podeAbrir && <KTText papel="apoio" color={Colors.text1} style={{ marginBottom: Space.sm }}>
            {!nome.trim() ? 'Nome da mesa obrigatório' : valor <= 0 ? 'Buy-in deve ser maior que zero' : erroAgenda || 'Confira a estrutura de blinds'}
          </KTText>}
          <KTButton
            label={agendar ? 'Agendar noite' : 'Criar mesa'}
            onPress={abrir}
            disabled={!podeAbrir}
            size="lg"
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </KTScreen>
  );
}

const styles = StyleSheet.create({
  topo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.xl, paddingVertical: Space.md, maxWidth: 760, width: '100%', alignSelf: 'center',
  },
  iconeBtn: {
    width: 44, height: 44, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg1,
  },
  conteudo: { paddingHorizontal: Space.xl, gap: Space.xxl, width: '100%', maxWidth: 760, alignSelf: 'center' },

  abertura: { gap: Space.md, paddingTop: Space.lg },
  campoNome: {
    width: '100%', textAlign: 'left',
    fontFamily: Fonts.ui, fontSize: 18, color: Colors.text0,
    paddingVertical: Space.lg, paddingHorizontal: Space.lg,
    borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.sm, backgroundColor: Colors.bg1,
  },
  naipes: { flexDirection: 'row', gap: Space.md },
  naipeBtn: {
    width: 44, height: 44, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  naipeBtnAtivo: { borderColor: Colors.borderHot, backgroundColor: Colors.gold800 },

  secao: { marginBottom: Space.md },
  linhaValor: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  campoValor: {
    flex: 1, fontFamily: 'DMMono_500Medium', fontSize: 34, color: Colors.gold100, padding: 0,
  },
  atalhos: { flexDirection: 'row', gap: Space.sm, marginTop: Space.lg },
  atalho: {
    flex: 1, minHeight: 44, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  atalhoAtivo: { borderColor: Colors.borderHot, backgroundColor: Colors.gold800 },

  formato: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  radio: {
    width: 20, height: 20, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioAtivo: { borderColor: Colors.gold300 },
  radioMiolo: { width: 9, height: 9, borderRadius: Radius.full, backgroundColor: Colors.gold300 },

  chave: {
    width: 46, height: 28, borderRadius: Radius.full, padding: 3,
    backgroundColor: Colors.bg3, justifyContent: 'center',
  },
  chaveAtiva: { backgroundColor: Colors.gold600 },
  chaveBola: { width: 22, height: 22, borderRadius: Radius.full, backgroundColor: Colors.text3 },
  chaveBolaAtiva: { backgroundColor: Colors.gold100, transform: [{ translateX: 18 }] },

  barra: {
    width: '100%', maxWidth: 760, alignSelf: 'center',
    paddingHorizontal: Space.xl, paddingTop: Space.md, paddingBottom: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: 'rgba(10,8,7,0.9)',
  },
});
