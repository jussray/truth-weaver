import { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  evaluateVerifiedLaw,
  type GuardResult,
} from '../../src/domain/law';

export default function TruthWeaverMobile() {
  const [jurisdictionResolved, setJurisdictionResolved] = useState(false);
  const [primaryAttached, setPrimaryAttached] = useState(false);
  const [officialConfirmed, setOfficialConfirmed] = useState(false);
  const [currentnessChecked, setCurrentnessChecked] = useState(false);
  const [citation, setCitation] = useState('');
  const [result, setResult] = useState<GuardResult | null>(null);

  const shareText = useMemo(() => {
    if (!result) return '';
    return [
      'Truth Weaver finding gate',
      `State: ${result.resolvedState}`,
      `VERIFIED LAW earned: ${result.allowed ? 'yes' : 'no'}`,
      ...result.blockers.map((blocker) => `• ${blocker}`),
      '',
      'This is a source-classification receipt, not legal advice and not authority to act.',
    ].join('\n');
  }, [result]);

  async function evaluate() {
    const next = evaluateVerifiedLaw({
      jurisdictionId: jurisdictionResolved ? 'manual-mobile-jurisdiction' : null,
      sources: primaryAttached
        ? [{
            source_type: 'statute_code',
            source_role: 'primary',
            is_official: officialConfirmed,
            jurisdiction_id: jurisdictionResolved ? 'manual-mobile-jurisdiction' : null,
          }]
        : [],
      citation: citation.trim() || null,
      officialStatusKnown: primaryAttached ? officialConfirmed : false,
      currentnessCheckedAt: currentnessChecked ? new Date().toISOString() : null,
    });
    setResult(next);
    await Haptics.notificationAsync(
      next.allowed
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
  }

  async function shareFinding() {
    if (!shareText) return;
    await Haptics.selectionAsync();
    await Share.share({ message: shareText, title: 'Truth Weaver finding gate' });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>NATIVE AUTHORITY GATE</Text>
          <Text style={styles.title}>VERIFIED LAW has to be earned.</Text>
          <Text style={styles.subtitle}>
            This offline mobile check runs Truth Weaver's canonical governing-law guard directly on-device.
          </Text>
        </View>

        <View style={styles.card}>
          <GateRow label="Jurisdiction resolved" value={jurisdictionResolved} onChange={setJurisdictionResolved} />
          <GateRow label="Primary-law source attached" value={primaryAttached} onChange={setPrimaryAttached} />
          <GateRow label="Official/authentic status confirmed" value={officialConfirmed} onChange={setOfficialConfirmed} />
          <GateRow label="Currentness checked" value={currentnessChecked} onChange={setCurrentnessChecked} />

          <Text style={styles.label}>Citation or official identifier</Text>
          <TextInput
            accessibilityLabel="Citation or official identifier"
            onChangeText={setCitation}
            placeholder="record the citation you actually checked"
            placeholderTextColor="#78716c"
            style={styles.input}
            value={citation}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Evaluate verified law gate"
            onPress={() => void evaluate()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Evaluate gate</Text>
          </Pressable>
        </View>

        {result ? (
          <View style={styles.resultCard} accessibilityLabel="Verified law gate result">
            <View style={styles.resultHeader}>
              <Text style={styles.resultEyebrow}>RESOLVED STATE</Text>
              <Text style={styles.state}>{result.resolvedState}</Text>
            </View>
            {result.blockers.length === 0 ? (
              <Text style={styles.resultText}>All canonical VERIFIED LAW conditions are present in this manual check.</Text>
            ) : (
              result.blockers.map((blocker) => (
                <Text key={blocker} style={styles.resultText}>• {blocker}</Text>
              ))
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share finding receipt"
              onPress={() => void shareFinding()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Share finding receipt</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.boundaryCard}>
          <Text style={styles.boundaryTitle}>Boundary</Text>
          <Text style={styles.boundaryText}>
            This tool classifies whether the canonical source conditions are present. It is not legal advice and does not authorize a legal, financial, publishing, or repository action.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GateRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.gateRow}>
      <Text style={styles.gateLabel}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a090d' },
  content: { gap: 16, padding: 20, paddingBottom: 48 },
  hero: { gap: 8, paddingTop: 12 },
  eyebrow: { color: '#f59e0b', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#fff7ed', fontSize: 30, fontWeight: '900', lineHeight: 36 },
  subtitle: { color: '#a8a29e', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#18151c', borderColor: '#44403c', borderRadius: 20, borderWidth: 1, gap: 12, padding: 18 },
  gateRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  gateLabel: { color: '#e7e5e4', flex: 1, fontSize: 14, fontWeight: '700' },
  label: { color: '#d6d3d1', fontSize: 13, fontWeight: '800', marginTop: 4 },
  input: { backgroundColor: '#0f0d12', borderColor: '#57534e', borderRadius: 14, borderWidth: 1, color: '#fff7ed', minHeight: 50, paddingHorizontal: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: '#d97706', borderRadius: 14, paddingVertical: 14 },
  primaryText: { color: '#fff7ed', fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.72 },
  resultCard: { backgroundColor: '#1c160d', borderColor: '#d97706', borderRadius: 20, borderWidth: 1, gap: 10, padding: 18 },
  resultHeader: { gap: 4 },
  resultEyebrow: { color: '#f59e0b', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  state: { color: '#fff7ed', fontSize: 21, fontWeight: '900' },
  resultText: { color: '#e7e5e4', fontSize: 13, lineHeight: 19 },
  secondaryButton: { alignItems: 'center', borderColor: '#f59e0b', borderRadius: 14, borderWidth: 1, marginTop: 4, paddingVertical: 12 },
  secondaryText: { color: '#fcd34d', fontSize: 14, fontWeight: '900' },
  boundaryCard: { backgroundColor: '#151319', borderColor: '#44403c', borderRadius: 16, borderWidth: 1, gap: 6, padding: 14 },
  boundaryTitle: { color: '#fafaf9', fontSize: 13, fontWeight: '900' },
  boundaryText: { color: '#a8a29e', fontSize: 12, lineHeight: 18 },
});
