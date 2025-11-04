# AI Agent Context

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
