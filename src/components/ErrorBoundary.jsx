import { Component } from 'react'
import { Button, Container, Paper, Stack, Text, Title } from '@mantine/core'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch() {
    // Intentionally do not log patient information. Only a generic message is
    // shown to the user; detailed stack traces stay in the developer console.
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error('Earlyma render error')
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Container size="sm" py="xl">
          <Paper withBorder p="xl">
            <Stack>
              <Title order={2}>Something went wrong</Title>
              <Text c="dimmed">
                The application hit an unexpected error. Your saved data has not been changed by this screen.
              </Text>
              <Button onClick={() => window.location.reload()}>Reload application</Button>
              {import.meta.env?.DEV && (
                <Text size="xs" c="red" style={{ whiteSpace: 'pre-wrap' }}>
                  {String(this.state.error?.message ?? this.state.error)}
                </Text>
              )}
            </Stack>
          </Paper>
        </Container>
      )
    }
    return this.props.children
  }
}
