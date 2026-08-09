import { useState } from 'react';
import { ScrollView, View, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { KTCard } from '@/components/ui/Card';

type Mode = 'chat' | 'train' | 'trail';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Olá! Sou a Rainha ♛, sua assistente de poker GTO. Posso te ajudar com dúvidas de regras, estratégias, análise de mãos e conceitos de GTO. Como posso te ajudar hoje?',
  },
];

export default function AIScreen() {
  const [mode, setMode] = useState<Mode>('chat');
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    // Simulated response — replace with Claude API call
    await new Promise(r => setTimeout(r, 1200));
    const reply: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: getSimulatedResponse(userMsg.content),
    };
    setMessages(m => [...m, reply]);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        {([['chat', 'Chat · Rainha'], ['train', 'Treino GTO'], ['trail', 'Trilha']] as [Mode, string][]).map(([m, label]) => (
          <TouchableOpacity key={m} style={[styles.modeTab, mode === m && styles.modeTabActive]} onPress={() => setMode(m)}>
            <KTText variant="uiMedium" size={13} color={mode === m ? Colors.gold200 : Colors.text2}>
              {label}
            </KTText>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'chat' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
          <ScrollView style={styles.msgs} contentContainerStyle={styles.msgsContent}>
            {messages.map(msg => (
              <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                {msg.role === 'assistant' && (
                  <KTText variant="label" color={Colors.gold400} style={{ marginBottom: 4 }}>RAINHA ♛</KTText>
                )}
                <KTText variant="ui" size={15} color={msg.role === 'user' ? '#1a1206' : Colors.text0} style={{ lineHeight: 22 }}>
                  {msg.content}
                </KTText>
              </View>
            ))}
            {loading && (
              <View style={styles.bubbleAssistant}>
                <KTText variant="label" color={Colors.gold400} style={{ marginBottom: 4 }}>RAINHA ♛</KTText>
                <KTText variant="ui" size={15} color={Colors.text2}>Analisando...</KTText>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Pergunta sobre poker, GTO, hands..."
              placeholderTextColor={Colors.text3}
              value={input}
              onChangeText={setInput}
              multiline
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!input.trim() || loading}>
              <Ionicons name="arrow-up" size={20} color={input.trim() ? '#1a1206' : Colors.text3} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {mode === 'train' && <TrainScreen />}
      {mode === 'trail' && <TrailScreen />}
    </SafeAreaView>
  );
}

// ─── GTO Training screen ──────────────────────────────────────
function TrainScreen() {
  const [action, setAction] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <KTText variant="display" size={24} color={Colors.gold200} style={{ marginBottom: 4 }}>Treino GTO</KTText>
      <KTText variant="ui" size={13} color={Colors.text2} style={{ marginBottom: 20 }}>Tome uma decisão. A IA joga com base em GTO.</KTText>

      {/* Table visualization */}
      <KTCard level={2} style={{ alignItems: 'center', paddingVertical: 32, marginBottom: 20 }}>
        <View style={styles.tableOval}>
          <KTText variant="display" size={16} color={Colors.gold500}>MESA</KTText>
        </View>
        {/* Community cards */}
        <View style={styles.boardCards}>
          {['A♠', 'K♥', '7♦', '—', '—'].map((c, i) => (
            <View key={i} style={[styles.card, c === '—' && styles.cardBack]}>
              <KTText variant="monoBold" size={14} color={c.includes('♥') || c.includes('♦') ? Colors.red : Colors.text0}>{c}</KTText>
            </View>
          ))}
        </View>
        <KTText variant="label" color={Colors.text2} style={{ marginTop: 12 }}>POT: 680</KTText>
      </KTCard>

      {/* Hero hand */}
      <KTCard level={3} style={{ marginBottom: 20 }}>
        <KTText variant="label" color={Colors.text2} style={{ marginBottom: 12 }}>SUA MÃO · POSIÇÃO: BTN</KTText>
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
          {['K♠', 'Q♠'].map((c, i) => (
            <View key={i} style={[styles.card, styles.cardLarge]}>
              <KTText variant="monoBold" size={20} color={Colors.text0}>{c}</KTText>
            </View>
          ))}
        </View>
        <KTText variant="ui" size={12} color={Colors.text2} style={{ marginTop: 12, textAlign: 'center' }}>
          Vilão fez bet de 340 no flop A♠ K♥ 7♦
        </KTText>
      </KTCard>

      {/* Action buttons */}
      {!action ? (
        <View style={styles.actions}>
          {[
            { label: 'FOLD',    color: Colors.danger  },
            { label: 'CALL',    color: Colors.text1   },
            { label: 'RAISE',   color: Colors.gold200 },
          ].map(a => (
            <TouchableOpacity key={a.label} style={[styles.actionBtn, { borderColor: a.color }]} onPress={() => setAction(a.label)}>
              <KTText variant="uiBold" size={14} color={a.color}>{a.label}</KTText>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <KTCard level={3} borderHot style={{ marginTop: 8 }}>
          <KTText variant="label" color={Colors.gold300} style={{ marginBottom: 8 }}>ANÁLISE GTO</KTText>
          <KTText variant="uiMedium" size={14} color={Colors.ok} style={{ marginBottom: 8 }}>
            {action === 'RAISE' ? '✓ Jogada ótima!' : action === 'CALL' ? '◈ Jogada aceitável' : '✗ Fora do range GTO'}
          </KTText>
          <KTText variant="ui" size={13} color={Colors.text1} style={{ lineHeight: 20 }}>
            Com K♠Q♠ no BTN contra bet do flop em A♠K♥7♦, RAISE é a jogada de maior EV. Você tem top pair com boa kicker e backdoor flush draw. GTO recomenda raise 2.5x com ~40% de frequência neste spot.
          </KTText>
          <TouchableOpacity onPress={() => setAction(null)} style={{ marginTop: 16 }}>
            <KTText variant="uiMedium" size={13} color={Colors.gold300}>→ Próxima mão</KTText>
          </TouchableOpacity>
        </KTCard>
      )}
    </ScrollView>
  );
}

// ─── Study Trail screen ───────────────────────────────────────
const MODULES = [
  { id: 1, title: 'Fundamentos',     icon: '♠', xp: 200,  done: true  },
  { id: 2, title: 'Posição',         icon: '♦', xp: 300,  done: true  },
  { id: 3, title: 'Pot Odds',        icon: '♣', xp: 400,  done: false, active: true },
  { id: 4, title: 'Range Building',  icon: '♥', xp: 500,  done: false },
  { id: 5, title: 'GTO Básico',      icon: '♛', xp: 800,  done: false, boss: true },
  { id: 6, title: 'Bluff & Valor',   icon: '♠', xp: 600,  done: false },
];

function TrailScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <View>
          <KTText variant="display" size={24} color={Colors.gold200}>Trilha GTO</KTText>
          <KTText variant="ui" size={13} color={Colors.text2} style={{ marginTop: 2 }}>2 lições concluídas</KTText>
        </View>
        <KTCard level={3} padding={10}>
          <KTText variant="label" color={Colors.warn}>🔥 STREAK</KTText>
          <KTText variant="monoBold" size={22} color={Colors.warn} style={{ textAlign: 'center' }}>7</KTText>
        </KTCard>
      </View>

      {/* XP bar */}
      <View style={{ marginBottom: 28 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <KTText variant="label" color={Colors.text2}>XP TOTAL</KTText>
          <KTText variant="monoMedium" size={12} color={Colors.gold300}>500 / 1400</KTText>
        </View>
        <View style={{ height: 6, backgroundColor: Colors.bg3, borderRadius: 3 }}>
          <View style={{ width: '35%', height: '100%', backgroundColor: Colors.gold400, borderRadius: 3 }} />
        </View>
      </View>

      {/* Zigzag trail */}
      <View style={{ alignItems: 'center', gap: 8 }}>
        {MODULES.map((m, i) => (
          <View key={m.id} style={[styles.trailNode, i % 2 === 0 ? { alignSelf: 'flex-start', marginLeft: 24 } : { alignSelf: 'flex-end', marginRight: 24 }]}>
            <TouchableOpacity
              style={[
                styles.nodeBtn,
                m.done && styles.nodeDone,
                m.active && styles.nodeActive,
                m.boss && styles.nodeBoss,
                !m.done && !m.active && styles.nodeLocked,
              ]}
            >
              <KTText variant="display" size={m.boss ? 28 : 22}>{m.icon}</KTText>
            </TouchableOpacity>
            <KTText variant="label" size={9} color={m.done ? Colors.ok : m.active ? Colors.gold300 : Colors.text3} style={{ marginTop: 4, textAlign: 'center' }}>
              {m.title}
            </KTText>
            {m.done && <KTText variant="label" size={8} color={Colors.ok}>+{m.xp} XP</KTText>}
          </View>
        ))}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function getSimulatedResponse(input: string): string {
  const q = input.toLowerCase();
  if (q.includes('bluff')) return 'Bluffar com equidade é fundamental no GTO. Em geral, você deve ter uma frequência de bluff proporcional ao pot odds que está oferecendo. Se você está apostando 1/2 pot, o vilão precisa acertar 33% das vezes para ser indiferente — então você deve bluffar ~33% das vezes em sua range de apostas.';
  if (q.includes('pot odds') || q.includes('odds')) return 'Pot odds são a relação entre o tamanho da call e o pot total. Para calcular: divida o valor da call pelo pot total após a call. Se o pot é 100 e a bet é 50, você paga 50 para ganhar 150, portanto tem 33% de pot odds. Você precisa ter pelo menos 33% de equidade para fazer a call ser matematicamente correta.';
  if (q.includes('posição') || q.includes('position')) return 'Posição é uma das variáveis mais importantes no poker. Jogar em posição (IP) permite que você aja por último pós-flop, o que lhe dá muito mais informação. Em geral, você pode jogar ranges mais amplas IP e deve ser mais conservador OOP.';
  return 'Ótima pergunta! No poker GTO, cada situação tem múltiplas variáveis a considerar: posição, tamanho do stack, tendências do vilão e a textura do board. Pode me dar mais contexto sobre a situação específica que você está analisando?';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg0 },
  modeTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20,
  },
  modeTab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  modeTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.gold300 },
  msgs: { flex: 1 },
  msgsContent: { padding: 16, gap: 12 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: Radius.md },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: Colors.gold200 },
  bubbleAssistant: { alignSelf: 'flex-start', backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border },
  inputRow: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'flex-end',
  },
  input: {
    flex: 1, backgroundColor: Colors.bg2,
    borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: Fonts.ui, fontSize: 15, color: Colors.text0,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.gold200,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.bg3 },

  // Train
  tableOval: {
    width: 160, height: 90, borderRadius: 45,
    borderWidth: 2, borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  boardCards: { flexDirection: 'row', gap: 8 },
  card: {
    width: 44, height: 60, borderRadius: Radius.xs,
    backgroundColor: Colors.bg0, borderWidth: 1, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBack: { backgroundColor: Colors.bg3 },
  cardLarge: { width: 56, height: 78 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, height: 52, borderRadius: Radius.sm,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg2,
  },

  // Trail
  trailNode: { alignItems: 'center', gap: 4 },
  nodeBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.bg2, borderWidth: 2, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  nodeDone: { backgroundColor: Colors.gold800, borderColor: Colors.gold500 },
  nodeActive: { backgroundColor: Colors.bg3, borderColor: Colors.gold200, shadowColor: Colors.gold200, shadowOpacity: 0.4, shadowRadius: 12 },
  nodeBoss: { width: 84, height: 84, borderRadius: 42 },
  nodeLocked: { opacity: 0.4 },
});
