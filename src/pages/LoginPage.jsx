import { useMemo, useState } from 'react'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  PasswordInput,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'
import { Icon } from '../components/Icon.jsx'
import { LanguageSwitch } from '../components/LanguageSwitch.jsx'
import { passwordIssues, passwordStrength } from '../lib/crypto.js'
import { validateWorker } from '../lib/validation.js'
import { isRemoteAuthEnabled } from '../lib/authApi.js'
import { VILLAGE_SUGGESTIONS } from '../data/schedules.js'

const EMPTY_LOGIN = { email: '', password: '' }
const EMPTY_REGISTER = {
  fullName: '',
  phone: '',
  village: '',
  facility: '',
  email: '',
  password: '',
  confirmPassword: '',
}
const EMPTY_RECOVER = { email: '', phone: '', password: '', confirmPassword: '' }

function errorKey(code) {
  return {
    invalid: 'auth.invalidCredentials',
    inactive: 'auth.inactiveAccount',
    reset: 'auth.passwordResetRequired',
    passwords: 'auth.passwordsMismatch',
    demo: 'auth.demoError',
    pending: 'auth.pendingLogin',
    network: 'auth.networkError',
    duplicate: 'auth.duplicateAccount',
    password: 'auth.weakPassword',
    validation: 'auth.requiredFields',
  }[code] ?? 'auth.requiredFields'
}

export function LoginPage() {
  const {
    t, db, login, register, loginDemo, recoverPassword, busy, storageAvailable,
  } = useApp()
  const remote = isRemoteAuthEnabled()
  const firstRun = (db.workers ?? []).length === 0

  const [mode, setMode] = useState(firstRun ? 'register' : 'login')
  const [loginForm, setLoginForm] = useState(EMPTY_LOGIN)
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER)
  const [recoverForm, setRecoverForm] = useState(EMPTY_RECOVER)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [registeredUser, setRegisteredUser] = useState(null)

  const villages = useMemo(() => Array.from(new Set([
    ...VILLAGE_SUGGESTIONS,
    ...(db.mothers ?? []).map((mother) => mother.village),
    ...(db.babies ?? []).map((baby) => baby.village),
    ...(db.workers ?? []).map((worker) => worker.village),
  ].filter(Boolean))).sort(), [db.mothers, db.babies, db.workers])

  const facilities = useMemo(() => Array.from(new Set(
    (db.workers ?? []).map((worker) => worker.facility).filter(Boolean),
  )).sort(), [db.workers])

  const strength = passwordStrength(registerForm.password)
  const recoverStrength = passwordStrength(recoverForm.password)

  const clearMessages = () => {
    setError(null)
    setFieldErrors({})
    setNotice(null)
  }

  const switchMode = (next) => {
    clearMessages()
    setMode(next)
  }

  const setLogin = (key) => (event) => setLoginForm((current) => ({ ...current, [key]: event.currentTarget.value }))
  const setRegister = (key) => (event) => setRegisterForm((current) => ({ ...current, [key]: event.currentTarget.value }))
  const setRecover = (key) => (event) => setRecoverForm((current) => ({ ...current, [key]: event.currentTarget.value }))

  const submitLogin = async (event) => {
    event.preventDefault()
    clearMessages()
    const result = await login(loginForm)
    if (!result.ok) setError(t(errorKey(result.error)))
  }

  const submitRegister = async (event) => {
    event.preventDefault()
    clearMessages()

    const validation = validateWorker({ ...registerForm, role: 'chw' }, { workers: db.workers })
    const errors = { ...validation.errors }
    const pwIssues = passwordIssues(registerForm.password)
    if (pwIssues.length && !errors.password) errors.password = pwIssues[0]
    if (registerForm.password && registerForm.password !== registerForm.confirmPassword) {
      errors.confirmPassword = 'validation.passwordsMismatch'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setError(t('auth.requiredFields'))
      return
    }

    const result = await register(registerForm)
    if (!result.ok) {
      if (result.errors) setFieldErrors(result.errors)
      if (result.issues?.length) setError(t(result.issues[0]))
      else setError(t(errorKey(result.error)))
      return
    }
    setRegisteredUser(result.user ?? null)
    setMode(result.pending ? 'awaiting' : 'registered')
  }

  const submitRecover = async (event) => {
    event.preventDefault()
    clearMessages()

    const errors = {}
    if (!recoverForm.email.trim()) errors.email = 'validation.required'
    if (!recoverForm.phone.trim()) errors.phone = 'validation.required'
    const pwIssues = passwordIssues(recoverForm.password)
    if (pwIssues.length) errors.password = pwIssues[0]
    if (recoverForm.password !== recoverForm.confirmPassword) errors.confirmPassword = 'validation.passwordsMismatch'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const result = await recoverPassword(recoverForm)
    if (!result.ok) {
      if (result.issues?.length) setFieldErrors({ password: result.issues[0] })
      else setError(t(errorKey(result.error)))
      return
    }
    setNotice(t('auth.recoverSuccess'))
    setLoginForm((current) => ({ ...current, email: recoverForm.email }))
    setRecoverForm(EMPTY_RECOVER)
    setMode('login')
  }

  const handleDemo = async () => {
    clearMessages()
    const result = await loginDemo()
    if (!result.ok) setError(t(errorKey(result.error)))
  }

  const err = (key) => (fieldErrors[key] ? t(fieldErrors[key]) : undefined)

  const strengthMeter = (value, score) => (value ? (
    <Stack gap={4}>
      <Progress value={(score.score + 1) * 20} color={score.color} size="xs" aria-hidden="true" />
      <Text size="xs" c="dimmed">
        {t('auth.pwStrengthLabel')}: {t(score.labelKey)}
      </Text>
    </Stack>
  ) : null)

  const demoSection = remote ? null : (
    <>
      <Divider label={t('auth.demoTitle')} labelPosition="center" />
      <Stack gap={6}>
        <Text size="sm" c="dimmed">{t('auth.demoDescription')}</Text>
        <Button
          variant="light"
          leftSection={<Icon name="eye" size={16} />}
          onClick={handleDemo}
          loading={Boolean(busy.auth)}
          fullWidth
        >
          {t('auth.demoButton')}
        </Button>
      </Stack>
    </>
  )

  return (
    <Box className="auth-page">
      <Box className="auth-hero">
        <Stack gap="lg" maw={620}>
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon size={46} radius="md" variant="gradient" gradient={{ from: 'teal', to: 'cyan', deg: 135 }}>
                <Icon name="heart" size={24} />
              </ThemeIcon>
              <Box>
                <Text fw={800} fz="xl" c="white">{t('app.name')}</Text>
                <Text size="sm" c="teal.1">{t('app.tagline')}</Text>
              </Box>
            </Group>
            <Box className="auth-language"><LanguageSwitch size="md" /></Box>
          </Group>

          <Stack gap="xs">
            <Title order={1} c="white" className="auth-title">{t('auth.title')}</Title>
            <Text c="teal.1" size="lg">{t('auth.subtitle')}</Text>
          </Stack>

          <SimpleGrid className="auth-features" cols={{ base: 1, sm: 3 }} spacing="sm">
            {[
              { icon: 'mother', text: t('mothers.subtitle') },
              { icon: 'calendar', text: t('visits.subtitle') },
              { icon: 'bell', text: t('notifications.subtitle') },
            ].map((item) => (
              <Card key={item.icon} className="auth-feature" padding="sm">
                <Stack gap={6}>
                  <ThemeIcon variant="light" color="teal" radius="md"><Icon name={item.icon} size={18} /></ThemeIcon>
                  <Text size="sm" c="white">{item.text}</Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          <Alert className="auth-hero-alert" color="yellow" variant="light" icon={<Icon name="shield" size={18} />}>
            {t('app.demoNotice')}
          </Alert>
        </Stack>
      </Box>

      <Box className="auth-form-wrap">
        <Card className="auth-card" padding={{ base: 'md', sm: 'xl' }} withBorder>
          <Stack gap="md">
            {!storageAvailable ? <Alert color="orange">{t('settings.storageUnavailable')}</Alert> : null}
            {error ? <Alert color="red" icon={<Icon name="alert" size={18} />}>{error}</Alert> : null}
            {notice ? <Alert color="teal" icon={<Icon name="check" size={18} />}>{notice}</Alert> : null}

            {mode === 'login' ? (
              <>
                <Box>
                  <Title order={2}>{t('auth.login')}</Title>
                  <Text size="sm" c="dimmed" mt={4}>{t('auth.secureNote')}</Text>
                </Box>

                {!firstRun ? (
                  <SegmentedControl
                    fullWidth
                    value="login"
                    onChange={(value) => switchMode(value)}
                    data={[
                      { value: 'login', label: t('auth.login') },
                      { value: 'register', label: t('auth.register') },
                    ]}
                  />
                ) : null}

                <form onSubmit={submitLogin}>
                  <Stack gap="sm">
                    <TextInput
                      label={t('auth.email')}
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      autoCapitalize="none"
                      value={loginForm.email}
                      onChange={setLogin('email')}
                      error={err('email')}
                      required
                    />
                    <PasswordInput
                      label={t('auth.password')}
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={setLogin('password')}
                      required
                    />
                    <Group justify="flex-end">
                      <Anchor size="sm" onClick={() => switchMode('recover')}>
                        {t('auth.forgotPassword')}
                      </Anchor>
                    </Group>
                    <Button type="submit" fullWidth loading={Boolean(busy.auth)}>
                      {t('auth.loginButton')}
                    </Button>
                  </Stack>
                </form>

                {demoSection}

                {!firstRun && !remote ? (
                  <Text size="xs" c="dimmed" ta="center">
                    <Anchor size="xs" onClick={() => switchMode('register')}>
                      {t('auth.register')}
                    </Anchor>
                  </Text>
                ) : null}
              </>
            ) : null}

            {mode === 'register' ? (
              <>
                <Box>
                  <Title order={2}>{firstRun ? t('auth.firstAdminNote') : t('auth.register')}</Title>
                  <Text size="sm" c="dimmed" mt={4}>{t('auth.registerIntro')}</Text>
                </Box>

                {!firstRun ? (
                  <SegmentedControl
                    fullWidth
                    value="register"
                    onChange={(value) => switchMode(value)}
                    data={[
                      { value: 'login', label: t('auth.login') },
                      { value: 'register', label: t('auth.register') },
                    ]}
                  />
                ) : null}

                <form onSubmit={submitRegister}>
                  <Stack gap="sm">
                    <TextInput
                      label={t('auth.fullName')}
                      autoComplete="name"
                      value={registerForm.fullName}
                      onChange={setRegister('fullName')}
                      error={err('fullName')}
                      required
                      autoFocus
                    />
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      <TextInput
                        label={t('auth.phone')}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+255…"
                        value={registerForm.phone}
                        onChange={setRegister('phone')}
                        error={err('phone')}
                        required
                      />
                      <TextInput
                        label={t('auth.village')}
                        list="earlyma-village-options"
                        value={registerForm.village}
                        onChange={setRegister('village')}
                        error={err('village')}
                        required
                      />
                    </SimpleGrid>
                    <TextInput
                      label={`${t('auth.facility')} (${t('common.optional')})`}
                      list="earlyma-facility-options"
                      value={registerForm.facility}
                      onChange={setRegister('facility')}
                    />
                    <TextInput
                      label={t('auth.email')}
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      autoCapitalize="none"
                      value={registerForm.email}
                      onChange={setRegister('email')}
                      error={err('email')}
                      required
                    />
                    <PasswordInput
                      label={t('auth.password')}
                      autoComplete="new-password"
                      value={registerForm.password}
                      onChange={setRegister('password')}
                      description={t('auth.passwordHint')}
                      error={err('password')}
                      required
                    />
                    {strengthMeter(registerForm.password, strength)}
                    <PasswordInput
                      label={t('auth.confirmPassword')}
                      autoComplete="new-password"
                      value={registerForm.confirmPassword}
                      onChange={setRegister('confirmPassword')}
                      error={err('confirmPassword')}
                      required
                    />
                    <Button type="submit" fullWidth loading={Boolean(busy.auth)}>
                      {t('auth.registerButton')}
                    </Button>
                  </Stack>
                </form>

                <Text size="xs" c="dimmed">{firstRun ? t('auth.firstAdminNote') : t('auth.approvalNote')}</Text>
                {demoSection}
              </>
            ) : null}

            {mode === 'recover' ? (
              <>
                <Box>
                  <Title order={2}>{t('auth.recoverTitle')}</Title>
                  <Text size="sm" c="dimmed" mt={4}>{t('auth.recoverIntro')}</Text>
                </Box>

                <form onSubmit={submitRecover}>
                  <Stack gap="sm">
                    <TextInput
                      label={t('auth.email')}
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      autoCapitalize="none"
                      value={recoverForm.email}
                      onChange={setRecover('email')}
                      error={err('email')}
                      required
                    />
                    <TextInput
                      label={t('auth.phone')}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+255…"
                      value={recoverForm.phone}
                      onChange={setRecover('phone')}
                      error={err('phone')}
                      required
                    />
                    <PasswordInput
                      label={t('auth.newPassword')}
                      autoComplete="new-password"
                      value={recoverForm.password}
                      onChange={setRecover('password')}
                      description={t('auth.passwordHint')}
                      error={err('password')}
                      required
                    />
                    {strengthMeter(recoverForm.password, recoverStrength)}
                    <PasswordInput
                      label={t('auth.confirmNewPassword')}
                      autoComplete="new-password"
                      value={recoverForm.confirmPassword}
                      onChange={setRecover('confirmPassword')}
                      error={err('confirmPassword')}
                      required
                    />
                    <Button type="submit" fullWidth loading={Boolean(busy.auth)}>
                      {t('auth.recoverButton')}
                    </Button>
                    <Button variant="default" fullWidth onClick={() => switchMode('login')}>
                      {t('auth.backToLogin')}
                    </Button>
                  </Stack>
                </form>
                <Text size="xs" c="dimmed">{t('auth.recoverDemoNote')}</Text>
              </>
            ) : null}

            {mode === 'awaiting' ? (
              <Stack align="center" gap="sm" py="md">
                <ThemeIcon size={60} radius="xl" color="orange" variant="light">
                  <Icon name="clock" size={30} />
                </ThemeIcon>
                <Title order={2} ta="center">{t('auth.pendingTitle')}</Title>
                <Text ta="center" c="dimmed">{t('auth.registeredPending')}</Text>
                {registeredUser?.code ? (
                  <Badge size="lg" variant="light" color="teal">
                    {t('auth.chwId')}: {registeredUser.code}
                  </Badge>
                ) : null}
                <Button
                  variant="light"
                  onClick={() => {
                    setLoginForm((current) => ({ ...current, email: registeredUser?.email ?? current.email }))
                    switchMode('login')
                  }}
                >
                  {t('auth.backToLogin')}
                </Button>
              </Stack>
            ) : null}

            {mode === 'registered' ? (
              <Stack align="center" gap="sm" py="md">
                <ThemeIcon size={60} radius="xl" color="teal" variant="light">
                  <Icon name="check" size={30} />
                </ThemeIcon>
                <Title order={2} ta="center">{t('auth.registeredTitle')}</Title>
                <Text ta="center" c="dimmed">{t('auth.registeredMessage')}</Text>
                {registeredUser?.code ? (
                  <Badge size="lg" variant="light" color="teal">
                    {t('auth.chwId')}: {registeredUser.code}
                  </Badge>
                ) : null}
                <Button variant="light" onClick={() => switchMode('login')}>
                  {t('auth.backToLogin')}
                </Button>
              </Stack>
            ) : null}

            <datalist id="earlyma-village-options">
              {villages.map((village) => <option key={village} value={village} />)}
            </datalist>
            <datalist id="earlyma-facility-options">
              {facilities.map((facility) => <option key={facility} value={facility} />)}
            </datalist>
          </Stack>
        </Card>
      </Box>
    </Box>
  )
}