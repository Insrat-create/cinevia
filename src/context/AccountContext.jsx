import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import movies from '../data/movies'
import tvShows from '../data/tvShows'
import { getAuthRedirectUrl, hasSupabaseConfig, supabase } from '../lib/supabase'

const AccountContext = createContext(null)

const GUEST_OWNER_ID = 'guest'
const ACCOUNT_CACHE_PREFIX = 'cinevia-account-cache:'
const DEMO_ACCOUNTS_KEY = 'cinevia-demo-accounts'
const DEMO_SESSION_KEY = 'cinevia-demo-session'

const allContent = [...movies, ...tvShows]
const contentById = new Map(allContent.map((item) => [item.id, item]))

function findEpisodeInShow(show, episodeId) {
  if (!show || !episodeId) {
    return null
  }

  for (const season of show.seasonsData ?? []) {
    for (const episode of season.episodes ?? []) {
      if (episode.id === episodeId) {
        return {
          season,
          episode,
        }
      }
    }
  }

  return null
}

function findEpisodeMatch(episodeId) {
  if (!episodeId) {
    return null
  }

  for (const show of tvShows) {
    const match = findEpisodeInShow(show, episodeId)

    if (match?.episode) {
      return {
        show,
        ...match,
      }
    }
  }

  return null
}

function safeReadJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key)

    if (!rawValue) {
      return fallback
    }

    return JSON.parse(rawValue)
  } catch {
    return fallback
  }
}

function safeWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore local storage write failures.
  }
}

function safeRemoveValue(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore local storage removal failures.
  }
}

function getAccountStoreKey(ownerId) {
  return `${ACCOUNT_CACHE_PREFIX}${ownerId}`
}

function getEmptyAccountStore() {
  return {
    continueWatching: [],
    favorites: [],
    profile: {},
  }
}

function loadAccountStore(ownerId) {
  if (ownerId === GUEST_OWNER_ID) {
    safeRemoveValue(getAccountStoreKey(ownerId))
    return getEmptyAccountStore()
  }

  return safeReadJson(getAccountStoreKey(ownerId), getEmptyAccountStore())
}

function saveAccountStore(ownerId, store) {
  if (ownerId === GUEST_OWNER_ID) {
    safeRemoveValue(getAccountStoreKey(ownerId))
    return
  }

  safeWriteJson(getAccountStoreKey(ownerId), store)
}

function loadDemoAccounts() {
  return safeReadJson(DEMO_ACCOUNTS_KEY, [])
}

function saveDemoAccounts(accounts) {
  safeWriteJson(DEMO_ACCOUNTS_KEY, accounts)
}

function loadDemoSessionOwnerId() {
  return localStorage.getItem(DEMO_SESSION_KEY)
}

function saveDemoSessionOwnerId(ownerId) {
  if (ownerId) {
    localStorage.setItem(DEMO_SESSION_KEY, ownerId)
    return
  }

  localStorage.removeItem(DEMO_SESSION_KEY)
}

function getDefaultDisplayName(userLike) {
  return (
    userLike?.user_metadata?.display_name ??
    userLike?.user_metadata?.full_name ??
    userLike?.displayName ??
    userLike?.email?.split('@')[0] ??
    'Guest'
  )
}

function getItemType(item) {
  return item.seasons ? 'show' : 'movie'
}

function getFavoritePath(item) {
  return item.seasons ? `/tv-shows/${item.id}` : `/movies/${item.id}`
}

function hydrateFavorites(records) {
  return records
    .map((record) => {
      const item = contentById.get(record.itemId)

      if (!item) {
        return null
      }

      return {
        ...item,
        addedAt: record.addedAt ?? record.created_at ?? record.createdAt ?? new Date().toISOString(),
        resumePath: getFavoritePath(item),
      }
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.addedAt) - new Date(left.addedAt))
}

function hydrateContinueWatchingEntries(records) {
  return records
    .map((record) => {
      if (record.itemType === 'episode') {
        const match = findEpisodeMatch(record.itemId) ?? findEpisodeMatch(record.episodeId)

        if (!match?.episode) {
          return null
        }

        return {
          ...match.show,
          id: match.episode.id,
          bunnyVideoId: match.episode.bunnyVideoId || match.show.bunnyVideoId,
          episodeTitle: match.episode.episodeTitle || match.episode.title,
          parentShow: match.show,
          parentShowId: match.show.id,
          poster: match.episode.poster || match.show.poster,
          progress: record.progress ?? match.episode.progress ?? match.show.progress ?? 0,
          released: match.episode.released || match.show.released,
          resumePath: `/watch/${match.episode.id}`,
          seasonLabel: match.season?.label ?? '',
          updatedAt:
            record.updatedAt ??
            record.last_watched_at ??
            record.lastWatchedAt ??
            new Date().toISOString(),
        }
      }

      const item = contentById.get(record.itemId)

      if (!item) {
        return null
      }

      if (record.episodeId && item.seasons) {
        const match = findEpisodeInShow(item, record.episodeId)

        if (match?.episode) {
          return {
            ...item,
            id: match.episode.id,
            bunnyVideoId: match.episode.bunnyVideoId || item.bunnyVideoId,
            episodeTitle: match.episode.episodeTitle || match.episode.title,
            parentShow: item,
            parentShowId: item.id,
            poster: match.episode.poster || item.poster,
            progress: record.progress ?? match.episode.progress ?? item.progress ?? 0,
            released: match.episode.released || item.released,
            resumePath: `/watch/${match.episode.id}`,
            seasonLabel: match.season?.label ?? '',
            updatedAt:
              record.updatedAt ??
              record.last_watched_at ??
              record.lastWatchedAt ??
              new Date().toISOString(),
          }
        }
      }

      return {
        ...item,
        progress: record.progress ?? item.progress ?? 0,
        updatedAt:
          record.updatedAt ?? record.last_watched_at ?? record.lastWatchedAt ?? new Date().toISOString(),
        resumePath: `/watch/${record.itemId}`,
      }
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
}

function collapseContinueWatchingItems(entries) {
  const seenKeys = new Set()

  return entries.filter((entry) => {
    const key = entry.parentShowId ?? entry.id

    if (seenKeys.has(key)) {
      return false
    }

    seenKeys.add(key)
    return true
  })
}

export function AccountProvider({ children }) {
  const initialGuestStore = loadAccountStore(GUEST_OWNER_ID)
  const hasShownGuestPromptRef = useRef(false)

  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState({
    displayName: initialGuestStore.profile.displayName ?? 'Guest',
    email: initialGuestStore.profile.email ?? '',
  })
  const [favoriteRecords, setFavoriteRecords] = useState(initialGuestStore.favorites ?? [])
  const [continueWatchingRecords, setContinueWatchingRecords] = useState(
    initialGuestStore.continueWatching ?? []
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState('sign-in')
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState(
    hasSupabaseConfig
      ? ''
      : 'Email and Google sign-in switch on after you add Supabase env keys.'
  )

  const ownerId = user?.id ?? GUEST_OWNER_ID
  const favoriteItems = hydrateFavorites(favoriteRecords)
  const hydratedContinueWatchingEntries = useMemo(
    () => hydrateContinueWatchingEntries(continueWatchingRecords),
    [continueWatchingRecords]
  )
  const continueWatchingItems = useMemo(
    () => collapseContinueWatchingItems(hydratedContinueWatchingEntries),
    [hydratedContinueWatchingEntries]
  )
  const playbackProgressById = useMemo(() => {
    const progressMap = new Map()

    hydratedContinueWatchingEntries.forEach((entry) => {
      if (!progressMap.has(entry.id)) {
        progressMap.set(entry.id, entry.progress ?? 0)
      }
    })

    return progressMap
  }, [hydratedContinueWatchingEntries])
  const isSignedIn = Boolean(user)

  const applyLocalStore = (nextOwnerId, nextProfileFallback = {}) => {
    const nextStore = loadAccountStore(nextOwnerId)
    const defaultProfile = {
      displayName: nextProfileFallback.displayName ?? getDefaultDisplayName(nextProfileFallback),
      email: nextProfileFallback.email ?? nextProfileFallback.user_metadata?.email ?? '',
    }

    setProfile({
      displayName: nextStore.profile.displayName ?? defaultProfile.displayName,
      email: nextStore.profile.email ?? defaultProfile.email,
    })
    setFavoriteRecords(nextStore.favorites ?? [])
    setContinueWatchingRecords(nextStore.continueWatching ?? [])
  }

  const upsertCloudProfile = async (nextUser, nextDisplayName) => {
    if (!supabase || !nextUser) {
      return
    }

    const payload = {
      id: nextUser.id,
      email: nextUser.email ?? '',
      display_name: nextDisplayName,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(payload)

    if (error) {
      throw error
    }
  }

  const loadCloudState = async (nextUser) => {
    if (!supabase || !nextUser) {
      return
    }

    const defaultDisplayName = getDefaultDisplayName(nextUser)
    const [profileResult, favoritesResult, continueResult] = await Promise.all([
      supabase.from('profiles').select('display_name, email').eq('id', nextUser.id).maybeSingle(),
      supabase
        .from('favorites')
        .select('item_id, item_type, created_at')
        .eq('user_id', nextUser.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('continue_watching')
        .select('item_id, item_type, progress, episode_id, last_watched_at')
        .eq('user_id', nextUser.id)
        .order('last_watched_at', { ascending: false }),
    ])

    const profileError = profileResult.error && profileResult.error.code !== 'PGRST116'

    if (profileError || favoritesResult.error || continueResult.error) {
      throw profileError || favoritesResult.error || continueResult.error
    }

    if (!profileResult.data) {
      await upsertCloudProfile(nextUser, defaultDisplayName)
    }

    const nextProfile = {
      displayName: profileResult.data?.display_name ?? defaultDisplayName,
      email: profileResult.data?.email ?? nextUser.email ?? '',
    }
    const nextFavorites = (favoritesResult.data ?? []).map((record) => ({
      addedAt: record.created_at,
      itemId: record.item_id,
      itemType: record.item_type,
    }))
    const nextContinue = (continueResult.data ?? []).map((record) => ({
      episodeId: record.episode_id,
      itemId: record.item_id,
      itemType: record.item_type,
      progress: record.progress,
      updatedAt: record.last_watched_at,
    }))

    setProfile(nextProfile)
    setFavoriteRecords(nextFavorites)
    setContinueWatchingRecords(nextContinue)
    saveAccountStore(nextUser.id, {
      continueWatching: nextContinue,
      favorites: nextFavorites,
      profile: nextProfile,
    })
    setAuthMessage('')
  }

  const setSignedOutState = () => {
    setSession(null)
    setUser(null)
    applyLocalStore(GUEST_OWNER_ID, { displayName: 'Guest', email: '' })
  }

  const showGuestAuthPrompt = (nextMode = 'sign-in', nextMessage = '') => {
    setAuthMode(nextMode)
    setAuthError('')
    setAuthMessage(nextMessage)
    setIsAuthModalOpen(true)
  }

  useEffect(() => {
    saveAccountStore(ownerId, {
      continueWatching: continueWatchingRecords,
      favorites: favoriteRecords,
      profile,
    })
  }, [continueWatchingRecords, favoriteRecords, ownerId, profile])

  useEffect(() => {
    if (!hasSupabaseConfig) {
      const demoOwnerId = loadDemoSessionOwnerId()
      const demoAccount = loadDemoAccounts().find((account) => account.id === demoOwnerId)

      if (demoAccount) {
        const demoUser = {
          email: demoAccount.email,
          id: demoAccount.id,
          user_metadata: {
            display_name: demoAccount.displayName,
          },
        }

        setUser(demoUser)
        applyLocalStore(demoAccount.id, {
          displayName: demoAccount.displayName,
          email: demoAccount.email,
        })
      } else {
        applyLocalStore(GUEST_OWNER_ID, { displayName: 'Guest', email: '' })

        if (!hasShownGuestPromptRef.current) {
          hasShownGuestPromptRef.current = true
          showGuestAuthPrompt('sign-in')
        }
      }

      setIsLoading(false)
      return
    }

    let isMounted = true

    const applySession = async (nextSession) => {
      if (!isMounted) {
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (!nextSession?.user) {
        setSignedOutState()

        if (!hasShownGuestPromptRef.current) {
          hasShownGuestPromptRef.current = true
          showGuestAuthPrompt('sign-in')
        }

        setIsLoading(false)
        return
      }

      try {
        await loadCloudState(nextSession.user)
      } catch (error) {
        console.error('Falling back to local account cache.', error)
        applyLocalStore(nextSession.user.id, {
          displayName: getDefaultDisplayName(nextSession.user),
          email: nextSession.user.email ?? '',
        })
        setAuthMessage(
          'Auth is connected, but you still need the database tables from supabase/schema.sql to sync favorites and continue watching.'
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const openAuthModal = (nextMode = 'sign-in') => {
    setAuthMode(nextMode)
    setAuthError('')
    setIsAuthModalOpen(true)
  }

  const closeAuthModal = () => {
    setIsAuthModalOpen(false)
    setAuthError('')
  }

  const syncContinueWatchingRecord = async (record) => {
    if (!supabase || !user) {
      return
    }

    const { error } = await supabase.from('continue_watching').upsert(
      {
        episode_id: record.episodeId ?? null,
        item_id: record.itemId,
        item_type: record.itemType,
        last_watched_at: record.updatedAt,
        progress: record.progress,
        user_id: user.id,
      },
      {
        onConflict: 'user_id,item_id',
      }
    )

    if (error) {
      throw error
    }
  }

  const toggleFavorite = async (item) => {
    if (!isSignedIn) {
      showGuestAuthPrompt('sign-in')
      return false
    }

    const isAlreadyFavorite = favoriteRecords.some((record) => record.itemId === item.id)
    const nextRecords = isAlreadyFavorite
      ? favoriteRecords.filter((record) => record.itemId !== item.id)
      : [
          {
            addedAt: new Date().toISOString(),
            itemId: item.id,
            itemType: getItemType(item),
          },
          ...favoriteRecords,
        ]

    setFavoriteRecords(nextRecords)

    if (supabase && user) {
      try {
        if (isAlreadyFavorite) {
          const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('item_id', item.id)

          if (error) {
            throw error
          }
        } else {
          const { error } = await supabase.from('favorites').upsert(
            {
              created_at: nextRecords[0].addedAt,
              item_id: item.id,
              item_type: getItemType(item),
              user_id: user.id,
            },
            {
              onConflict: 'user_id,item_id',
            }
          )

          if (error) {
            throw error
          }
        }
      } catch (error) {
        console.error('Unable to sync favorite.', error)
        setAuthMessage(
          'Favorite list saved locally. Add the Supabase tables from supabase/schema.sql to sync it to your account.'
        )
      }
    }

    return !isAlreadyFavorite
  }

  const saveContinueWatching = async (item, progress = 12, episodeId = null) => {
    if (!isSignedIn) {
      return false
    }

    const isEpisodeRecord = Boolean(episodeId || item.parentShowId)
    const normalizedItemId = episodeId ?? item.id
    const nextRecord = {
      episodeId: isEpisodeRecord ? normalizedItemId : null,
      itemId: normalizedItemId,
      itemType: isEpisodeRecord ? 'episode' : getItemType(item),
      progress,
      updatedAt: new Date().toISOString(),
    }

    const nextRecords = [
      nextRecord,
      ...continueWatchingRecords.filter((record) => record.itemId !== normalizedItemId),
    ].slice(0, 24)

    setContinueWatchingRecords(nextRecords)

    if (supabase && user) {
      try {
        await syncContinueWatchingRecord(nextRecord)
      } catch (error) {
        console.error('Unable to sync continue watching.', error)
        setAuthMessage(
          'Continue watching is saving locally. Add the Supabase tables from supabase/schema.sql to sync it to your account.'
        )
      }
    }

    return true
  }

  const signInWithEmail = async ({ email, password }) => {
    setAuthError('')

    if (!hasSupabaseConfig) {
      const nextAccount = loadDemoAccounts().find(
        (account) => account.email.toLowerCase() === email.toLowerCase() && account.password === password
      )

      if (!nextAccount) {
        setAuthError('That local demo account could not be found.')
        return
      }

      saveDemoSessionOwnerId(nextAccount.id)
      setUser({
        email: nextAccount.email,
        id: nextAccount.id,
        user_metadata: {
          display_name: nextAccount.displayName,
        },
      })
      applyLocalStore(nextAccount.id, {
        displayName: nextAccount.displayName,
        email: nextAccount.email,
      })
      closeAuthModal()
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    closeAuthModal()
  }

  const signUpWithEmail = async ({ displayName, email, password }) => {
    setAuthError('')

    if (!hasSupabaseConfig) {
      const existingAccounts = loadDemoAccounts()
      const accountExists = existingAccounts.some(
        (account) => account.email.toLowerCase() === email.toLowerCase()
      )

      if (accountExists) {
        setAuthError('A local demo account with that email already exists.')
        return
      }

      const nextAccount = {
        displayName,
        email,
        id: crypto.randomUUID(),
        password,
      }

      saveDemoAccounts([...existingAccounts, nextAccount])
      saveDemoSessionOwnerId(nextAccount.id)
      setUser({
        email: nextAccount.email,
        id: nextAccount.id,
        user_metadata: {
          display_name: nextAccount.displayName,
        },
      })
      applyLocalStore(nextAccount.id, {
        displayName: nextAccount.displayName,
        email: nextAccount.email,
      })
      closeAuthModal()
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
        emailRedirectTo: getAuthRedirectUrl('/'),
      },
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    try {
      await upsertCloudProfile(data.user, displayName)
    } catch (profileError) {
      console.error('Unable to create profile row.', profileError)
    }

    setAuthMessage('Check your email to confirm the account, then sign in.')
    setAuthMode('sign-in')
  }

  const signInWithProvider = async (provider) => {
    setAuthError('')

    if (!hasSupabaseConfig) {
      setAuthError(`${provider} sign-in needs Supabase credentials in .env.`)
      return
    }

    const { error } = await supabase.auth.signInWithOAuth({
      options: {
        redirectTo: getAuthRedirectUrl('/'),
      },
      provider,
    })

    if (error) {
      setAuthError(error.message)
    }
  }

  const requestPasswordReset = async (email) => {
    setAuthError('')

    if (!hasSupabaseConfig) {
      setAuthError('Password reset needs Supabase credentials in .env.')
      return
    }

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setAuthError('Enter your email first so we know where to send the reset link.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: getAuthRedirectUrl('/reset-password'),
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    setAuthMessage('Check your email for the password reset link.')
  }

  const updatePassword = async (password) => {
    setAuthError('')

    if (!hasSupabaseConfig) {
      setAuthError('Password updates need Supabase credentials in .env.')
      return false
    }

    const trimmedPassword = password.trim()

    if (trimmedPassword.length < 8) {
      setAuthError('Use at least 8 characters for the new password.')
      return false
    }

    const { error } = await supabase.auth.updateUser({
      password: trimmedPassword,
    })

    if (error) {
      setAuthError(error.message)
      return false
    }

    setAuthMessage('Password updated. You can use the new password the next time you sign in.')
    return true
  }

  const signOut = async () => {
    if (!hasSupabaseConfig) {
      saveDemoSessionOwnerId(null)
      setSignedOutState()
      return
    }

    await supabase.auth.signOut()
    setSignedOutState()
  }

  const updateDisplayName = async (displayName) => {
    const trimmedName = displayName.trim()

    if (!trimmedName) {
      return
    }

    const nextProfile = {
      ...profile,
      displayName: trimmedName,
    }

    setProfile(nextProfile)

    if (!hasSupabaseConfig) {
      if (user) {
        const nextAccounts = loadDemoAccounts().map((account) =>
          account.id === user.id
            ? {
                ...account,
                displayName: trimmedName,
              }
            : account
        )

        saveDemoAccounts(nextAccounts)
        setUser({
          ...user,
          user_metadata: {
            ...user.user_metadata,
            display_name: trimmedName,
          },
        })
      }

      return
    }

    try {
      await upsertCloudProfile(user, trimmedName)
    } catch (error) {
      console.error('Unable to update profile.', error)
      setAuthMessage(
        'Display name changed locally. Add the Supabase tables from supabase/schema.sql to sync it to your account.'
      )
    }
  }

  const value = {
    authError,
    authMessage,
    authMode,
    closeAuthModal,
    continueWatchingItems,
    favoriteItems,
    getPlaybackProgress: (itemId, fallback = 0) =>
      playbackProgressById.has(itemId) ? playbackProgressById.get(itemId) : fallback,
    hasSupabaseConfig,
    isAuthModalOpen,
    isFavorite: (itemId) => favoriteRecords.some((record) => record.itemId === itemId),
    isLoading,
    isSignedIn,
    openAuthModal,
    profile,
    saveContinueWatching,
    session,
    setAuthMode,
    requestPasswordReset,
    signInWithEmail,
    signInWithProvider,
    signOut,
    signUpWithEmail,
    toggleFavorite,
    updatePassword,
    updateDisplayName,
    user,
  }

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const context = useContext(AccountContext)

  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider.')
  }

  return context
}
