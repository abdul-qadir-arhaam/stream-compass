# Stream Compass --- Product Requirements Document

## 1. Product

**Name:** Stream Compass\
**Status:** Working name / current brand\
**Category:** Personalized movie & TV discovery and decision engine

### Problem

Users often want to watch something but become overwhelmed by too many
choices.

### Solution

Stream Compass uses viewing history, ratings, taste, mood, context and
constraints to narrow choices and recommend what the user should watch.

**It is not a streaming service.** It only helps discover titles and,
where available, shows legal viewing options.

------------------------------------------------------------------------

## 2. Product Principles

-   Personalization over generic popularity.
-   Decision-making over endless browsing.
-   Context matters.
-   Recommendations must be explainable.
-   Avoid recommending already-watched titles by default.
-   Feedback should improve subsequent recommendations.
-   Keep advanced ML modular and add it after the core product works.
-   Reuse existing services/components; never duplicate functionality.

------------------------------------------------------------------------

## 3. Core User Journey

1.  User signs up.
2.  New user optionally rates 5--10 known titles for cold-start
    personalization.
3.  User searches/adds watched titles and rates them.
4.  User can maintain a watchlist.
5.  User selects **What Should I Watch?**
6.  User optionally gives:
    -   format: movie/series/either
    -   available time
    -   mood/experience
    -   viewing situation
    -   familiar vs new
7.  System returns a small set:
    -   **Best Match**
    -   **Safe Choice**
    -   **Wildcard**
8.  Each recommendation explains why it fits.
9.  User can reject the results and provide feedback.
10. System reranks instead of generating unrelated recommendations.
11. User can open a title to see details and legal watch availability.

------------------------------------------------------------------------

## 4. Main Features

### Authentication

-   Signup
-   Login
-   Logout
-   Secure password hashing
-   Protected API routes

### User Library

-   Watched history
-   1--5 star ratings
-   Optional rating reasons
-   Edit/remove rating
-   Watchlist
-   Mark watchlist item watched

### Movie/TV Data

Use a suitable provider such as TMDB.

Store/provider-map: - provider ID - title - type - overview - genres -
release date - runtime - language - poster/backdrop references - cast -
director/creator - keywords - ratings/popularity

Do not permanently download large poster collections.

### Search

Search movies and series by title with relevant metadata.

### Title Details

Show: - poster/backdrop - title - overview - genres - release data -
runtime - cast - director/creator - rating - similar titles - watch
availability - watched/rate/watchlist actions

### What Should I Watch?

Contextual inputs: - movie/series/either - time - mood - experience -
viewing situation - familiarity/novelty

Inputs are optional; do not create a long mandatory questionnaire.

### Recommendation Results

Show a limited number of strong choices: - Best Match - Safe Choice -
Wildcard

Include evidence-based "Why this?" explanations.

### Feedback Loop

"None of these" options: - too long - too serious - predictable - wrong
genre - not in the mood - want something different

Use feedback to modify ranking.

### Advanced Discovery

-   **I Remember Something:** natural-language plot/description search.
-   Natural-language requests such as "something like Interstellar but
    less complicated."
-   Pick something from watchlist.
-   Make the decision: choose one final title.

### Personalization

-   Favorite genres
-   Runtime preferences
-   Rating patterns
-   Recent viewing trends
-   Actor/director preferences when sufficient data exists
-   Novelty/adventurousness
-   Genre fatigue

### Group Mode

Combine preferences from multiple users and find
consensus/compromise/wildcard choices.

------------------------------------------------------------------------

## 5. Recommendation Architecture

Build incrementally.

### V1 --- Content Based

Use metadata features: - genres - keywords - overview - cast/director
where useful

Use TF-IDF/cosine similarity or an equivalent explainable method.

### V2 --- User Taste Profile

Create a weighted profile from watched/rated titles.

Higher ratings have stronger influence.

### V3 --- Context Ranking

Add: - taste match - mood match - context match - runtime fit -
novelty - diversity - genre fatigue - watched exclusion

Keep weights configurable.

### V4 --- Collaborative Filtering

Use MovieLens or another suitable dataset for experimentation.

Possible methods: - item-item similarity - matrix factorization

### V5 --- Hybrid

Combine content, taste, collaborative and contextual signals.

Keep the engine modular and independently testable.

Do not use an LLM as the sole recommender.

------------------------------------------------------------------------

## 6. Explainability

Recommendation explanations must come from actual signals.

Examples: - "You rated similar sci-fi titles highly." - "Fits your
under-2-hour preference." - "Matches your current suspense
preference." - "You have not watched this." - "This is outside your
usual genres but shares characteristics with titles you rated highly."

Do not generate unsupported reasons.

------------------------------------------------------------------------

## 7. Data Model

Core entities:

-   USERS
-   TITLES
-   GENRES
-   TITLE_GENRES
-   USER_TITLES
-   RATING_REASONS
-   WATCHLIST
-   USER_PREFERENCES
-   RECOMMENDATION_LOG

Use relational constraints and indexes.

Avoid duplicate user/title records.

Recommendation log should support: - user - title - score - algorithm
version - timestamp - clicked - watched - rated - feedback

------------------------------------------------------------------------

## 8. Technical Stack

### Frontend

-   React
-   TypeScript
-   Tailwind CSS

### Backend

-   Python
-   FastAPI

### Database

-   PostgreSQL

### Recommendation

-   Python
-   scikit-learn initially

Keep external APIs behind service modules.

Keep secrets in environment variables.

------------------------------------------------------------------------

## 9. UI / Brand Direction

### Personality

Premium, cinematic, intelligent, calm and modern.

### Visual language

-   Dark-first
-   Minimal
-   Strong typography
-   Generous spacing
-   High-quality imagery
-   Subtle motion
-   Clear hierarchy

Avoid: - excessive gradients - neon overload - excessive glassmorphism -
cartoon styling - clutter - generic AI-dashboard appearance

### Brand idea

**Stream = entertainment**\
**Compass = guidance**

Core metaphor:

> When you don't know what to watch, Stream Compass points you in the
> right direction.

Possible UI language: - "Where do you want to go tonight?" - "Find your
next story." - "Best Match" - "Safe Choice" - "Wildcard"

### Logo direction

Minimal compass/navigation symbol with a subtle entertainment or play
association. Avoid an obvious generic play button inside a compass.

------------------------------------------------------------------------

## 10. Main Screens

1.  Landing
2.  Login
3.  Signup
4.  Onboarding
5.  Home
6.  What Should I Watch?
7.  Recommendation Results
8.  Search
9.  Title Details
10. My Library
11. Watchlist
12. Taste Profile
13. Group Mode
14. I Remember Something
15. Settings

Only add screens when they solve a real UX problem.

------------------------------------------------------------------------

## 11. Development Roadmap

### Phase 1 --- Foundation

Project setup, database, authentication.

### Phase 2 --- Content

Movie/TV API, search, title details.

### Phase 3 --- Personalization

Library, ratings, watchlist, content-based recommendations, taste
profile.

### Phase 4 --- Decision Engine

Context, Best Match/Safe Choice/Wildcard, explanations, feedback loop.

### Phase 5 --- Advanced

Watch availability, natural-language discovery, "I Remember Something,"
analytics, genre fatigue, group mode.

### Phase 6 --- Data Science

Collaborative filtering, hybrid ranking, evaluation.

### Phase 7 --- Production

Testing, accessibility, performance, security, deployment.

------------------------------------------------------------------------

## 12. Quality Requirements

### Security

-   Hash passwords.
-   Validate inputs.
-   Protect private routes.
-   Never expose secrets.

### Reliability

Handle API/database failures, timeouts, empty results and rate limits
gracefully.

### Accessibility

Semantic HTML, keyboard support, labels, contrast, alt text and
responsive design.

### Testing

Prioritize: - authentication - database constraints - recommendation
scoring - watched exclusion - rating/taste profile - context filtering -
feedback reranking - API failures

### Performance

Minimize unnecessary API calls and database queries. Cache suitable
metadata.

------------------------------------------------------------------------

## 13. Non-Goals

Do NOT build: - video streaming - torrent/download functionality - a
social-media feed - a huge generic movie catalogue UI - a recommendation
system based only on genre - unnecessary AI chat functionality - complex
deep learning before sufficient data exists

------------------------------------------------------------------------

## 14. Definition of Done

A feature is considered complete when: - it works end-to-end, - it
integrates with existing architecture, - errors/loading/empty states are
handled, - critical logic is tested, - no duplicate implementation was
introduced, - secrets/configuration are handled correctly.

After each development batch, inspect the existing implementation before
continuing.

Do not rebuild working features.

------------------------------------------------------------------------

# Antigravity Kickoff Prompts

Use the PRD as the persistent product context. Keep chat prompts short.

## Kickoff 1 --- Foundation

Read `prd.md`.

Inspect the workspace. Implement **Phase 1 only**: project structure,
PostgreSQL connection/schema foundation, FastAPI setup, React setup,
environment configuration, authentication and basic UI shell.

Do not implement later phases. Reuse existing code if present. Test the
foundation when finished.

## Kickoff 2 --- Content

Read `prd.md`.

Inspect the current implementation. Implement **Phase 2 only**: movie/TV
provider integration, title search and title details.

Reuse the existing architecture and do not duplicate
services/components. Test API failure and empty-result states.

## Kickoff 3 --- Personalization

Read `prd.md`.

Implement **Phase 3**: watched library, ratings, watchlist, rating
reasons, content-based recommendations and initial taste profile.

Extend existing recommendation infrastructure rather than creating
another system.

## Kickoff 4 --- Decision Engine

Read `prd.md`.

Implement **Phase 4**: What Should I Watch, contextual ranking, Best
Match/Safe Choice/Wildcard, explanations and feedback-based reranking.

Keep the existing recommendation engine as the single source of
recommendation logic.

## Kickoff 5 --- Advanced

Read `prd.md`.

Implement **Phase 5**: watch availability, I Remember Something,
natural-language recommendation input, watchlist picker, taste insights,
genre fatigue and group mode.

Reuse existing search, recommendation and user systems.

## Kickoff 6 --- Data Science

Read `prd.md`.

Implement **Phase 6**: collaborative filtering, hybrid ranking and
recommendation evaluation metrics.

Keep the system modular and compare the hybrid approach against the
content-based baseline.

## Kickoff 7 --- Finalization

Read `prd.md`.

Implement **Phase 7**: testing, accessibility, security review,
performance optimization, error handling, responsive polish and
deployment readiness.

Do not add unnecessary features.

------------------------------------------------------------------------

# Important Antigravity Rule

The PRD is the source of truth.

For every task: 1. Read the relevant section. 2. Inspect existing code.
3. Implement only the requested phase/features. 4. Reuse existing
functionality. 5. Test. 6. Do not redo completed work. 7. Do not add
unrelated features.
