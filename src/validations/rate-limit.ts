import { conditionalValidation } from '../types'

/**
 * Validate the deployment is not rate limited
 * @public
 */
export const rateLimit = conditionalValidation({
  predicate: async ({ deployment, externalCalls }) => !(await externalCalls.isEntityRateLimited(deployment.entity)),
  message: ({ deployment }) =>
    `Entity rate limited (entityId=${deployment.entity.id} pointers=${deployment.entity.pointers.join(',')}).`,
})
