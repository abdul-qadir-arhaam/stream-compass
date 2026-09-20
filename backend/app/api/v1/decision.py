from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.decision import (
    DecisionContextRequest,
    DecisionResponse,
    DecisionFeedbackRequest,
    DecisionItemResponse,
    GroupDecisionRequest,
    GroupDecisionResponse,
    GroupMemberSummary,
)

from app.services.recommender import recommender

router = APIRouter()


@router.post("/recommend", response_model=DecisionResponse)
def get_decision_recommendations(
    payload: DecisionContextRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Core Decision Engine: What Should I Watch?
    Calculates the contextual decision triad: Best Match, Safe Choice, and Wildcard.
    """
    result = recommender.get_decision_engine_recommendations(
        user=current_user,
        context=payload,
        db=db,
    )

    best_match = (
        DecisionItemResponse(**result["best_match"].to_dict())
        if result.get("best_match")
        else None
    )
    safe_choice = (
        DecisionItemResponse(**result["safe_choice"].to_dict())
        if result.get("safe_choice")
        else None
    )
    wildcard = (
        DecisionItemResponse(**result["wildcard"].to_dict())
        if result.get("wildcard")
        else None
    )

    return DecisionResponse(
        best_match=best_match,
        safe_choice=safe_choice,
        wildcard=wildcard,
        context_summary=result["context_summary"],
        total_candidates=result["total_candidates"],
    )


@router.post("/feedback", response_model=DecisionResponse)
def submit_decision_feedback_and_rerank(
    payload: DecisionFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Process rejection feedback and immediately rerank candidate recommendations.
    """
    # 1. Record feedback in recommendation log
    recommender.record_decision_feedback(
        user=current_user,
        payload=payload,
        db=db,
    )

    # 2. Context setup for reranking
    context = payload.context or DecisionContextRequest()
    # Ensure rejected title is added to exclusion list
    if payload.title_id not in context.rejected_title_ids:
        context.rejected_title_ids.append(payload.title_id)
    # Set the feedback tag
    context.feedback = payload.feedback

    # 3. Rerank
    result = recommender.get_decision_engine_recommendations(
        user=current_user,
        context=context,
        db=db,
    )

    best_match = (
        DecisionItemResponse(**result["best_match"].to_dict())
        if result.get("best_match")
        else None
    )
    safe_choice = (
        DecisionItemResponse(**result["safe_choice"].to_dict())
        if result.get("safe_choice")
        else None
    )
    wildcard = (
        DecisionItemResponse(**result["wildcard"].to_dict())
        if result.get("wildcard")
        else None
    )

    return DecisionResponse(
        best_match=best_match,
        safe_choice=safe_choice,
        wildcard=wildcard,
        context_summary=result["context_summary"],
        total_candidates=result["total_candidates"],
    )


from sqlalchemy import or_
from app.models.friendship import Friendship

@router.get("/users", response_model=list[GroupMemberSummary])
def get_available_group_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch other users in the system to invite to Group Mode, prioritizing connected friends.
    Strictly excludes synthetic peer bot accounts.
    """
    friendships = (
        db.query(Friendship)
        .filter(
            or_(
                Friendship.user_id == current_user.id,
                Friendship.friend_id == current_user.id,
            ),
            Friendship.status == "accepted",
        )
        .all()
    )
    friend_ids = {
        f.friend_id if f.user_id == current_user.id else f.user_id
        for f in friendships
    }

    other_users = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            ~User.username.like("cinephile_peer_%"),
            ~User.email.like("%@compass.internal"),
        )
        .order_by(User.username.asc())
        .limit(50)
        .all()
    )

    # Sort friends first
    sorted_users = sorted(
        other_users,
        key=lambda u: (0 if u.id in friend_ids else 1, u.username.lower())
    )

    result = []
    for u in sorted_users:
        # Get up to 3 top genres
        taste_weights = recommender.get_user_taste_weights(u, db)
        top_genres = []
        if taste_weights:
            from app.models.title import Genre
            top_gids = sorted(taste_weights.items(), key=lambda x: x[1], reverse=True)[:3]
            for gid, _ in top_gids:
                g_obj = db.query(Genre).filter(Genre.id == gid).first()
                if g_obj:
                    top_genres.append(g_obj.name)
        result.append(
            GroupMemberSummary(
                id=u.id,
                username=u.username,
                email=u.email,
                taste_genres=top_genres,
                is_friend=(u.id in friend_ids),
            )
        )
    return result



@router.post("/group", response_model=GroupDecisionResponse)
def get_group_recommendations(
    payload: GroupDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Phase 5 Group Mode:
    Combine preferences from current user + specified user_ids to find consensus, compromise, and group wildcard titles.
    Excludes titles already watched by ANY group member.
    """
    invited_users = (
        db.query(User)
        .filter(User.id.in_(payload.user_ids))
        .all()
    )
    # Combine current user with invited users, ensuring no duplicates
    all_users = [current_user]
    for u in invited_users:
        if u.id != current_user.id:
            all_users.append(u)

    result = recommender.get_group_decision_recommendations(
        users=all_users,
        context=payload,
        db=db,
    )

    consensus_pick = (
        DecisionItemResponse(**result["consensus_pick"].to_dict())
        if result.get("consensus_pick")
        else None
    )
    compromise_choice = (
        DecisionItemResponse(**result["compromise_choice"].to_dict())
        if result.get("compromise_choice")
        else None
    )
    group_wildcard = (
        DecisionItemResponse(**result["group_wildcard"].to_dict())
        if result.get("group_wildcard")
        else None
    )

    return GroupDecisionResponse(
        consensus_pick=consensus_pick,
        compromise_choice=compromise_choice,
        group_wildcard=group_wildcard,
        group_members=[GroupMemberSummary(**m) for m in result.get("group_members", [])],
        consensus_genres=result.get("consensus_genres", []),
        context_summary=result.get("context_summary", ""),
        total_candidates=result.get("total_candidates", 0),
    )

