import { useRef, useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Space } from '@/constants/tokens';
import { KTScreen } from '@/components/ui/Screen';
import { KTSurface } from '@/components/ui/Surface';
import { KTText } from '@/components/ui/Text';
import { Filete, Naipe } from '@/components/ui/Ornamento';
import { semAnelDeFoco } from '@/components/ui/campo';

/* A Rainha.
 *
 * Antes eram três abas dentro de uma aba (chat, treino, trilha), com o treino
 * e a trilha cheios de progresso inventado: "485 XP", "streak de 14 dias",
 * "nível 4". Três telas rasas em vez de uma boa, e duas delas mentindo.
 *
 * Aqui sobra a que tem função hoje: a conversa. E ela é honesta sobre o que é
 * — as respostas ainda não passam por modelo nenhum, então a tela diz isso em
 * vez de fingir inteligência. Treino e trilha voltam quando existirem de fato.
 */

type Mensagem = { de: 'rainha' | 'eu'; texto: string };

const ABERTURA: Mensagem[] = [
  {
    de: 'rainha',
    texto:
      'Sou a Rainha. Pergunte sobre ranges, posição, pote odds ou a mão que você não conseguiu esquecer no caminho de casa.',
  },
];

const SUGESTOES = [
  'Como defender o big blind?',
  'Ranges de abertura por posição',
  'O que é minimum defense frequency?',
  'Quando dar 3-bet por valor?',
];

/* Base local. É o que existe enquanto a Rainha não fala com um modelo de
   verdade, e o rodapé da tela avisa isso sem rodeio. */
const BASE: { chaves: string[]; resposta: string }[] = [
  {
    chaves: ['posição', 'posicao', 'position'],
    resposta:
      'Posição é a variável mais barata do poker: custa nada e vale muito. Agindo por último você decide com informação que o outro não teve. Na prática: abra mais mãos no botão e no cutoff, e seja bem mais seletivo no small blind, onde você joga fora de posição o resto da mão.',
  },
  {
    chaves: ['big blind', 'bb', 'defender'],
    resposta:
      'Defender o big blind é matemática de desconto: você já tem uma aposta no pote, então precisa de menos equidade para continuar. Contra um open de 2,5bb no botão, dá para defender uma faixa larga — conectores, suited gappers, ases pequenos suited. O erro comum não é defender demais, é defender e depois desistir no primeiro flop que não acerta.',
  },
  {
    chaves: ['mdf', 'minimum defense', 'defense frequency'],
    resposta:
      'Minimum defense frequency é o quanto você precisa continuar para o vilão não lucrar apostando qualquer coisa. A conta: MDF = pote ÷ (pote + aposta). Numa aposta de meio pote, você precisa seguir com uns 67% da sua faixa. Abaixo disso, o bluff dele passa a pagar sozinho.',
  },
  {
    chaves: ['3-bet', '3bet', 'três aposta'],
    resposta:
      'Dê 3-bet por valor com as mãos que seguem bem contra a faixa que paga, e por bluff com as que têm potencial de bloquear as mãos fortes dele. O tamanho muda com a posição: em posição, 3x o open resolve; fora de posição, suba para 4x, porque você vai jogar o resto da mão em desvantagem e precisa cobrar por isso.',
  },
  {
    chaves: ['pote odds', 'pot odds', 'odds'],
    resposta:
      'Pote odds é comparar o que você paga com o que pode levar. Pagar 50 num pote de 150 custa 25% — então você precisa de 25% de chance de ganhar. Com flush draw depois do flop você tem uns 36% até o river: paga. Com gutshot, uns 16%: não paga, a não ser que haja implícito o suficiente atrás.',
  },
];

function responder(pergunta: string) {
  const q = pergunta.toLowerCase();
  const achou = BASE.find((b) => b.chaves.some((c) => q.includes(c)));
  return (
    achou?.resposta ??
    'Essa eu ainda não sei responder bem. Minha base de agora cobre posição, defesa de big blind, MDF, 3-bet e pote odds. Quando eu estiver ligada a um modelo de verdade, respondo qualquer mão que você trouxer.'
  );
}

export default function Rainha() {
  const [mensagens, setMensagens] = useState<Mensagem[]>(ABERTURA);
  const [texto, setTexto] = useState('');
  const rolagem = useRef<ScrollView>(null);

  const enviar = (pergunta: string) => {
    const limpo = pergunta.trim();
    if (!limpo) return;
    setMensagens((m) => [...m, { de: 'eu', texto: limpo }, { de: 'rainha', texto: responder(limpo) }]);
    setTexto('');
    requestAnimationFrame(() => rolagem.current?.scrollToEnd({ animated: true }));
  };

  return (
    <KTScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* ---------------------------------------------------- cabeçalho */}
        <View style={styles.topo}>
          <View style={styles.retrato}>
            {/* zIndex negativo: sem ele a camada absoluta cobre o ícone no web. */}
            <LinearGradient
              colors={[Colors.gold700, Colors.gold800]}
              style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
            />
            <View style={styles.retratoLuz} />
            <Naipe tipo="copas" tamanho={19} cor={Colors.gold100} />
          </View>
          <View style={{ flex: 1 }}>
            <KTText papel="subtitulo" color={Colors.gold100}>A Rainha</KTText>
            <KTText papel="rotulo" color={Colors.text3}>Conselheira de GTO</KTText>
          </View>
        </View>

        <ScrollView
          ref={rolagem}
          contentContainerStyle={styles.conversa}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {mensagens.map((m, i) =>
            m.de === 'rainha' ? (
              <View key={i} style={styles.balaoRainha}>
                <KTText papel="rotulo" color={Colors.gold500}>Rainha</KTText>
                <KTText papel="corpo" color={Colors.text1} style={{ marginTop: 6 }}>{m.texto}</KTText>
              </View>
            ) : (
              <View key={i} style={styles.balaoEu}>
                <KTText papel="corpo" color="#1a1206">{m.texto}</KTText>
              </View>
            ),
          )}

          {mensagens.length <= 1 ? (
            <View style={styles.sugestoes}>
              <Filete largura={70} />
              <KTText papel="rotulo" color={Colors.text3} style={{ marginVertical: Space.md }}>
                Por onde começar
              </KTText>
              {SUGESTOES.map((s) => (
                <Pressable key={s} onPress={() => enviar(s)} style={styles.sugestao}>
                  <KTText papel="corpo" color={Colors.text1} style={{ flex: 1 }}>{s}</KTText>
                  <Ionicons name="arrow-forward" size={14} color={Colors.gold500} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <KTText papel="apoio" color={Colors.text3} style={styles.aviso}>
            As respostas vêm de uma base local, escrita à mão. A Rainha ainda não
            está ligada a um modelo — quando estiver, ela lê a mão que você jogou
            e responde sobre ela.
          </KTText>
        </ScrollView>

        {/* ------------------------------------------------------- entrada */}
        <View style={styles.entrada}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Pergunte sobre uma mão, um range, um spot"
            placeholderTextColor={Colors.text3}
            style={[styles.campo, semAnelDeFoco]}
            onSubmitEditing={() => enviar(texto)}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={() => enviar(texto)}
            disabled={!texto.trim()}
            style={[styles.enviar, !texto.trim() && { opacity: 0.35 }]}
          >
            <Ionicons name="arrow-up" size={19} color="#1a1206" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </KTScreen>
  );
}

const styles = StyleSheet.create({
  topo: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    paddingHorizontal: Space.xl, paddingBottom: Space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  retrato: {
    width: 46, height: 46, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderHot,
  },
  retratoLuz: { position: 'absolute', top: 0, left: 10, right: 10, height: 1, backgroundColor: 'rgba(236,217,165,0.4)' },

  conversa: { padding: Space.xl, gap: Space.lg, paddingBottom: Space.xxl },
  balaoRainha: {
    alignSelf: 'flex-start', maxWidth: '92%',
    padding: Space.lg, borderRadius: Radius.lg, borderTopLeftRadius: Radius.xs,
    backgroundColor: Colors.bg1,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  balaoEu: {
    alignSelf: 'flex-end', maxWidth: '85%',
    paddingHorizontal: Space.lg, paddingVertical: Space.md,
    borderRadius: Radius.lg, borderBottomRightRadius: Radius.xs,
    backgroundColor: Colors.gold200,
  },

  sugestoes: { alignItems: 'center', marginTop: Space.md },
  sugestao: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    alignSelf: 'stretch',
    paddingVertical: Space.lg, paddingHorizontal: Space.lg,
    borderRadius: Radius.md, marginBottom: Space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    backgroundColor: 'rgba(255,250,235,0.02)',
  },
  aviso: { textAlign: 'center', marginTop: Space.xl, lineHeight: 18, paddingHorizontal: Space.lg },

  entrada: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm,
    paddingHorizontal: Space.xl, paddingTop: Space.md, paddingBottom: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: 'rgba(10,8,7,0.92)',
    marginBottom: 88,
  },
  campo: {
    flex: 1, maxHeight: 120, minHeight: 46,
    borderRadius: Radius.lg, paddingHorizontal: Space.lg, paddingTop: 13, paddingBottom: 13,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    backgroundColor: Colors.bg1, color: Colors.text0,
    fontFamily: 'InterTight_400Regular', fontSize: 15,
  },
  enviar: {
    width: 46, height: 46, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.gold200,
  },
});
