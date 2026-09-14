export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Genre {
  id: number;
  name: string;
}

export interface WatchOption {
  provider_key: string;
  provider_name: string;
  watch_url: string;
  badge_bg: string;
  badge_text: string;
  badge_border: string;
  button_bg: string;
  button_text: string;
  stream_type: string;
}

export interface Title {
  id: number;
  tmdb_id?: number;
  title: string;
  original_title?: string;
  type: string;
  overview?: string;
  release_date?: string;
  runtime_minutes?: number;
  vote_average: number;
  vote_count: number;
  popularity: number;
  poster_path?: string;
  backdrop_path?: string;
  director?: string;
  cast_members?: string;
  keywords?: string;
  ott_providers?: string;
  genres: Genre[];
  watch_options?: WatchOption[];
}


export interface TitleDetail extends Title {
  similar_titles: Title[];
}

export interface TitleListResponse {
  total: number;
  items: Title[];
}

export interface SearchParams {
  q?: string;
  type?: string;
  genre?: string;
  min_rating?: number;
  sort_by?: 'popularity' | 'rating' | 'newest';
  skip?: number;
  limit?: number;
}

export interface UserTitle {
  id: number;
  user_id: number;
  title_id: number;
  watched: boolean;
  rating?: number | null;
  rating_reason?: string | null;
  review?: string | null;
  created_at?: string;
  title: Title;
}

export interface WatchlistItem {
  id: number;
  user_id: number;
  title_id: number;
  notes?: string | null;
  created_at?: string;
  title: Title;
}

export interface TitleInteractionStatus {
  title_id: number;
  is_watched: boolean;
  user_rating?: number | null;
  rating_reason?: string | null;
  in_watchlist: boolean;
}

export interface GenreAffinity {
  genre: string;
  count: number;
}

export interface TasteProfile {
  total_watched: number;
  total_rated: number;
  average_rating: number;
  favorite_genres: GenreAffinity[];
  top_rated_titles: Title[];
}

export interface RecommendationItem {
  title: Title;
  score: number;
  explanation: string;
  match_reasons: string[];
}

export interface RateTitlePayload {
  title_id: number;
  rating?: number | null;
  rating_reason?: string | null;
  review?: string | null;
  watched?: boolean;
}

export interface ToggleWatchedPayload {
  title_id: number;
  watched: boolean;
}

export interface ToggleWatchlistPayload {
  title_id: number;
  notes?: string | null;
}

export interface DecisionContext {
  format?: 'movie' | 'series' | 'either';
  max_runtime?: number;
  mood?: string;
  situation?: string;
  novelty?: 'familiar' | 'balanced' | 'adventurous';
  region?: 'all' | 'bollywood' | 'hollywood';
  ott_platform?: 'all' | 'netflix' | 'prime' | 'hotstar';
  cycle_offset?: number;
  rejected_title_ids?: number[];
  feedback?: string;
}

export interface DecisionItem {
  title: Title;
  tier: 'best_match' | 'safe_choice' | 'wildcard' | 'consensus_pick' | 'compromise_choice' | 'group_wildcard' | string;
  score: number;
  explanation: string;
  match_reasons: string[];
  log_id?: number | null;
}

export interface DecisionResponse {
  best_match?: DecisionItem | null;
  safe_choice?: DecisionItem | null;
  wildcard?: DecisionItem | null;
  context_summary: string;
  total_candidates: number;
}

export interface DecisionFeedbackPayload {
  log_id?: number | null;
  title_id: number;
  feedback: string;
  context?: DecisionContext;
}

export interface GroupMemberSummary {
  id: number;
  username: string;
  email: string;
  taste_genres: string[];
  is_friend?: boolean;
}

export interface GroupDecisionRequest {
  user_ids: number[];
  format?: 'movie' | 'series' | 'either';
  max_runtime?: number;
  mood?: string;
  situation?: string;
  region?: 'all' | 'bollywood' | 'hollywood';
  ott_platform?: 'all' | 'netflix' | 'prime' | 'hotstar';
  cycle_offset?: number;
}

export interface GroupDecisionResponse {
  consensus_pick?: DecisionItem | null;
  compromise_choice?: DecisionItem | null;
  group_wildcard?: DecisionItem | null;
  group_members: GroupMemberSummary[];
  consensus_genres: string[];
  context_summary: string;
  total_candidates: number;
}

// Phase 6: Friends System Types
export interface FriendSummary {
  id: number;
  username: string;
  email: string;
  taste_genres: string[];
  total_watched: number;
  average_rating: number;
}

export interface FriendUserSearchItem {
  id: number;
  username: string;
  email: string;
  is_friend: boolean;
  relationship_status: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  taste_genres: string[];
}

export interface FriendRequestItem {
  request_id: number;
  user_id: number;
  username: string;
  email: string;
  taste_genres: string[];
  created_at?: string | null;
}

export interface FriendRequestsListResponse {
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
}


export interface FriendWatchedTitleItem {
  title_id: number;
  title: string;
  poster_path?: string | null;
  vote_average: number;
  rating?: number | null;
  rating_reason?: string | null;
  review?: string | null;
  watched: boolean;
}

export interface FriendGenreAffinity {
  genre: string;
  count: number;
}

export interface FriendProfile {
  id: number;
  username: string;
  email: string;
  total_watched: number;
  total_rated: number;
  average_rating: number;
  favorite_genres: FriendGenreAffinity[];
  recent_watched: FriendWatchedTitleItem[];
  top_rated: FriendWatchedTitleItem[];
}

export interface FriendWatchStatusItem {
  friend_id: number;
  friend_username: string;
  rating?: number | null;
  rating_reason?: string | null;
  watched: boolean;
}

export interface FriendsWatchedSummaryResponse {
  summary: Record<number, FriendWatchStatusItem[]>;
}



