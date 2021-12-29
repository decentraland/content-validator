import { conditionalValidation } from ".."

/** Validate the deployment is not rate limited */
export const rateLimit = conditionalValidation({
  predicate: async ({ deployment, externalCalls }) => await externalCalls.isEntityRateLimited(deployment.entity),
  message: ({ deployment }) =>
    `Entity rate limited (entityId=${deployment.entity.id} pointers=${deployment.entity.pointers.join(",")}).`,
})
