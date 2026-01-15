<img src="https://ui.decentraland.org/decentraland_256x256.png" height="128" width="128" />

# @dcl/content-validator

[![Coverage Status](https://coveralls.io/repos/github/decentraland/content-validator/badge.svg?branch=main)](https://coveralls.io/github/decentraland/content-validator?branch=main)

Decentraland entity deployment validation library for Catalyst servers. Contains all validations to ensure only valid and authorized content is deployed to the [Decentraland content network](https://docs.decentraland.org/contributor/content/entities/).

Install it with:
```bash
npm i @dcl/content-validator
```

## Design Guidelines

- Validate as early as possible to prevent invalid content from being stored
- Provide clear, actionable error messages for deployment failures
- Support both on-chain and subgraph-based access verification
- Maintain backwards compatibility with legacy content migrations
- Ensure all validation functions are stateless where possible

Implementation decisions:

- The library exports a `createValidator` factory function as the main entry point
- Validation functions return `{ ok: boolean, errors?: string[] }` responses
- Access checking supports two strategies: on-chain (direct blockchain) and subgraph (The Graph)
- Size limits are defined per entity type following [ADR-51](https://adr.decentraland.org/adr/ADR-51)

## Validation Types

The validator performs the following checks on entity deployments:

| Validation | Description |
|------------|-------------|
| **Entity Structure** | Validates JSON structure, required fields, and content references |
| **IPFS Hashing** | Ensures content file hashes are valid IPFS CIDs |
| **Metadata Schema** | Validates metadata against `@dcl/schemas` definitions |
| **Signature** | Verifies AuthChain signatures for entity authenticity |
| **Size** | Enforces max size limits per entity type (see below) |
| **Access** | Verifies deployer owns the entity pointers (LAND, NFTs, names) |
| **Content** | Ensures all referenced content files exist and are accessible |
| **Entity-Specific** | Additional validations per type (wearables, emotes, profiles, scenes, outfits) |

### Size Limits (ADR-51)

| Entity Type | Max Size | Notes |
|-------------|----------|-------|
| Scene | 15 MB | Per parcel |
| Profile | 2 MB | |
| Wearable | 3 MB | |
| Wearable (Skin) | 9 MB | Special category |
| Emote | 3 MB | |
| Store | 1 MB | |
| Outfits | 1 MB | |

## Usage

### Basic Usage

```typescript
import { createValidator, ContentValidatorComponents, DeploymentToValidate } from '@dcl/content-validator'

// Create validator with required components
const validator = createValidator({
  logs: logsComponent,
  externalCalls: {
    isContentStoredAlready: async (hashes) => { /* ... */ },
    fetchContentFileSize: async (hash) => { /* ... */ },
    validateSignature: async (entityId, auditInfo, timestamp) => { /* ... */ },
    ownerAddress: (auditInfo) => { /* ... */ },
    isAddressOwnedByDecentraland: (address) => { /* ... */ },
    calculateFilesHashes: async (files) => { /* ... */ }
  },
  accessValidateFn: accessValidator // on-chain or subgraph-based
})

// Validate a deployment
const deployment: DeploymentToValidate = {
  entity: { /* entity data */ },
  files: new Map([/* content files */]),
  auditInfo: { authChain: [/* auth chain */] }
}

const result = await validator(deployment)
if (!result.ok) {
  console.error('Validation failed:', result.errors)
}
```

### Access Validation Strategies

The library supports two access validation strategies:

#### On-Chain Validation

Direct blockchain queries for ownership verification:

```typescript
import { createOnChainAccessCheckValidateFns, createOnChainClient } from '@dcl/content-validator'

const validateFns = createOnChainAccessCheckValidateFns({
  logs,
  externalCalls,
  client: createOnChainClient({ logs, L1, L2 }),
  L1: { checker, collections, thirdParty, blockSearch },
  L2: { checker, collections, thirdParty, blockSearch }
})
```

#### Subgraph Validation

Uses The Graph for ownership queries (more efficient for bulk queries):

```typescript
import { createSubgraphAccessCheckValidateFns, createTheGraphClient } from '@dcl/content-validator'

const validateFns = createSubgraphAccessCheckValidateFns({
  logs,
  externalCalls,
  theGraphClient: createTheGraphClient({ logs, subGraphs }),
  subGraphs,
  tokenAddresses: { land: '0x...', estate: '0x...' }
})
```

## Getting Started

### Development

Install dependencies and run tests:

```bash
yarn
yarn build
yarn test
```

### Debugging Tests

If you are using VS Code, install the recommended extensions and debug tests using the Jest extension which adds UI support.

## Adding New Entity Types

Before adding any validation for new entities:

1. **Create entity schema** on [@dcl/schemas](https://github.com/decentraland/common-schemas)
2. **Add entity type and schema** on [catalyst-commons](https://github.com/decentraland/catalyst-commons/)
3. **Add access checker** in [access/index.ts](./src/validations/access/index.ts) and implement entity-specific validation
4. **Add size limit** in [ADR51.ts](./src/validations/ADR51.ts)
5. **Verify URN resolution** - if required, add a new resolver in [@dcl/urn-resolver](https://github.com/decentraland/urn-resolver)

## Project Structure

```
src/
├── index.ts                 # Main entry point, createValidator factory
├── types.ts                 # Core types (DeploymentToValidate, ValidationResponse, etc.)
├── utils.ts                 # Utility functions
└── validations/
    ├── index.ts             # Validation function aggregator
    ├── access/              # Access permission validators
    │   ├── common/          # Shared access validation logic
    │   ├── on-chain/        # Direct blockchain access checking
    │   └── subgraph/        # The Graph-based access checking
    ├── items/               # Item-specific validations
    │   ├── emotes.ts
    │   └── wearables.ts
    ├── ADR45.ts             # ADR-45 validation rules
    ├── ADR51.ts             # Size limits per entity type
    ├── content.ts           # Content file validation
    ├── entity-structure.ts  # Entity JSON structure validation
    ├── ipfs-hashing.ts      # IPFS hash validation
    ├── metadata-schema.ts   # Metadata schema validation
    ├── outfits.ts           # Outfits-specific validation
    ├── profile.ts           # Profile-specific validation
    ├── scene.ts             # Scene-specific validation
    ├── signature.ts         # AuthChain signature validation
    ├── size.ts              # Entity size validation
    └── timestamps.ts        # Important timestamp constants
```

## External Dependencies

| Dependency | Purpose |
|------------|---------|
| `@dcl/schemas` | Entity type definitions and validation schemas |
| `@dcl/urn-resolver` | URN parsing and validation for items |
| `@dcl/block-indexer` | Blockchain block search for timestamp-based queries |
| `@dcl/hashing` | IPFS content hashing |
| `@well-known-components/thegraph-component` | The Graph subgraph queries |

## Versioning and Publishing

Versions are handled manually using GitHub releases and semver.

Main branch is automatically published to the `@next` dist tag to test integrations before final releases happen.

## AI Agent Context

For detailed AI Agent context, see [docs/ai-agent-context.md](docs/ai-agent-context.md).
