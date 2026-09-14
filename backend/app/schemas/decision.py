from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.title import TitleSchema


class DecisionContextRequest(BaseModel):
    format: Optional[str] = Field("either", description="movie, series, or either")
    max_runtime: Optional[int] = Field(None, ge=30, le=360, description="Max runtime in minutes")
    mood: Optional[str] = Field(None, description="e.g., chill, mind_bending, action_packed, dark_suspense, feel_good, deep_drama")
    situation: Optional[str] = Field(None, description="e.g., solo, date_night, friends, family")
    novelty: Optional[str] = Field("balanced", description="familiar, balanced, or adventurous")
    region: Optional[str] = Field("all", description="all, bollywood, or hollywood")
    ott_platform: Optional[str] = Field("all", description="all, netflix, prime, or hotstar")
    cycle_offset: Optional[int] = Field(0, description="Rotation offset for recalculating decisions")
    rejected_title_ids: List[int] = Field(default_factory=list, description="IDs of rejected titles to exclude from rerank")
    feedback: Optional[str] = Field(None, description="too_long, too_serious, predictable, wrong_genre, not_in_mood, want_something_different")


class DecisionItemResponse(BaseModel):
    title: TitleSchema
    tier: str  # "best_match", "safe_choice", "wildcard"
    score: float
    explanation: str
    match_reasons: List[str] = []
    log_id: Optional[int] = None


class DecisionResponse(BaseModel):
    best_match: Optional[DecisionItemResponse] = None
    safe_choice: Optional[DecisionItemResponse] = None
    wildcard: Optional[DecisionItemResponse] = None
    context_summary: str
    total_candidates: int


class DecisionFeedbackRequest(BaseModel):
    log_id: Optional[int] = None
    title_id: int
    feedback: str = Field(..., description="too_long, too_serious, predictable, wrong_genre, not_in_mood, want_something_different")
    context: Optional[DecisionContextRequest] = None


class GroupDecisionRequest(BaseModel):
    user_ids: List[int] = Field(..., description="IDs of other users joining the group decision")
    format: Optional[str] = Field("either", description="movie, series, or either")
    max_runtime: Optional[int] = Field(None, ge=30, le=360, description="Max runtime in minutes")
    mood: Optional[str] = Field(None, description="Shared mood: chill, mind_bending, action_packed, dark_suspense, feel_good, deep_drama")
    situation: Optional[str] = Field("friends", description="friends, date_night, family")
    region: Optional[str] = Field("all", description="all, bollywood, or hollywood")
    ott_platform: Optional[str] = Field("all", description="all, netflix, prime, or hotstar")
    cycle_offset: Optional[int] = Field(0, description="Cycle offset for rerolling recommendations")


class GroupMemberSummary(BaseModel):
    id: int
    username: str
    email: str
    taste_genres: List[str] = []
    is_friend: bool = False



class GroupDecisionResponse(BaseModel):
    consensus_pick: Optional[DecisionItemResponse] = None
    compromise_choice: Optional[DecisionItemResponse] = None
    group_wildcard: Optional[DecisionItemResponse] = None
    group_members: List[GroupMemberSummary] = []
    consensus_genres: List[str] = []
    context_summary: str
    total_candidates: int

