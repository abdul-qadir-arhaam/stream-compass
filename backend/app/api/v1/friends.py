from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.friendship import Friendship
from app.models.library import UserTitle
from app.models.title import Title, Genre
from app.services.recommender import recommender
from app.schemas.friend import (
    FriendSummarySchema,
    FriendUserSearchItem,
    FriendRequestItem,
    FriendRequestsListResponse,
    FriendProfileSchema,
    FriendGenreAffinity,
    FriendWatchedTitleItem,
    FriendWatchStatusItem,
    FriendsWatchedSummaryResponse,
)

router = APIRouter()


def _get_user_taste_genres(user: User, db: Session, limit: int = 3) -> List[str]:
    """Helper to extract top taste genres for a user."""
    weights = recommender.get_user_taste_weights(user, db)
    if not weights:
        return []
    top_gids = sorted(weights.items(), key=lambda x: x[1], reverse=True)[:limit]
    top_names = []
    for gid, _ in top_gids:
        g = db.query(Genre).filter(Genre.id == gid).first()
        if g:
            top_names.append(g.name)
    return top_names


@router.get("/", response_model=List[FriendSummarySchema])
def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all friends connected with the current user."""
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
    friends_list = []
    seen_ids = set()
    for f in friendships:
        target_friend_id = f.friend_id if f.user_id == current_user.id else f.user_id
        if target_friend_id in seen_ids:
            continue
        seen_ids.add(target_friend_id)
        friend_user = db.query(User).filter(User.id == target_friend_id).first()
        if not friend_user:
            continue

        # Get metrics
        interactions = (
            db.query(UserTitle)
            .filter(UserTitle.user_id == friend_user.id)
            .all()
        )
        watched_count = sum(1 for i in interactions if i.watched)
        rated = [i.rating for i in interactions if i.rating is not None]
        avg_rating = round(sum(rated) / len(rated), 1) if rated else 0.0
        taste_genres = _get_user_taste_genres(friend_user, db)

        friends_list.append(
            FriendSummarySchema(
                id=friend_user.id,
                username=friend_user.username,
                email=friend_user.email,
                taste_genres=taste_genres,
                total_watched=watched_count,
                average_rating=avg_rating,
            )
        )
    return friends_list


@router.get("/requests", response_model=FriendRequestsListResponse)
def get_friend_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List pending incoming and outgoing friend requests."""
    # Incoming: requests sent to current_user
    incoming_records = (
        db.query(Friendship)
        .filter(Friendship.friend_id == current_user.id, Friendship.status == "pending")
        .all()
    )
    incoming_list = []
    for f in incoming_records:
        sender = db.query(User).filter(User.id == f.user_id).first()
        if sender:
            incoming_list.append(
                FriendRequestItem(
                    request_id=f.id,
                    user_id=sender.id,
                    username=sender.username,
                    email=sender.email,
                    taste_genres=_get_user_taste_genres(sender, db),
                    created_at=f.created_at.isoformat() if hasattr(f, "created_at") and f.created_at else None,
                )
            )

    # Outgoing: requests sent by current_user
    outgoing_records = (
        db.query(Friendship)
        .filter(Friendship.user_id == current_user.id, Friendship.status == "pending")
        .all()
    )
    outgoing_list = []
    for f in outgoing_records:
        recipient = db.query(User).filter(User.id == f.friend_id).first()
        if recipient:
            outgoing_list.append(
                FriendRequestItem(
                    request_id=f.id,
                    user_id=recipient.id,
                    username=recipient.username,
                    email=recipient.email,
                    taste_genres=_get_user_taste_genres(recipient, db),
                    created_at=f.created_at.isoformat() if hasattr(f, "created_at") and f.created_at else None,
                )
            )

    return FriendRequestsListResponse(
        incoming=incoming_list,
        outgoing=outgoing_list,
    )


@router.get("/search", response_model=List[FriendUserSearchItem])
def search_users_to_add(
    q: str = Query("", description="Search term for username or email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search registered users to connect with as friends."""
    term = f"%{q.strip()}%" if q else "%"
    users_query = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            ~User.username.like("cinephile_peer_%"),
            ~User.email.like("%@compass.internal"),
        )
    )
    if q and q.strip():
        users_query = users_query.filter(
            or_(
                User.username.ilike(term),
                User.email.ilike(term),
            )
        )
    candidate_users = users_query.order_by(User.username.asc()).limit(30).all()

    # Get all friendships involving current_user
    user_friendships = (
        db.query(Friendship)
        .filter(
            or_(
                Friendship.user_id == current_user.id,
                Friendship.friend_id == current_user.id,
            )
        )
        .all()
    )

    # Map target user_id -> status
    # status could be "accepted", "pending_sent" (user_id=current_user), "pending_received" (friend_id=current_user)
    relation_map: Dict[int, str] = {}
    for f in user_friendships:
        if f.status == "accepted":
            target_id = f.friend_id if f.user_id == current_user.id else f.user_id
            relation_map[target_id] = "friends"
        elif f.status == "pending":
            if f.user_id == current_user.id:
                relation_map[f.friend_id] = "pending_sent"
            else:
                relation_map[f.user_id] = "pending_received"

    results = []
    for u in candidate_users:
        status_val = relation_map.get(u.id, "none")
        taste_genres = _get_user_taste_genres(u, db)
        results.append(
            FriendUserSearchItem(
                id=u.id,
                username=u.username,
                email=u.email,
                is_friend=(status_val == "friends"),
                relationship_status=status_val,
                taste_genres=taste_genres,
            )
        )
    return results


@router.post("/request/{friend_id}")
def send_friend_request(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a friend request to another user."""
    if friend_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a friend request to yourself",
        )

    target_user = db.query(User).filter(User.id == friend_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check if already friends
    existing_accepted = (
        db.query(Friendship)
        .filter(
            Friendship.user_id == current_user.id,
            Friendship.friend_id == friend_id,
            Friendship.status == "accepted",
        )
        .first()
    )
    if existing_accepted:
        return {"message": "Already friends", "status": "accepted"}

    # Check if current_user already sent a pending request
    already_sent = (
        db.query(Friendship)
        .filter(
            Friendship.user_id == current_user.id,
            Friendship.friend_id == friend_id,
            Friendship.status == "pending",
        )
        .first()
    )
    if already_sent:
        return {"message": "Friend request already sent", "status": "pending_sent"}

    # Check if other user already sent a pending request to current_user -> auto accept!
    reciprocal_pending = (
        db.query(Friendship)
        .filter(
            Friendship.user_id == friend_id,
            Friendship.friend_id == current_user.id,
            Friendship.status == "pending",
        )
        .first()
    )
    if reciprocal_pending:
        reciprocal_pending.status = "accepted"
        # Ensure our reciprocal row exists
        our_row = (
            db.query(Friendship)
            .filter(
                Friendship.user_id == current_user.id,
                Friendship.friend_id == friend_id,
            )
            .first()
        )
        if our_row:
            our_row.status = "accepted"
        else:
            db.add(Friendship(user_id=current_user.id, friend_id=friend_id, status="accepted"))
        db.commit()
        return {"message": "Mutual request accepted! You are now friends.", "status": "friends"}

    # Create new pending request
    new_request = Friendship(
        user_id=current_user.id,
        friend_id=friend_id,
        status="pending",
    )
    db.add(new_request)
    db.commit()
    return {"message": "Friend request sent successfully", "status": "pending_sent"}


@router.post("/{friend_id}")
def add_friend_compat(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compatibility endpoint: sends friend request."""
    return send_friend_request(friend_id=friend_id, db=db, current_user=current_user)


@router.post("/requests/{request_id}/accept")
def accept_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept an incoming friend request."""
    req = (
        db.query(Friendship)
        .filter(
            Friendship.id == request_id,
            Friendship.friend_id == current_user.id,
            Friendship.status == "pending",
        )
        .first()
    )
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending friend request not found",
        )

    requester_id = req.user_id
    req.status = "accepted"

    # Create / update reciprocal accepted relationship
    reciprocal = (
        db.query(Friendship)
        .filter(
            Friendship.user_id == current_user.id,
            Friendship.friend_id == requester_id,
        )
        .first()
    )
    if reciprocal:
        reciprocal.status = "accepted"
    else:
        db.add(Friendship(user_id=current_user.id, friend_id=requester_id, status="accepted"))

    db.commit()
    return {"message": "Friend request accepted", "friend_id": requester_id}


@router.post("/requests/{request_id}/decline")
def decline_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Decline an incoming friend request."""
    req = (
        db.query(Friendship)
        .filter(
            Friendship.id == request_id,
            Friendship.friend_id == current_user.id,
            Friendship.status == "pending",
        )
        .first()
    )
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending friend request not found",
        )

    db.delete(req)
    db.commit()
    return {"message": "Friend request declined"}


@router.delete("/requests/{request_id}/cancel")
def cancel_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel an outgoing friend request."""
    req = (
        db.query(Friendship)
        .filter(
            Friendship.id == request_id,
            Friendship.user_id == current_user.id,
            Friendship.status == "pending",
        )
        .first()
    )
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending outgoing friend request not found",
        )

    db.delete(req)
    db.commit()
    return {"message": "Friend request cancelled"}



@router.delete("/{friend_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_friend(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove friendship link with another user."""
    db.query(Friendship).filter(
        or_(
            (Friendship.user_id == current_user.id) & (Friendship.friend_id == friend_id),
            (Friendship.user_id == friend_id) & (Friendship.friend_id == current_user.id),
        )
    ).delete(synchronize_session=False)
    db.commit()
    return None


@router.get("/{friend_id}/taste", response_model=FriendProfileSchema)
def get_friend_taste_profile(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Inspect a friend's full Taste DNA, favorite genres, top rated titles, and recent watched titles.
    """
    friend_user = db.query(User).filter(User.id == friend_id).first()
    if not friend_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend not found",
        )

    # Fetch friend's library entries
    interactions = (
        db.query(UserTitle)
        .filter(UserTitle.user_id == friend_id)
        .order_by(desc(UserTitle.updated_at))
        .all()
    )

    watched_items = [i for i in interactions if i.watched]
    rated_items = [i for i in interactions if i.rating is not None]
    avg_rating = round(sum(i.rating for i in rated_items) / len(rated_items), 1) if rated_items else 0.0

    # Genre affinity breakdown
    genre_counts: Dict[str, int] = {}
    for item in watched_items:
        if item.title:
            for g in item.title.genres:
                genre_counts[g.name] = genre_counts.get(g.name, 0) + 1

    sorted_genres = [
        FriendGenreAffinity(genre=k, count=v)
        for k, v in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:6]
    ]

    # Recent watched titles
    recent_watched = []
    for item in watched_items[:12]:
        if item.title:
            recent_watched.append(
                FriendWatchedTitleItem(
                    title_id=item.title.id,
                    title=item.title.title,
                    poster_path=item.title.poster_path,
                    vote_average=item.title.vote_average,
                    rating=item.rating,
                    rating_reason=item.rating_reason,
                    review=item.review,
                    watched=item.watched,
                )
            )

    # Top rated titles (rating >= 4.0 or highest rated)
    top_rated_candidates = sorted(
        [i for i in rated_items if i.title],
        key=lambda x: x.rating or 0.0,
        reverse=True,
    )[:8]

    top_rated = []
    for item in top_rated_candidates:
        top_rated.append(
            FriendWatchedTitleItem(
                title_id=item.title.id,
                title=item.title.title,
                poster_path=item.title.poster_path,
                vote_average=item.title.vote_average,
                rating=item.rating,
                rating_reason=item.rating_reason,
                review=item.review,
                watched=item.watched,
            )
        )

    return FriendProfileSchema(
        id=friend_user.id,
        username=friend_user.username,
        email=friend_user.email,
        total_watched=len(watched_items),
        total_rated=len(rated_items),
        average_rating=avg_rating,
        favorite_genres=sorted_genres,
        recent_watched=recent_watched,
        top_rated=top_rated,
    )


@router.get("/watched-summary", response_model=FriendsWatchedSummaryResponse)
def get_friends_watched_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns an aggregated mapping of title_id -> list of friends who have watched/rated that title.
    Powers the 'Watched by [Friend]' badges on every movie/series plate with zero performance lag.
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
    friend_ids = list({
        f.friend_id if f.user_id == current_user.id else f.user_id
        for f in friendships
    })
    if not friend_ids:
        return FriendsWatchedSummaryResponse(summary={})

    friend_interactions = (
        db.query(UserTitle, User.username)
        .join(User, UserTitle.user_id == User.id)
        .filter(UserTitle.user_id.in_(friend_ids), UserTitle.watched == True)
        .all()
    )

    summary_map: Dict[int, List[FriendWatchStatusItem]] = {}
    for ut, username in friend_interactions:
        if ut.title_id not in summary_map:
            summary_map[ut.title_id] = []
        summary_map[ut.title_id].append(
            FriendWatchStatusItem(
                friend_id=ut.user_id,
                friend_username=username,
                rating=ut.rating,
                rating_reason=ut.rating_reason,
                watched=ut.watched,
            )
        )

    return FriendsWatchedSummaryResponse(summary=summary_map)
