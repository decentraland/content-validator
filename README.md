<img src="https://ui.decentraland.org/decentraland_256x256.png" height="128" width="128" />

# @dcl/content-validator

[![Coverage Status](https://coveralls.io/repos/github/decentraland/content-validator/badge.svg?branch=main)](https://coveralls.io/github/decentraland/content-validator?branch=main)

Contains all validations to run against [entity](https://docs.decentraland.org/contributor/content/entities/) deployments.

## Getting Started

Install dependencies and run tests:

```
> yarn
> yarn build
> yarn test
```

### Debugging tests

In case you are using VS Code, you can install recommended extensions and debug them using Jest extension which adds UI support.

## Adding new entities

Before adding any validation to new entities, ensure you have defined a schema on [@dcl/schemas](https://github.com/decentraland/common-schemas) and added the relation on [catalyst-commons](https://github.com/decentraland/catalyst-commons/).

To make Catalysts accept deployments of new entity types, they must have defined how access is checked and that means to add them in [access.ts](./src/validations/access-checker/access.ts).

### In steps

1. Create entity schema on [@dcl/schemas](https://github.com/decentraland/common-schemas).
2. Add entity type and schema on [catalyst-commons](https://github.com/decentraland/catalyst-commons/).
3. Add entity type and access checker in [access.ts](./src/validations/access-checker/access.ts).
   a. Verify entity pointers can be resolved. If required add a new resolver in [@dcl/urn-resolver](https://github.com/decentraland/urn-resolver).

## AI Agent Context

**Service Purpose:** Validates entity deployments to Decentraland Catalysts. Provides comprehensive validation functions for entity structure, metadata, access permissions, content integrity, and size constraints. Used by all Catalyst servers to ensure only valid and authorized content is deployed.

**Key Capabilities:**

- Validates entity structure (JSON schema, required fields, content references)
- Checks access permissions via blockchain (on-chain) or The Graph subgraph (ownership verification)
- Validates URN pointers for items (wearables, emotes) against blockchain collections and third-party registries
- Verifies content file integrity (IPFS hashing, content file references)
- Enforces entity size limits (ADR-51) per entity type with special handling for skins
- Validates metadata schemas against @dcl/schemas definitions
- Validates signature authenticity (AuthChain validation)
- Validates scene structure, profile data, wearable representations, and emote animations

**Communication Pattern:** Library/package consumed by Catalyst services (synchronous function calls)

**Technology Stack:**

- Runtime: Node.js
- Language: TypeScript
- Validation: AJV (JSON schema validation), custom validation functions
- Blockchain: Ethereum providers (@dcl/block-indexer), The Graph subgraphs
- Component Architecture: @well-known-components interfaces (logger, fetch, config)

**External Dependencies:**

- Blockchain: Ethereum mainnet/L2 networks (ownership verification)
- Indexers: The Graph subgraphs (LAND, Collections, Third Party Registry, ENS)
- Resolvers: @dcl/urn-resolver (URN parsing and validation)
- Schemas: @dcl/schemas (entity type definitions and validation schemas)

**Key Validation Types:**

- **Access Validation**: Verifies deployer owns the entity pointers (LAND, NFTs, names)
- **Size Validation**: Enforces max size limits per entity type (scenes: 15MB, wearables: 3MB, profiles: 2MB, etc.)
- **Content Validation**: Ensures referenced content files exist and hashes match
- **Metadata Validation**: Validates metadata structure against entity schemas
- **Item Validation**: Checks wearable/emote URN validity and ownership
- **Signature Validation**: Verifies AuthChain signatures for entity authenticity

**Project Structure:**

- `src/validations/`: Core validation functions (access, content, size, metadata, items, scenes, profiles, outfits)
- `src/validations/access/`: Access checker implementations (on-chain, subgraph, common item validation)
- `src/types.ts`: Validation response types, deployment interfaces, external call contracts
