import type {
  AuthResponse,
  Title,
  TitleDetail,
  TitleListResponse,
  Genre,
  SearchParams,
  User,
  UserTitle,
  WatchlistItem,
  TitleInteractionStatus,
  TasteProfile,
  RecommendationItem,
  RateTitlePayload,
  ToggleWatchedPayload,
  ToggleWatchlistPayload,
  DecisionContext,
  DecisionResponse,
  DecisionFeedbackPayload,
  GroupMemberSummary,
  GroupDecisionRequest,
  GroupDecisionResponse,
  FriendSummary,
  FriendUserSearchItem,
  FriendProfile,
  FriendWatchStatusItem,
  FriendsWatchedSummaryResponse,
  FriendRequestsListResponse,
} from '../types';



const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';


export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('stream_compass_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = response.statusText;
    }
    throw new ApiError(response.status, errorDetail);
  }
  if (response.status === 204) {
    return null as unknown as T;
  }
  return response.json();
}

export const api = {
  // Health
  checkHealth: async (): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE_URL}/health`);
    return handleResponse(res);
  },

  // Auth
  signup: async (payload: { email: string; username: string; password: string }): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<AuthResponse>(res);
  },

  login: async (payload: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<AuthResponse>(res);
  },

  getMe: async (): Promise<User> => {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<User>(res);
  },

  // Titles & Discovery
  getStarterTitles: async (limit = 8): Promise<Title[]> => {
    const res = await fetch(`${API_BASE_URL}/titles/starter?limit=${limit}`);
    return handleResponse<Title[]>(res);
  },

  getGenres: async (): Promise<Genre[]> => {
    const res = await fetch(`${API_BASE_URL}/titles/genres`);
    return handleResponse<Genre[]>(res);
  },

  searchTitles: async (params: SearchParams = {}): Promise<TitleListResponse> => {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.type) query.append('type', params.type);
    if (params.genre) query.append('genre', params.genre);
    if (params.min_rating !== undefined) query.append('min_rating', params.min_rating.toString());
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());

    const res = await fetch(`${API_BASE_URL}/titles/search?${query.toString()}`);
    return handleResponse<TitleListResponse>(res);
  },

  getTitleDetails: async (id: number): Promise<TitleDetail> => {
    const res = await fetch(`${API_BASE_URL}/titles/${id}`);
    return handleResponse<TitleDetail>(res);
  },

  listTitles: async (skip = 0, limit = 20): Promise<TitleListResponse> => {
    const res = await fetch(`${API_BASE_URL}/titles/?skip=${skip}&limit=${limit}`);
    return handleResponse<TitleListResponse>(res);
  },

  // Phase 3: Library, Ratings, Watchlist, Profile, Recommendations
  rateTitle: async (payload: RateTitlePayload): Promise<UserTitle> => {
    const res = await fetch(`${API_BASE_URL}/library/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<UserTitle>(res);
  },

  toggleWatched: async (payload: ToggleWatchedPayload): Promise<UserTitle> => {
    const res = await fetch(`${API_BASE_URL}/library/watched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<UserTitle>(res);
  },

  getWatched: async (): Promise<UserTitle[]> => {
    const res = await fetch(`${API_BASE_URL}/library/watched`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<UserTitle[]>(res);
  },

  removeWatched: async (titleId: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/library/watched/${titleId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<void>(res);
  },

  toggleWatchlist: async (payload: ToggleWatchlistPayload): Promise<WatchlistItem> => {
    const res = await fetch(`${API_BASE_URL}/library/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<WatchlistItem>(res);
  },

  getWatchlist: async (): Promise<WatchlistItem[]> => {
    const res = await fetch(`${API_BASE_URL}/library/watchlist`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<WatchlistItem[]>(res);
  },

  markWatchlistWatched: async (titleId: number): Promise<UserTitle> => {
    const res = await fetch(`${API_BASE_URL}/library/watchlist/${titleId}/watched`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<UserTitle>(res);
  },

  getTitleStatus: async (titleId: number): Promise<TitleInteractionStatus> => {
    const res = await fetch(`${API_BASE_URL}/library/status/${titleId}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<TitleInteractionStatus>(res);
  },

  getTasteProfile: async (): Promise<TasteProfile> => {
    const res = await fetch(`${API_BASE_URL}/library/profile`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<TasteProfile>(res);
  },

  getRecommendations: async (limit = 8): Promise<RecommendationItem[]> => {
    const res = await fetch(`${API_BASE_URL}/library/recommendations?limit=${limit}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<RecommendationItem[]>(res);
  },

  // Phase 4: Core Decision Engine
  getDecision: async (context: DecisionContext = {}): Promise<DecisionResponse> => {
    const res = await fetch(`${API_BASE_URL}/decision/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(context),
    });
    return handleResponse<DecisionResponse>(res);
  },

  submitDecisionFeedback: async (payload: DecisionFeedbackPayload): Promise<DecisionResponse> => {
    const res = await fetch(`${API_BASE_URL}/decision/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<DecisionResponse>(res);
  },

  // Phase 5: Group Mode
  getGroupUsers: async (): Promise<GroupMemberSummary[]> => {
    const res = await fetch(`${API_BASE_URL}/decision/users`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<GroupMemberSummary[]>(res);
  },

  getGroupDecision: async (payload: GroupDecisionRequest): Promise<GroupDecisionResponse> => {
    const res = await fetch(`${API_BASE_URL}/decision/group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<GroupDecisionResponse>(res);
  },

  // Phase 6: Friends & Social Discovery
  getFriends: async (): Promise<FriendSummary[]> => {
    const res = await fetch(`${API_BASE_URL}/friends/`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<FriendSummary[]>(res);
  },

  searchUsers: async (q = ''): Promise<FriendUserSearchItem[]> => {
    const res = await fetch(`${API_BASE_URL}/friends/search?q=${encodeURIComponent(q)}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<FriendUserSearchItem[]>(res);
  },

  getFriendRequests: async (): Promise<FriendRequestsListResponse> => {
    const res = await fetch(`${API_BASE_URL}/friends/requests`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<FriendRequestsListResponse>(res);
  },

  sendFriendRequest: async (friendId: number): Promise<{ message: string; status: string }> => {
    const res = await fetch(`${API_BASE_URL}/friends/request/${friendId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string; status: string }>(res);
  },

  acceptFriendRequest: async (requestId: number): Promise<{ message: string; friend_id: number }> => {
    const res = await fetch(`${API_BASE_URL}/friends/requests/${requestId}/accept`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string; friend_id: number }>(res);
  },

  declineFriendRequest: async (requestId: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE_URL}/friends/requests/${requestId}/decline`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  cancelFriendRequest: async (requestId: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE_URL}/friends/requests/${requestId}/cancel`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  addFriend: async (friendId: number): Promise<FriendSummary> => {
    const res = await fetch(`${API_BASE_URL}/friends/${friendId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<FriendSummary>(res);
  },

  removeFriend: async (friendId: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/friends/${friendId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<void>(res);
  },

  getFriendTasteProfile: async (friendId: number): Promise<FriendProfile> => {
    const res = await fetch(`${API_BASE_URL}/friends/${friendId}/taste`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<FriendProfile>(res);
  },

  getFriendsWatchedSummary: async (): Promise<Record<number, FriendWatchStatusItem[]>> => {
    const res = await fetch(`${API_BASE_URL}/friends/watched-summary`, {
      headers: { ...getAuthHeader() },
    });
    const data = await handleResponse<FriendsWatchedSummaryResponse>(res);
    return data.summary || {};
  },

  // TMDB Catalog Sync

  getSyncStatus: async (): Promise<{ tmdb_configured: boolean; message: string }> => {
    const res = await fetch(`${API_BASE_URL}/sync/status`);
    return handleResponse<{ tmdb_configured: boolean; message: string }>(res);
  },

  triggerSync: async (pages = 2): Promise<{ status: string; message?: string; synced_titles?: number; total_catalog_size?: number }> => {
    const res = await fetch(`${API_BASE_URL}/sync/tmdb?pages=${pages}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ status: string; message?: string; synced_titles?: number; total_catalog_size?: number }>(res);
  },
};

