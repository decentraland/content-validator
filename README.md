# @dcl/content-validator

Contains all validations to run against entity deployments (either local and sync contexts).

## Getting Started

Install dependencies and run tests:

```
> yarn
> make build
> make test
```

### Debugging tests

In case you are using VS Code, you can install recommended extensions and debug them using Jest extension which adds UI support.

## Adding new entities

Before adding any validation to new entities, ensure you have defined a schema on [@dcl/schemas](https://github.com/decentraland/common-schemas) and added the relation on [catalyst-commons](https://github.com/decentraland/catalyst-commons/).

To make Catalysts accept deployments of new entity types, they must have defined how access is checked and that means to add them in [access.ts](./src/validations/access-checker/access.ts).

### In steps

- Create entity schema on [@dcl/schemas](https://github.com/decentraland/common-schemas)
- Add entity type and schema on [catalyst-commons](https://github.com/decentraland/catalyst-commons/).
- Add entity type and access checker in [access.ts](./src/validations/access-checker/access.ts).
