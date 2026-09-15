import { useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Space } from '@/constants/tokens';
import { KTScreen } from '@/components/ui/Screen';
import { KTSurface } from '@/components/ui/Surface';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Filete, Naipe } from '@/components/ui/Ornamento';
import { useTournamentStore } from '@/stores/tournamentStore';
import { useBlindsStore, BLIND_PRESETS } from '@/stores/blindsStore';
import type { TournamentFormat } from '@/types';
import { semAnelDeFoco } from '@/components/ui/campo';

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

export default function AbrirMesa() {
  const { createTournament, setActive, startTournament } = useTournamentStore();
  const { setStructure } = useBlindsStore();

  const [nome, setNome] = useState('');
  const [buyIn, setBuyIn] = useState('500');
  const [formato, setFormato] = useState<TournamentFormat>('regular');
  const [reentrada, setReentrada] = useState(true);
  const [naipe, setNaipe] = useState<(typeof NAIPES)[number]>('espada');

  const valor = Number(buyIn.replace(/\D/g, '')) || 0;
  const podeAbrir = nome.trim().length > 0 && valor > 0;

  const abrir = () => {
    if (!podeAbrir) return;
    const estrutura = BLIND_PRESETS[formato] ?? BLIND_PRESETS.regular;
    const t = createTournament({
      name: nome.trim(),
      format: formato,
      buyIn: valor,
      reEntryAllowed: reentrada,
      maxReEntries: reentrada ? 2 : 0,
      startTime: new Date().toISOString(),
      blindStructure: estrutura,
      createdBy: 'me',
    });
    setStructure(estrutura);
    setActive(t.id);
    /* Já entra em andamento: quem abre a mesa está com gente em volta dela, não
       agendando pra semana que vem. */
    startTournament(t.id);
    router.replace(`/tournament/${t.id}` as never);
  };

  return (
    <KTScreen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topo}>
          <Pressable style={styles.iconeBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={19} color={Colors.text1} />
          </Pressable>
          <KTText papel="rotulo" color={Colors.text2}>Nova mesa</KTText>
          <View style={styles.iconeBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* -------------------------------------------------------- nome */}
          <View style={styles.abertura}>
            <Naipe tipo={naipe} tamanho={26} cor={Colors.gold300} />
            <KTText papel="titulo" color={Colors.gold100} style={{ marginTop: Space.md }}>
              Como se chama a noite?
            </KTText>
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder="Quarta da Realeza"
              placeholderTextColor={Colors.text3}
              style={[styles.campoNome, semAnelDeFoco]}
              autoFocus
              returnKeyType="done"
            />
            <Filete largura={140} />
          </View>

          {/* Marca da mesa: escolha pequena, e é a que dá identidade ao card
              depois. Fica junto do nome porque as duas coisas são a mesma
              pergunta. */}
          <View style={styles.naipes}>
            {NAIPES.map((n) => (
              <Pressable
                key={n}
                onPress={() => setNaipe(n)}
                style={[styles.naipeBtn, naipe === n && styles.naipeBtnAtivo]}
                hitSlop={6}
              >
                <Naipe tipo={n} tamanho={18} cor={naipe === n ? Colors.gold100 : Colors.text3} />
              </Pressable>
            ))}
          </View>

          {/* ------------------------------------------------------ buy-in */}
          <View>
            <KTText papel="rotulo" color={Colors.text2} style={styles.secao}>Buy-in</KTText>
            <KTSurface nivel="card" padding={Space.lg}>
              <View style={styles.linhaValor}>
                <KTText papel="subtitulo" color={Colors.text2}>R$</KTText>
                <TextInput
                  value={buyIn}
                  onChangeText={(t) => setBuyIn(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  style={[styles.campoValor, semAnelDeFoco]}
                  maxLength={6}
                />
              </View>
              <View style={styles.atalhos}>
                {[100, 200, 500, 1000].map((v) => (
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
                const ativo = formato === f.valor;
                return (
                  <Pressable key={f.valor} onPress={() => setFormato(f.valor)}>
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
          </View>

          {/* --------------------------------------------------- reentrada */}
          <Pressable onPress={() => setReentrada((v) => !v)}>
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
          <KTButton
            label={podeAbrir ? 'Criar mesa' : !nome.trim() ? 'Dê um nome à mesa' : 'Informe o valor do buy-in'}
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
    paddingHorizontal: Space.xl, paddingBottom: Space.md,
  },
  iconeBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg1,
  },
  conteudo: { paddingHorizontal: Space.xl, gap: Space.xxl },

  abertura: { alignItems: 'center', paddingTop: Space.lg },
  campoNome: {
    width: '100%', textAlign: 'center',
    fontFamily: Fonts.display, fontSize: 23, color: Colors.text0,
    paddingVertical: Space.lg,
  },
  naipes: { flexDirection: 'row', justifyContent: 'center', gap: Space.md, marginTop: -Space.lg },
  naipeBtn: {
    width: 42, height: 42, borderRadius: Radius.full,
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
    flex: 1, height: 38, borderRadius: Radius.full,
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
    paddingHorizontal: Space.xl, paddingTop: Space.md, paddingBottom: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: 'rgba(10,8,7,0.9)',
  },
});
