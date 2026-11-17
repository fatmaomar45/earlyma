import { Button, Center, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { Icon } from './Icon.jsx'

export function EmptyState({ icon = 'clipboard', title, description, actionLabel, onAction, actionTo, children }) {
  return (
    <Center py="xl">
      <Stack align="center" gap="sm" maw={440}>
        <ThemeIcon size={54} radius="xl" variant="light" color="teal">
          <Icon name={icon} size={26} />
        </ThemeIcon>
        <Title order={3} ta="center">{title}</Title>
        {description ? <Text c="dimmed" size="sm" ta="center">{description}</Text> : null}
        {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
        {actionLabel && actionTo ? <Button component="a" href={actionTo}>{actionLabel}</Button> : null}
        {children}
      </Stack>
    </Center>
  )
}
