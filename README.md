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
