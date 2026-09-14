import math
from typing import Dict, List, Tuple, Set, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.title import Title
from app.models.library import UserTitle
from app.core.security import get_password_hash


class CollaborativeFilteringService:
    """Collaborative Filtering Service implementing User-User and Item-Item algorithms.

    Computes latent taste correlation across the community rating matrix and
    provides predicted affinity scores and explainability signals for candidate titles.
    """

    @staticmethod
    def get_user_rating_vectors(db: Session) -> Dict[int, Dict[int, float]]:
        """Retrieve all explicit ratings in the database formatted as:
        { user_id: { title_id: rating } }
        """
        records = (
            db.query(UserTitle.user_id, UserTitle.title_id, UserTitle.rating)
            .filter(UserTitle.rating.isnot(None))
            .all()
        )
        user_ratings: Dict[int, Dict[int, float]] = {}
        for uid, tid, r in records:
            if r is None:
                continue
            if uid not in user_ratings:
                user_ratings[uid] = {}
            user_ratings[uid][tid] = float(r)
        return user_ratings

    @staticmethod
    def calculate_cosine_similarity(vec_a: Dict[int, float], vec_b: Dict[int, float]) -> float:
        """Compute cosine similarity between two rating dictionaries across overlapping items."""
        common_keys = set(vec_a.keys()).intersection(set(vec_b.keys()))
        if not common_keys:
            return 0.0

        dot_product = sum(vec_a[k] * vec_b[k] for k in common_keys)
        norm_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
        norm_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))

        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0

        return dot_product / (norm_a * norm_b)

    @staticmethod
    def calculate_centered_cosine(vec_a: Dict[int, float], vec_b: Dict[int, float]) -> float:
        """Pearson correlation / mean-centered cosine similarity."""
        common_keys = set(vec_a.keys()).intersection(set(vec_b.keys()))
        if len(common_keys) < 2:
            return CollaborativeFilteringService.calculate_cosine_similarity(vec_a, vec_b)

        mean_a = sum(vec_a[k] for k in common_keys) / len(common_keys)
        mean_b = sum(vec_b[k] for k in common_keys) / len(common_keys)

        num = sum((vec_a[k] - mean_a) * (vec_b[k] - mean_b) for k in common_keys)
        den_a = math.sqrt(sum((vec_a[k] - mean_a) ** 2 for k in common_keys))
        den_b = math.sqrt(sum((vec_b[k] - mean_b) ** 2 for k in common_keys))

        if den_a == 0.0 or den_b == 0.0:
            return 0.0
        return num / (den_a * den_b)

    @staticmethod
    def find_nearest_neighbors(
        target_user_id: int,
        all_user_ratings: Dict[int, Dict[int, float]],
        min_similarity: float = 0.25,
        top_k: int = 10,
    ) -> List[Tuple[int, float]]:
        """Find the top-k most similar peer users to the target user."""
        target_ratings = all_user_ratings.get(target_user_id, {})
        if not target_ratings:
            return []

        similarities: List[Tuple[int, float]] = []
        for peer_id, peer_ratings in all_user_ratings.items():
            if peer_id == target_user_id:
                continue
            sim = CollaborativeFilteringService.calculate_centered_cosine(target_ratings, peer_ratings)
            if sim >= min_similarity:
                similarities.append((peer_id, sim))

        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]

    @staticmethod
    def predict_collaborative_scores(
        user_id: int,
        candidate_title_ids: List[int],
        db: Session,
    ) -> Dict[int, Dict[str, Any]]:
        """Compute collaborative prediction and explainability for a list of candidate titles.

        Returns:
            {
                title_id: {
                    "cf_score": float (0.0 to 30.0),
                    "confidence": float (0.0 to 1.0),
                    "reason": Optional[str],
                    "similar_peers_count": int,
                }
            }
        """
        all_ratings = CollaborativeFilteringService.get_user_rating_vectors(db)
        target_ratings = all_ratings.get(user_id, {})

        # Ensure community seed exists if there is sparse user data
        if len(all_ratings) <= 1:
            CollaborativeFilteringService.seed_community_ratings_if_needed(db)
            all_ratings = CollaborativeFilteringService.get_user_rating_vectors(db)
            target_ratings = all_ratings.get(user_id, {})

        neighbors = CollaborativeFilteringService.find_nearest_neighbors(user_id, all_ratings)

        # Pre-compute titles target user loved (ratings >= 4.0) for item-level correlations
        loved_title_ids = {tid for tid, r in target_ratings.items() if r >= 4.0}

        # Build item rating mapping: { title_id: { user_id: rating } }
        item_ratings: Dict[int, Dict[int, float]] = {}
        for uid, ratings_map in all_ratings.items():
            for tid, r in ratings_map.items():
                if tid not in item_ratings:
                    item_ratings[tid] = {}
                item_ratings[tid][uid] = r

        results: Dict[int, Dict[str, Any]] = {}
        neighbor_dict = dict(neighbors)

        for tid in candidate_title_ids:
            cf_score = 0.0
            confidence = 0.0
            reasons = []
            similar_peers_count = 0

            # 1. User-User Collaborative Signal
            if tid in item_ratings and neighbors:
                rating_raters = item_ratings[tid]
                weighted_sum = 0.0
                weight_norm = 0.0

                for peer_id, sim in neighbors:
                    if peer_id in rating_raters:
                        peer_rating = rating_raters[peer_id]
                        # Normalize rating to 0-1 scale relative to 3.0 baseline
                        rating_diff = peer_rating - 2.5
                        weighted_sum += sim * rating_diff
                        weight_norm += abs(sim)
                        if peer_rating >= 4.0:
                            similar_peers_count += 1

                if weight_norm > 0:
                    normalized_user_score = (weighted_sum / weight_norm) * 5.0  # scale ~ -12.5 to +12.5
                    cf_score += max(-10.0, min(15.0, normalized_user_score))
                    confidence = min(1.0, weight_norm)

                    if similar_peers_count >= 2:
                        reasons.append(f"Rated highly by {similar_peers_count} viewers with matching taste")
                    elif similar_peers_count == 1:
                        reasons.append("Loved by viewers with similar taste profile")

            # 2. Item-Item Collaborative Signal
            # Find item-item correlation with titles the user rated highly
            if tid in item_ratings and loved_title_ids:
                cand_raters = item_ratings[tid]
                best_item_sim = 0.0
                best_source_title_id = None

                for loved_id in loved_title_ids:
                    if loved_id in item_ratings:
                        loved_raters = item_ratings[loved_id]
                        # Compute overlap
                        sim = CollaborativeFilteringService.calculate_cosine_similarity(cand_raters, loved_raters)
                        if sim > best_item_sim:
                            best_item_sim = sim
                            best_source_title_id = loved_id

                if best_item_sim >= 0.35:
                    item_boost = min(12.0, best_item_sim * 14.0)
                    cf_score += item_boost
                    if not reasons:
                        # Fetch source title name for personalized explanation
                        source_title = db.query(Title.title).filter(Title.id == best_source_title_id).first()
                        if source_title:
                            reasons.append(f"Cinephiles who loved '{source_title[0]}' also highly recommend this")
                        else:
                            reasons.append("Frequently enjoyed alongside your highest-rated titles")

            # Final normalized CF score bounded between 0.0 and 25.0
            final_cf_score = max(0.0, min(25.0, cf_score))
            results[tid] = {
                "cf_score": round(final_cf_score, 2),
                "confidence": round(confidence, 2),
                "reason": reasons[0] if reasons else None,
                "similar_peers_count": similar_peers_count,
            }

        return results

    @staticmethod
    def seed_community_ratings_if_needed(db: Session):
        """Seeds curated community cinephile user profiles with realistic ratings.

        Ensures collaborative filtering has immediate mathematical depth on fresh/local
        databases, providing realistic peer clustering across standard genres.
        """
        community_prefix = "cinephile_peer_"
        existing_count = db.query(User).filter(User.username.like(f"{community_prefix}%")).count()
        if existing_count >= 4:
            return  # Already seeded

        # Curated community archetypes
        archetypes = [
            {
                "username": f"{community_prefix}scifi",
                "email": "scifi_peer@compass.internal",
                "target_genres": ["Sci-Fi", "Mystery", "Thriller"],
            },
            {
                "username": f"{community_prefix}action",
                "email": "action_peer@compass.internal",
                "target_genres": ["Action", "Adventure", "Crime"],
            },
            {
                "username": f"{community_prefix}drama",
                "email": "drama_peer@compass.internal",
                "target_genres": ["Drama", "History", "Romance"],
            },
            {
                "username": f"{community_prefix}comedy",
                "email": "comedy_peer@compass.internal",
                "target_genres": ["Comedy", "Animation", "Family"],
            },
            {
                "username": f"{community_prefix}suspense",
                "email": "suspense_peer@compass.internal",
                "target_genres": ["Thriller", "Horror", "Mystery"],
            },
        ]

        # Fetch available titles to rate
        titles = db.query(Title).all()
        if not titles:
            return

        for arch in archetypes:
            peer_user = db.query(User).filter(User.email == arch["email"]).first()
            if not peer_user:
                peer_user = User(
                    username=arch["username"],
                    email=arch["email"],
                    hashed_password=get_password_hash("community_pass_12345"),
                    onboarding_completed=True,
                )
                db.add(peer_user)
                db.flush()

            # Add ratings for matching titles
            for t in titles:
                genre_names = {g.name for g in t.genres}
                match_count = len(genre_names.intersection(set(arch["target_genres"])))

                # Determine archetype rating
                rating_val = None
                reason_val = None
                if match_count >= 2:
                    rating_val = 5.0
                    reason_val = "Masterpiece"
                elif match_count == 1:
                    rating_val = 4.5 if t.vote_average >= 7.5 else 4.0
                    reason_val = "Brilliant Storytelling"
                elif t.vote_average >= 8.2:
                    rating_val = 4.0
                    reason_val = "Great Acting"

                if rating_val is not None:
                    # Check if already exists
                    existing_rating = (
                        db.query(UserTitle)
                        .filter(UserTitle.user_id == peer_user.id, UserTitle.title_id == t.id)
                        .first()
                    )
                    if not existing_rating:
                        db.add(
                            UserTitle(
                                user_id=peer_user.id,
                                title_id=t.id,
                                rating=rating_val,
                                rating_reason=reason_val,
                                watched=True,
                            )
                        )

        db.commit()


collaborative_service = CollaborativeFilteringService()
