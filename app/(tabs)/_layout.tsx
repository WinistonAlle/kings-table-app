import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { Colors, Fonts } from '@/constants/tokens';

// Crown SVG glyph as component (inline, no asset needed)
function CrownIcon({ color, size }: { color: string; size: number }) {
  // Using a simple character as fallback — real SVG needs react-native-svg
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bg1,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarActiveTintColor: Colors.gold200,
        tabBarInactiveTintColor: Colors.text2,
        tabBarLabelStyle: {
          fontFamily: Fonts.uiMedium,
          fontSize: 10,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="trophy" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'IA',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="sparkle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

// Simple icon using @expo/vector-icons
import { Ionicons } from '@expo/vector-icons';
const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  home:    'home',
  trophy:  'trophy',
  sparkle: 'sparkles',
  person:  'person',
};
function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  return <Ionicons name={iconMap[name]} size={size} color={color} />;
}
