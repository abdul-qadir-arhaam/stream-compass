from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.models.user import User
from app.models.title import Title, Genre
from app.models.library import UserTitle
from app.models.recommendation import RecommendationLog
from app.services.collaborative import collaborative_service



class RecommendationResult:
    def __init__(self, title: Title, score: float, explanation: str, match_reasons: List[str]):
        self.title = title
        self.score = round(score, 2)
        self.explanation = explanation
        self.match_reasons = match_reasons

    def to_dict(self) -> Dict[str, Any]:
        from app.schemas.title import TitleSchema
        from app.services.watch_providers import get_watch_options_for_title

        title_dict = TitleSchema.model_validate(self.title).model_dump()
        title_dict["watch_options"] = get_watch_options_for_title(self.title.title, self.title.ott_providers)
        return {
            "title": title_dict,
            "score": self.score,
            "explanation": self.explanation,
            "match_reasons": self.match_reasons,
        }


class DecisionTierItem:
    def __init__(
        self,
        title: Title,
        tier: str,
        score: float,
        explanation: str,
        match_reasons: List[str],
        log_id: Optional[int] = None,
    ):
        self.title = title
        self.tier = tier
        self.score = round(score, 2)
        self.explanation = explanation
        self.match_reasons = match_reasons
        self.log_id = log_id

    def to_dict(self) -> Dict[str, Any]:
        from app.schemas.title import TitleSchema
        from app.services.watch_providers import get_watch_options_for_title

        title_dict = TitleSchema.model_validate(self.title).model_dump()
        title_dict["watch_options"] = get_watch_options_for_title(self.title.title, self.title.ott_providers)
        return {
            "title": title_dict,
            "tier": self.tier,
            "score": self.score,
            "explanation": self.explanation,
            "match_reasons": self.match_reasons,
            "log_id": self.log_id,
        }



class RecommendationService:
    """Content-based, taste-weighted, and contextual decision recommendation engine."""

    MOOD_GENRE_BOOSTS = {
        "chill": ["Comedy", "Animation", "Family", "Romance"],
        "mind_bending": ["Sci-Fi", "Mystery"],
        "action_packed": ["Action", "Adventure"],
        "dark_suspense": ["Thriller", "Crime", "Mystery", "Horror"],
        "feel_good": ["Comedy", "Family", "Romance", "Animation"],
        "deep_drama": ["Drama", "History"],
    }

    # Negative genre penalties to guarantee that dark/gritty thrillers never pollute feel-good or chill
    MOOD_GENRE_PENALTIES = {
        "feel_good": ["Horror", "Crime", "War", "Thriller"],
        "chill": ["Horror", "War", "Thriller", "Crime"],
        "dark_suspense": ["Animation", "Family"],
        "mind_bending": ["Animation", "Family"],
        "action_packed": ["Romance"],
    }

    SITUATION_GENRE_BOOSTS = {
        "date_night": ["Romance", "Comedy", "Thriller", "Drama"],
        "friends": ["Comedy", "Action", "Horror", "Sci-Fi", "Adventure"],
        "family": ["Animation", "Adventure", "Comedy"],
        "solo": ["Sci-Fi", "Mystery", "Drama", "Thriller"],
    }

    @staticmethod
    def get_user_taste_weights(user: User, db: Session) -> Dict[int, float]:
        """Calculate genre weight vectors from user's rated titles."""
        user_ratings = (
            db.query(UserTitle)
            .filter(UserTitle.user_id == user.id, UserTitle.rating.isnot(None))
            .all()
        )

        genre_weights: Dict[int, float] = {}

        for ur in user_ratings:
            if not ur.title or ur.rating is None:
                continue

            diff = ur.rating - 3.0
            if diff > 0:
                multiplier = diff * 2.0
            elif diff < 0:
                multiplier = diff * 1.5
            else:
                multiplier = 0.5

            for genre in ur.title.genres:
                genre_weights[genre.id] = genre_weights.get(genre.id, 0.0) + multiplier

        return genre_weights

    @staticmethod
    def get_recommendations(
        user: User,
        db: Session,
        limit: int = 10,
        log_recs: bool = False
    ) -> List[RecommendationResult]:
        """Return personalized recommendations excluding already watched titles."""
        watched_records = (
            db.query(UserTitle.title_id)
            .filter(UserTitle.user_id == user.id, UserTitle.watched == True)
            .all()
        )
        watched_ids = {r[0] for r in watched_records}

        user_ratings = (
            db.query(UserTitle)
            .filter(UserTitle.user_id == user.id, UserTitle.rating.isnot(None))
            .all()
        )

        genre_ratings: Dict[int, List[float]] = {}
        genre_names: Dict[int, str] = {}
        favorite_directors = set()
        top_user_titles = []

        for ur in user_ratings:
            if not ur.title or ur.rating is None:
                continue
            if ur.rating >= 4.0:
                top_user_titles.append(ur.title)
                if ur.title.director:
                    favorite_directors.add(ur.title.director.strip().lower())

            for g in ur.title.genres:
                genre_names[g.id] = g.name
                if g.id not in genre_ratings:
                    genre_ratings[g.id] = []
                genre_ratings[g.id].append(ur.rating)

        genre_weights = RecommendationService.get_user_taste_weights(user, db)

        candidate_query = db.query(Title)
        if watched_ids:
            candidate_query = candidate_query.filter(~Title.id.in_(watched_ids))

        candidates = candidate_query.all()
        if not candidates:
            return []

        if not user_ratings:
            sorted_candidates = sorted(
                candidates,
                key=lambda t: (t.vote_average * 0.7 + (t.popularity / 10.0) * 0.3),
                reverse=True
            )
            results = []
            for t in sorted_candidates[:limit]:
                reasons = [
                    f"Critically acclaimed ({t.vote_average:.1f}★ rating)",
                    f"Popular among viewers"
                ]
                explanation = f"Curated masterwork matching community praise ({t.vote_average:.1f}★)."
                results.append(RecommendationResult(t, t.vote_average * 1.5, explanation, reasons))
            return results

        # Phase 6: Collaborative Filtering prediction for candidate titles
        cand_ids = [t.id for t in candidates]
        cf_preds = collaborative_service.predict_collaborative_scores(user.id, cand_ids, db)
        num_ratings = len(user_ratings)
        w_cf = 0.15 if num_ratings < 3 else (0.35 if num_ratings < 8 else 0.50)

        scored_results: List[RecommendationResult] = []

        for title in candidates:
            score = 0.0
            reasons: List[str] = []

            score += title.vote_average * 1.5
            score += min(10.0, title.popularity / 10.0)

            content_genre_score = 0.0
            matched_genres = []
            for genre in title.genres:
                g_weight = genre_weights.get(genre.id, 0.0)
                content_genre_score += g_weight * 3.0

                if genre.id in genre_ratings:
                    avg_g = sum(genre_ratings[genre.id]) / len(genre_ratings[genre.id])
                    if avg_g >= 4.0:
                        matched_genres.append((genre.name, avg_g))

            if matched_genres:
                best_g = max(matched_genres, key=lambda x: x[1])
                reasons.append(f"You rated {best_g[0]} titles highly ({best_g[1]:.1f}★ avg)")

            if title.director and title.director.strip().lower() in favorite_directors:
                score += 8.0
                reasons.append(f"Directed by {title.director}, whom you've rated highly")

            title_genre_ids = {g.id for g in title.genres}
            for top_t in top_user_titles[:3]:
                shared = title_genre_ids.intersection({g.id for g in top_t.genres})
                if len(shared) >= 2:
                    score += 4.0
                    reasons.append(f"Shares genre resonance with {top_t.title}")
                    break

            # Hybrid blend with Collaborative Filtering signal
            cf_info = cf_preds.get(title.id, {})
            cf_val = cf_info.get("cf_score", 0.0)
            cf_reason = cf_info.get("reason")

            hybrid_taste = (1.0 - w_cf) * content_genre_score + w_cf * cf_val
            score += hybrid_taste

            if cf_val >= 10.0 and cf_reason:
                reasons.append(cf_reason)

            if reasons:
                explanation = reasons[0]
            else:
                explanation = f"Strong candidate with {title.vote_average:.1f}★ audience consensus."

            scored_results.append(RecommendationResult(title, score, explanation, reasons))


        scored_results.sort(key=lambda r: r.score, reverse=True)
        top_results = scored_results[:limit]

        if log_recs:
            try:
                for rec in top_results:
                    log = RecommendationLog(
                        user_id=user.id,
                        title_id=rec.title.id,
                        tier="content_taste",
                        score=rec.score,
                        explanation=rec.explanation,
                        algorithm_version="v1_content",
                    )
                    db.add(log)
                db.commit()
            except Exception:
                db.rollback()

        return top_results

    @staticmethod
    def get_decision_engine_recommendations(
        user: User,
        context: Any,
        db: Session,
    ) -> Dict[str, Any]:
        """
        Phase 4 Core Decision Engine:
        Evaluates contextual inputs (format, time, mood, situation, novelty, feedback)
        and returns a curated decision triad:
          1. Best Match (Highest personalized contextual resonance)
          2. Safe Choice (Acclaimed low-risk consensus title)
          3. Wildcard (Adventurous or unexpected genre departure)
        """
        # 1. Fetch watched titles to strictly exclude
        watched_records = (
            db.query(UserTitle.title_id)
            .filter(UserTitle.user_id == user.id, UserTitle.watched == True)
            .all()
        )
        excluded_ids: Set[int] = {r[0] for r in watched_records}

        # Also exclude explicitly rejected titles in current session
        rejected_ids = set(getattr(context, "rejected_title_ids", []) or [])
        excluded_ids.update(rejected_ids)

        # 2. Extract context parameters
        req_format = getattr(context, "format", "either")
        req_region = getattr(context, "region", "all") or "all"
        req_ott = getattr(context, "ott_platform", "all") or "all"
        cycle_offset = getattr(context, "cycle_offset", 0) or 0
        max_runtime = getattr(context, "max_runtime", None)
        mood = getattr(context, "mood", None)
        situation = getattr(context, "situation", None)
        novelty = getattr(context, "novelty", "balanced")
        feedback = getattr(context, "feedback", None)

        # 3. Base candidate query
        candidate_query = db.query(Title)
        if excluded_ids:
            candidate_query = candidate_query.filter(~Title.id.in_(excluded_ids))

        if req_format and req_format.lower() in ("movie", "series"):
            candidate_query = candidate_query.filter(Title.type == req_format.lower())

        if req_region == "bollywood":
            candidate_query = candidate_query.filter(
                or_(
                    Title.keywords.ilike("%bollywood%"),
                    Title.keywords.ilike("%indian%"),
                    Title.keywords.ilike("%hindi%"),
                )
            )
        elif req_region == "hollywood":
            candidate_query = candidate_query.filter(
                ~Title.keywords.ilike("%bollywood%"),
                ~Title.keywords.ilike("%indian%"),
            )

        if req_ott and req_ott.lower() != "all":
            ott_lower = req_ott.lower()
            if ott_lower == "netflix":
                candidate_query = candidate_query.filter(Title.ott_providers.ilike("%netflix%"))
            elif ott_lower == "prime":
                candidate_query = candidate_query.filter(Title.ott_providers.ilike("%prime%"))
            elif ott_lower == "hotstar":
                candidate_query = candidate_query.filter(
                    or_(
                        Title.ott_providers.ilike("%hotstar%"),
                        Title.ott_providers.ilike("%disney%"),
                    )
                )

        candidates: List[Title] = candidate_query.all()
        if not candidates:
            return {
                "best_match": None,
                "safe_choice": None,
                "wildcard": None,
                "context_summary": "No candidate titles available fitting current filters.",
                "total_candidates": 0,
            }

        # 4. User taste weights & top genres
        user_ratings = (
            db.query(UserTitle)
            .filter(UserTitle.user_id == user.id, UserTitle.rating.isnot(None))
            .all()
        )
        genre_weights = RecommendationService.get_user_taste_weights(user, db)
        top_user_genres: Set[str] = set()
        for ur in user_ratings:
            if ur.rating and ur.rating >= 4.0 and ur.title:
                for g in ur.title.genres:
                    top_user_genres.add(g.name)

        # Identify genres of rejected titles if user indicated 'wrong_genre'
        rejected_genres: Set[str] = set()
        if feedback == "wrong_genre" and rejected_ids:
            rejected_titles = db.query(Title).filter(Title.id.in_(rejected_ids)).all()
            for rt in rejected_titles:
                for g in rt.genres:
                    rejected_genres.add(g.name)

        # Phase 6: Predict Collaborative Filtering signals for all candidates
        cand_ids = [t.id for t in candidates]
        cf_predictions = collaborative_service.predict_collaborative_scores(user.id, cand_ids, db)
        num_ratings = len(user_ratings)
        w_cf = 0.15 if num_ratings < 3 else (0.35 if num_ratings < 8 else 0.50)

        # 5. Score all candidates against context vectors
        mood_target_genres = set(RecommendationService.MOOD_GENRE_BOOSTS.get(mood or "", []))
        situation_target_genres = set(RecommendationService.SITUATION_GENRE_BOOSTS.get(situation or "", []))

        scored_candidates = []

        for title in candidates:
            score = 0.0
            reasons = []
            title_genre_names = {g.name for g in title.genres}

            # Base quality
            score += title.vote_average * 1.5
            score += min(6.0, title.popularity / 15.0)

            # Taste profile resonance (Content-Based)
            taste_resonance = 0.0
            for genre in title.genres:
                taste_resonance += genre_weights.get(genre.id, 0.0) * 2.0

            # Collaborative Filtering signal
            cf_info = cf_predictions.get(title.id, {})
            cf_score = cf_info.get("cf_score", 0.0)
            cf_reason = cf_info.get("reason")

            # Dynamic Hybrid Fusion
            hybrid_taste = (1.0 - w_cf) * taste_resonance + w_cf * cf_score
            score += hybrid_taste

            if taste_resonance > 3.0:
                reasons.append("Matches your established taste preferences")
            if cf_score >= 10.0 and cf_reason:
                reasons.append(cf_reason)


            # Runtime constraint handling
            if max_runtime and title.runtime_minutes:
                if title.runtime_minutes <= max_runtime:
                    score += 8.0
                    reasons.append(f"Fits your {max_runtime}m time limit ({title.runtime_minutes}m)")
                else:
                    excess = title.runtime_minutes - max_runtime
                    score -= (excess * 1.5 + 30.0)

            # Decisive Mood Resonance
            if mood and mood_target_genres:
                matched_mood_genres = title_genre_names.intersection(mood_target_genres)
                if matched_mood_genres:
                    # Decisive boost for mood match
                    score += 24.0 + (len(matched_mood_genres) - 1) * 8.0
                    reasons.append(f"Aligns with your {mood.replace('_', ' ')} mood ({', '.join(matched_mood_genres)})")
                else:
                    # Penalize completely non-matching mood
                    score -= 35.0

                # Clashing negative genres penalty (e.g., dark crime/horror clashing with chill/feel-good)
                clashing_genres = title_genre_names.intersection(RecommendationService.MOOD_GENRE_PENALTIES.get(mood, []))
                if clashing_genres:
                    score -= 30.0 * len(clashing_genres)

            # Situation resonance
            if situation and situation_target_genres:
                matched_sit_genres = title_genre_names.intersection(situation_target_genres)
                if matched_sit_genres:
                    score += len(matched_sit_genres) * 4.0
                    reasons.append(f"Optimized for {situation.replace('_', ' ')} viewing")

            # Feedback-driven adaptive modifications (PRD Section 4)
            if feedback:
                if feedback == "too_long":
                    if title.runtime_minutes and title.runtime_minutes > 115:
                        score -= 30.0
                    elif title.runtime_minutes and title.runtime_minutes <= 100:
                        score += 15.0
                        reasons.append("Trimmed runtime for quick engagement")
                elif feedback == "too_serious":
                    if title_genre_names.intersection({"Drama", "Crime", "Horror"}):
                        score -= 20.0
                    if title_genre_names.intersection({"Comedy", "Animation", "Adventure"}):
                        score += 15.0
                        reasons.append("Lighter, entertaining tone")
                elif feedback == "predictable":
                    if title_genre_names.intersection({"Mystery", "Sci-Fi", "Thriller"}):
                        score += 15.0
                        reasons.append("Unpredictable narrative twists")
                elif feedback == "wrong_genre" and rejected_genres:
                    overlap = title_genre_names.intersection(rejected_genres)
                    if overlap:
                        score -= 25.0
                    else:
                        score += 10.0
                        reasons.append("Pivoted away from rejected genres")
                elif feedback == "not_in_mood":
                    score += title.vote_average * 1.5
                elif feedback == "want_something_different":
                    if not title_genre_names.intersection(top_user_genres):
                        score += 20.0
                        reasons.append("Fresh genre trajectory")

            scored_candidates.append({
                "title": title,
                "score": score,
                "reasons": reasons,
                "cf_score": cf_score,
                "cf_reason": cf_reason,
                "is_novel": bool(title_genre_names and not title_genre_names.intersection(top_user_genres)),
                "title_genre_names": title_genre_names,
            })

        # Sort all scored candidates
        scored_candidates.sort(key=lambda item: item["score"], reverse=True)

        # 6. Tier Selection: Best Match, Safe Choice, Wildcard (with cycle rotation for variety)
        selected_titles_set = set()

        # A. Best Match: Rotate across top-tier candidates within optimal score band
        top_score = scored_candidates[0]["score"]
        top_best_pool = [c for c in scored_candidates if c["score"] >= (top_score - 10.0)]
        if not top_best_pool or len(top_best_pool) < 2:
            top_best_pool = scored_candidates[:min(6, len(scored_candidates))]

        best_idx = cycle_offset % len(top_best_pool)
        best_candidate = top_best_pool[best_idx]
        selected_titles_set.add(best_candidate["title"].id)

        best_explanation = (
            f"Best Match: {best_candidate['reasons'][0] if best_candidate['reasons'] else 'Top overall harmony with your context and ratings'}."
        )

        # B. Safe Choice: High rating consensus within mood-compatible pool
        remaining_for_safe = [c for c in scored_candidates if c["title"].id not in selected_titles_set]
        if mood and mood_target_genres:
            mood_compatible_safe = [
                c for c in remaining_for_safe
                if c["title_genre_names"].intersection(mood_target_genres)
            ]
            pool_for_safe = mood_compatible_safe if mood_compatible_safe else remaining_for_safe
        else:
            pool_for_safe = remaining_for_safe

        safe_candidates = [c for c in pool_for_safe if c["title"].vote_average >= 7.6]
        if not safe_candidates:
            safe_candidates = sorted(pool_for_safe, key=lambda c: c["title"].vote_average, reverse=True)

        # Sort safe candidates by consensus quality
        safe_candidates = sorted(
            safe_candidates,
            key=lambda c: c["title"].vote_average * 1.5 + min(10.0, c["title"].vote_count / 1500.0) + c["score"] * 0.4,
            reverse=True,
        )
        safe_pool = safe_candidates[:min(6, len(safe_candidates))]
        safe_idx = (cycle_offset + 1) % len(safe_pool)
        safe_candidate = safe_pool[safe_idx]
        selected_titles_set.add(safe_candidate["title"].id)

        safe_explanation = (
            f"Safe Choice: Acclaimed consensus ({safe_candidate['title'].vote_average:.1f}★ with {safe_candidate['title'].vote_count:,} ratings); reliable crowd-pleaser."
        )

        # C. Wildcard: High quality, but novel/unconventional genre or adventurous crossover
        remaining_for_wildcard = [c for c in scored_candidates if c["title"].id not in selected_titles_set]
        if mood and mood_target_genres:
            mood_compatible_wildcard = [
                c for c in remaining_for_wildcard
                if c["title_genre_names"].intersection(mood_target_genres)
            ]
            pool_for_wildcard = mood_compatible_wildcard if mood_compatible_wildcard else remaining_for_wildcard
        else:
            pool_for_wildcard = remaining_for_wildcard

        novel_candidates = [c for c in pool_for_wildcard if c["is_novel"] and c["title"].vote_average >= 7.0]
        if not novel_candidates:
            best_genres = best_candidate["title_genre_names"]
            novel_candidates = [
                c for c in pool_for_wildcard
                if len(c["title_genre_names"].intersection(best_genres)) == 0
            ]
        if not novel_candidates:
            novel_candidates = pool_for_wildcard

        # Sort novel candidates giving preference to titles loved by viewers with similar taste (serendipity)
        novel_candidates = sorted(
            novel_candidates,
            key=lambda c: (
                c.get("cf_score", 0.0) * 1.6
                + c["title"].vote_average * 1.4
                + c["score"] * 0.2
            ),
            reverse=True,
        )

        wild_pool = novel_candidates[:min(6, len(novel_candidates))]
        wild_idx = (cycle_offset + 2) % len(wild_pool)
        wildcard_candidate = wild_pool[wild_idx]
        selected_titles_set.add(wildcard_candidate["title"].id)

        if wildcard_candidate.get("cf_score", 0.0) >= 8.0 and wildcard_candidate.get("cf_reason"):
            wildcard_explanation = (
                f"Wildcard: Serendipitous crossover ({', '.join(g.name for g in wildcard_candidate['title'].genres[:2])}); {wildcard_candidate['cf_reason']} ({wildcard_candidate['title'].vote_average:.1f}★)."
            )
        else:
            wildcard_explanation = (
                f"Wildcard: An adventurous departure ({', '.join(g.name for g in wildcard_candidate['title'].genres[:2])}) outside your usual habits that still connects with the vibe."
            )


        # 7. Log served decisions into recommendation_logs
        log_best_id = None
        log_safe_id = None
        log_wildcard_id = None

        try:
            log_best = RecommendationLog(
                user_id=user.id,
                title_id=best_candidate["title"].id,
                tier="best_match",
                score=best_candidate["score"],
                explanation=best_explanation,
                algorithm_version="v3_context",
            )
            log_safe = RecommendationLog(
                user_id=user.id,
                title_id=safe_candidate["title"].id,
                tier="safe_choice",
                score=safe_candidate["score"],
                explanation=safe_explanation,
                algorithm_version="v3_context",
            )
            log_wildcard = RecommendationLog(
                user_id=user.id,
                title_id=wildcard_candidate["title"].id,
                tier="wildcard",
                score=wildcard_candidate["score"],
                explanation=wildcard_explanation,
                algorithm_version="v3_context",
            )
            db.add_all([log_best, log_safe, log_wildcard])
            db.commit()
            db.refresh(log_best)
            db.refresh(log_safe)
            db.refresh(log_wildcard)
            log_best_id = log_best.id
            log_safe_id = log_safe.id
            log_wildcard_id = log_wildcard.id
        except Exception:
            db.rollback()

        context_summary_parts = []
        if req_format and req_format != "either":
            context_summary_parts.append(req_format.capitalize())
        if req_region and req_region != "all":
            context_summary_parts.append(f"{req_region.capitalize()} cinema")
        if req_ott and req_ott != "all":
            ott_names = {"netflix": "Netflix", "prime": "Prime Video", "hotstar": "Disney+ Hotstar"}
            context_summary_parts.append(f"on {ott_names.get(req_ott.lower(), req_ott)}")
        if max_runtime:
            context_summary_parts.append(f"under {max_runtime}m")
        if mood:
            context_summary_parts.append(f"{mood.replace('_', ' ')} mood")
        if situation:
            context_summary_parts.append(f"with {situation.replace('_', ' ')}")
        if feedback:
            context_summary_parts.append(f"(reranked: {feedback.replace('_', ' ')})")

        summary_text = "Calibrated for " + ", ".join(context_summary_parts) if context_summary_parts else "Personalized for your evening"

        return {
            "best_match": DecisionTierItem(
                best_candidate["title"],
                "best_match",
                best_candidate["score"],
                best_explanation,
                best_candidate["reasons"],
                log_best_id,
            ),
            "safe_choice": DecisionTierItem(
                safe_candidate["title"],
                "safe_choice",
                safe_candidate["score"],
                safe_explanation,
                safe_candidate["reasons"],
                log_safe_id,
            ),
            "wildcard": DecisionTierItem(
                wildcard_candidate["title"],
                "wildcard",
                wildcard_candidate["score"],
                wildcard_explanation,
                wildcard_candidate["reasons"],
                log_wildcard_id,
            ),
            "context_summary": summary_text,
            "total_candidates": len(candidates),
        }

    @staticmethod
    def record_decision_feedback(
        user: User,
        payload: Any,
        db: Session,
    ) -> None:
        """Record rejection feedback for a recommended title."""
        log_id = getattr(payload, "log_id", None)
        title_id = getattr(payload, "title_id", None)
        feedback = getattr(payload, "feedback", None)

        if log_id:
            log = db.query(RecommendationLog).filter(RecommendationLog.id == log_id).first()
            if log:
                log.feedback = feedback
                db.commit()
                return

        if title_id:
            log = (
                db.query(RecommendationLog)
                .filter(
                    RecommendationLog.user_id == user.id,
                    RecommendationLog.title_id == title_id,
                )
                .order_by(desc(RecommendationLog.created_at))
                .first()
            )
            if log:
                log.feedback = feedback
                db.commit()

    @staticmethod
    def get_group_decision_recommendations(
        users: List[User],
        context: Any,
        db: Session,
    ) -> Dict[str, Any]:
        """
        Phase 5 Group Mode Recommender:
        Combines preferences from 2+ users to produce:
          1. Consensus Pick (Highest joint harmonic satisfaction)
          2. Compromise Choice (Cross-genre intersection of members' distinct tastes)
          3. Group Wildcard (Shared novelty candidate fitting common mood)
        Guarantees strict exclusion of any title already watched by ANY group member.
        """
        user_ids = [u.id for u in users]
        if not user_ids:
            return {
                "consensus_pick": None,
                "compromise_choice": None,
                "group_wildcard": None,
                "group_members": [],
                "consensus_genres": [],
                "context_summary": "No users provided.",
                "total_candidates": 0,
            }

        # 1. Union of watched titles across all members
        watched_records = (
            db.query(UserTitle.title_id)
            .filter(UserTitle.user_id.in_(user_ids), UserTitle.watched == True)
            .all()
        )
        excluded_ids: Set[int] = {r[0] for r in watched_records}

        # 2. Extract context
        req_format = getattr(context, "format", "either")
        req_region = getattr(context, "region", "all") or "all"
        req_ott = getattr(context, "ott_platform", "all") or "all"
        cycle_offset = getattr(context, "cycle_offset", 0) or 0
        max_runtime = getattr(context, "max_runtime", None)
        mood = getattr(context, "mood", None)
        situation = getattr(context, "situation", "friends")

        # 3. Base candidate query
        candidate_query = db.query(Title)
        if excluded_ids:
            candidate_query = candidate_query.filter(~Title.id.in_(excluded_ids))

        if req_format and req_format.lower() in ("movie", "series"):
            candidate_query = candidate_query.filter(Title.type == req_format.lower())

        if req_region == "bollywood":
            candidate_query = candidate_query.filter(
                or_(
                    Title.keywords.ilike("%bollywood%"),
                    Title.keywords.ilike("%indian%"),
                    Title.keywords.ilike("%hindi%"),
                )
            )
        elif req_region == "hollywood":
            candidate_query = candidate_query.filter(
                ~Title.keywords.ilike("%bollywood%"),
                ~Title.keywords.ilike("%indian%"),
            )

        if req_ott and req_ott.lower() != "all":
            ott_lower = req_ott.lower()
            if ott_lower == "netflix":
                candidate_query = candidate_query.filter(Title.ott_providers.ilike("%netflix%"))
            elif ott_lower == "prime":
                candidate_query = candidate_query.filter(Title.ott_providers.ilike("%prime%"))
            elif ott_lower == "hotstar":
                candidate_query = candidate_query.filter(
                    or_(
                        Title.ott_providers.ilike("%hotstar%"),
                        Title.ott_providers.ilike("%disney%"),
                    )
                )

        candidates: List[Title] = candidate_query.all()
        if not candidates:
            return {
                "consensus_pick": None,
                "compromise_choice": None,
                "group_wildcard": None,
                "group_members": [
                    {"id": u.id, "username": u.username, "email": u.email, "taste_genres": []}
                    for u in users
                ],
                "consensus_genres": [],
                "context_summary": "No candidate titles available fitting current filters.",
                "total_candidates": 0,
            }

        # 4. Compute taste profile & top genres for each member
        member_profiles = []
        all_user_top_genres: Set[str] = set()
        genre_appearance_count: Dict[str, int] = {}

        for user in users:
            weights = RecommendationService.get_user_taste_weights(user, db)
            user_ratings = (
                db.query(UserTitle)
                .filter(UserTitle.user_id == user.id, UserTitle.rating.isnot(None))
                .all()
            )
            top_genres: Set[str] = set()
            for ur in user_ratings:
                if ur.rating and ur.rating >= 4.0 and ur.title:
                    for g in ur.title.genres:
                        top_genres.add(g.name)
            if not top_genres and weights:
                # Top weighted genres if explicit ratings are sparse
                sorted_w = sorted(weights.items(), key=lambda x: x[1], reverse=True)[:3]
                for gid, w in sorted_w:
                    g_obj = db.query(Genre).filter(Genre.id == gid).first()
                    if g_obj:
                        top_genres.add(g_obj.name)

            member_profiles.append({
                "user": user,
                "weights": weights,
                "top_genres": top_genres,
            })
            for g in top_genres:
                all_user_top_genres.add(g)
                genre_appearance_count[g] = genre_appearance_count.get(g, 0) + 1

        # Consensus genres (genres shared by at least 2 members, or all if 1)
        consensus_genres = [
            g for g, count in genre_appearance_count.items()
            if count >= (2 if len(users) > 1 else 1)
        ]
        if not consensus_genres and genre_appearance_count:
            # Fallback to top appearing genres
            consensus_genres = sorted(
                genre_appearance_count.keys(),
                key=lambda g: genre_appearance_count[g],
                reverse=True,
            )[:3]

        mood_target_genres = set(RecommendationService.MOOD_GENRE_BOOSTS.get(mood or "", []))
        situation_target_genres = set(RecommendationService.SITUATION_GENRE_BOOSTS.get(situation or "friends", []))

        # 5. Score candidates with Joint Affinity & Disparity Penalties
        scored_candidates = []
        for title in candidates:
            title_genre_names = {g.name for g in title.genres}
            base_score = title.vote_average * 1.5 + min(6.0, title.popularity / 15.0)

            # Runtime constraint
            runtime_reasons = []
            if max_runtime and title.runtime_minutes:
                if title.runtime_minutes <= max_runtime:
                    base_score += 8.0
                    runtime_reasons.append(f"Fits {max_runtime}m limit ({title.runtime_minutes}m)")
                else:
                    excess = title.runtime_minutes - max_runtime
                    base_score -= (excess * 1.5 + 30.0)

            # Mood alignment
            mood_reasons = []
            if mood and mood_target_genres:
                matched_mood = title_genre_names.intersection(mood_target_genres)
                if matched_mood:
                    base_score += 24.0 + (len(matched_mood) - 1) * 8.0
                    mood_reasons.append(f"Aligns with {mood.replace('_', ' ')} mood ({', '.join(matched_mood)})")
                else:
                    base_score -= 35.0

                clashing_genres = title_genre_names.intersection(RecommendationService.MOOD_GENRE_PENALTIES.get(mood, []))
                if clashing_genres:
                    base_score -= 30.0 * len(clashing_genres)

            # Situation boost
            if situation and situation_target_genres:
                matched_sit = title_genre_names.intersection(situation_target_genres)
                if matched_sit:
                    base_score += len(matched_sit) * 4.0

            # Calculate individual taste resonance per member
            member_resonances = []
            for mp in member_profiles:
                res = 0.0
                for g in title.genres:
                    res += mp["weights"].get(g.id, 0.0) * 2.0
                member_resonances.append(res)

            # Harmonic joint score
            avg_resonance = sum(member_resonances) / len(member_resonances) if member_resonances else 0.0
            # Disparity penalty: penalize if one person loves it (+8) but another has no affinity (0)
            disparity = max(member_resonances) - min(member_resonances) if member_resonances else 0.0
            joint_taste_score = avg_resonance - (disparity * 0.35)

            final_consensus_score = base_score + joint_taste_score

            reasons = list(runtime_reasons) + list(mood_reasons)
            if consensus_genres and title_genre_names.intersection(set(consensus_genres)):
                matched_cg = title_genre_names.intersection(set(consensus_genres))
                reasons.append(f"Overlaps shared taste genres ({', '.join(matched_cg)})")
            elif avg_resonance > 2.0:
                reasons.append("High joint affinity across all member profiles")

            # Check compromise qualification (crosses members' distinct top genres)
            is_compromise = (
                len(member_profiles) > 1
                and all(bool(title_genre_names.intersection(mp["top_genres"])) for mp in member_profiles)
            )

            # Check wildcard qualification (novelty to EVERY member in group)
            is_group_novel = bool(title_genre_names and not title_genre_names.intersection(all_user_top_genres))

            scored_candidates.append({
                "title": title,
                "consensus_score": final_consensus_score,
                "base_score": base_score,
                "reasons": reasons,
                "title_genre_names": title_genre_names,
                "is_compromise": is_compromise,
                "is_group_novel": is_group_novel,
                "member_resonances": member_resonances,
            })

        # Sort candidates by consensus score
        scored_candidates.sort(key=lambda c: c["consensus_score"], reverse=True)

        selected_ids: Set[int] = set()

        # A. Consensus Pick (Highest joint harmony, rotated by cycle_offset)
        top_c_score = scored_candidates[0]["consensus_score"]
        top_consensus_pool = [c for c in scored_candidates if c["consensus_score"] >= (top_c_score - 12.0)]
        if not top_consensus_pool or len(top_consensus_pool) < 2:
            top_consensus_pool = scored_candidates[:min(6, len(scored_candidates))]

        c_idx = cycle_offset % len(top_consensus_pool)
        consensus_candidate = top_consensus_pool[c_idx]
        selected_ids.add(consensus_candidate["title"].id)

        consensus_explanation = (
            f"Consensus Pick: Maximum harmony across all {len(users)} viewers — balanced taste resonance with zero veto conflicts."
        )

        # B. Compromise Choice (Crosses the bridge between members' divergent genres)
        remaining_for_compromise = [c for c in scored_candidates if c["title"].id not in selected_ids]
        compromise_pool = [c for c in remaining_for_compromise if c["is_compromise"]]
        if not compromise_pool:
            # Fallback: title that touches the most members' top genres
            compromise_pool = sorted(
                remaining_for_compromise,
                key=lambda c: sum(bool(c["title_genre_names"].intersection(mp["top_genres"])) for mp in member_profiles),
                reverse=True,
            )

        comp_pool_slice = compromise_pool[:min(6, len(compromise_pool))]
        comp_idx = (cycle_offset + 1) % len(comp_pool_slice)
        compromise_candidate = comp_pool_slice[comp_idx]
        selected_ids.add(compromise_candidate["title"].id)

        # Explain the compromise bridge
        if len(users) >= 2:
            u1_name = users[0].username
            u2_name = users[1].username
            u1_match = compromise_candidate["title_genre_names"].intersection(member_profiles[0]["top_genres"])
            u2_match = compromise_candidate["title_genre_names"].intersection(member_profiles[1]["top_genres"])
            if u1_match and u2_match:
                comp_detail = f"Bridges {u1_name}'s preference for {', '.join(u1_match)} with {u2_name}'s love for {', '.join(u2_match)}."
            else:
                comp_detail = f"Harmonizes distinct tastes between {u1_name} and {u2_name}."
        else:
            comp_detail = "Multi-genre crossover balancing varied viewing angles."

        compromise_explanation = f"Compromise Choice: {comp_detail}"

        # C. Group Wildcard (Novel to all members, but high rating and fits the mood)
        remaining_for_wildcard = [c for c in scored_candidates if c["title"].id not in selected_ids]
        wildcard_pool = [c for c in remaining_for_wildcard if c["is_group_novel"] and c["title"].vote_average >= 7.0]
        if not wildcard_pool:
            # Fallback: genres not in consensus_genres
            wildcard_pool = [
                c for c in remaining_for_wildcard
                if not c["title_genre_names"].intersection(set(consensus_genres))
            ]
        if not wildcard_pool:
            wildcard_pool = remaining_for_wildcard

        wild_pool_slice = wildcard_pool[:min(6, len(wildcard_pool))]
        wild_idx = (cycle_offset + 2) % len(wild_pool_slice)
        wildcard_candidate = wild_pool_slice[wild_idx]
        selected_ids.add(wildcard_candidate["title"].id)

        wildcard_explanation = (
            f"Group Wildcard: An unexplored genre journey ({', '.join(g.name for g in wildcard_candidate['title'].genres[:2])}) new to everyone in the room."
        )

        # Build context summary text
        summary_parts = [f"{len(users)} viewers"]
        if req_format and req_format != "either":
            summary_parts.append(req_format.capitalize())
        if req_region and req_region != "all":
            summary_parts.append(f"{req_region.capitalize()} cinema")
        if req_ott and req_ott != "all":
            ott_names = {"netflix": "Netflix", "prime": "Prime Video", "hotstar": "Disney+ Hotstar"}
            summary_parts.append(f"on {ott_names.get(req_ott.lower(), req_ott)}")
        if mood:
            summary_parts.append(f"{mood.replace('_', ' ')} vibe")

        summary_text = "Group alignment for " + ", ".join(summary_parts)

        group_member_summaries = [
            {
                "id": mp["user"].id,
                "username": mp["user"].username,
                "email": mp["user"].email,
                "taste_genres": sorted(list(mp["top_genres"])),
            }
            for mp in member_profiles
        ]

        return {
            "consensus_pick": DecisionTierItem(
                consensus_candidate["title"],
                "consensus_pick",
                consensus_candidate["consensus_score"],
                consensus_explanation,
                consensus_candidate["reasons"],
            ),
            "compromise_choice": DecisionTierItem(
                compromise_candidate["title"],
                "compromise_choice",
                compromise_candidate["consensus_score"],
                compromise_explanation,
                compromise_candidate["reasons"],
            ),
            "group_wildcard": DecisionTierItem(
                wildcard_candidate["title"],
                "group_wildcard",
                wildcard_candidate["consensus_score"],
                wildcard_explanation,
                wildcard_candidate["reasons"],
            ),
            "group_members": group_member_summaries,
            "consensus_genres": consensus_genres,
            "context_summary": summary_text,
            "total_candidates": len(candidates),
        }


recommender = RecommendationService()

