# VibesHub

VibesHub is an English-interface, Hebrew-content creator discovery marketplace for Israeli shoppers. Creators publish storefronts containing product recommendations, story clips, discount codes, and outbound merchant links.

The project is currently in its architecture-definition phase. Implementation begins only after the product rules, system boundaries, data model, API contracts, and delivery plan are recorded.

## Architecture package

- [Product and business decisions](docs/architecture/00-product-decisions.md)
- [System architecture](docs/architecture/01-system-architecture.md)
- [Architecture decision records](docs/architecture/adrs/README.md)

## Current implementation order

1. Lock product and business rules.
2. Record system architecture and technology ADRs.
3. Design the ERD and database migrations.
4. Define API contracts, events, background jobs, and security boundaries.
5. Scaffold the monorepo and cloud environments.
6. Implement identity, creator applications, and moderation.
7. Deliver public discovery, creator studio, media, analytics, and native applications in phased releases.
