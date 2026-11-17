import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 7,
  defaultRadius: 'md',
  cursorType: 'pointer',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '700',
  },
  colors: {
    brand: [
      '#f0fdfa',
      '#ccfbf1',
      '#99f6e4',
      '#5eead4',
      '#2dd4bf',
      '#14b8a6',
      '#0d9488',
      '#0f766e',
      '#115e59',
      '#134e4a',
    ],
    accent: [
      '#eff6ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#1d4ed8',
      '#1e40af',
      '#1e3a8a',
    ],
  },
  components: {
    Button: {
      defaultProps: { radius: 'md' },
    },
    Card: {
      defaultProps: { radius: 'lg', withBorder: true, shadow: 'xs' },
    },
    Paper: {
      defaultProps: { radius: 'md' },
    },
    Badge: {
      defaultProps: { variant: 'light' },
    },
    TextInput: {
      defaultProps: { radius: 'md' },
    },
    Select: {
      defaultProps: { radius: 'md' },
    },
    Textarea: {
      defaultProps: { radius: 'md' },
    },
    Modal: {
      defaultProps: { radius: 'lg', centered: true },
    },
  },
})
