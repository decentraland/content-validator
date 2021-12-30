import ms from 'ms'
import { OK, Validation, validationFailed } from '../types'

const REQUEST_TTL_FORWARDS: number = ms('15m')

/** Validate that the deployment is recent */
export const recent: Validation = {
  validate: ({ deployment, externalCalls }) => {
    // Verify that the timestamp is recent enough. We need to make sure that the definition of recent works with the synchronization mechanism
    const delta = Date.now() - deployment.entity.timestamp
    if (delta > externalCalls.requestTtlBackwards) {
      return validationFailed('The request is not recent enough, please submit it again with a new timestamp.')
    } else if (delta < -REQUEST_TTL_FORWARDS) {
      return validationFailed('The request is too far in the future, please submit it again with a new timestamp.')
    }
    return OK
  },
}
