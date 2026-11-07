import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#121018' },
        headerTintColor: '#fff7ed',
        contentStyle: { backgroundColor: '#0a090d' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Truth Weaver' }} />
    </Stack>
  );
}
